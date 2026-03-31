from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from app.models import VerificationRequest, VerificationResponse, CredibilityLabel, RetrievedEvidence, ChatRequest, ChatResponse, ChatMessage, FeedbackRequest
from app.services.retrieval import retrieval_service
from app.services.llm_service import llm_service
from app.services.welfake_service import welfake_service
from app.services.ml_classifier import ml_classifier
from app.services.chat_service import chat_service
from app.services.image_forensics import run_ela, run_exif
from app.services.analytics_service import record_verification, get_dashboard_data, get_dataset_stats
from app.config import settings
import asyncio
import logging
import json
import io
import numpy as np
from PIL import Image
from pathlib import Path
from datetime import datetime, timezone

# ─── Lazy-loaded EasyOCR reader (downloaded once on first use) ───────────────
_ocr_reader = None

def get_ocr_reader():
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        logger.info("Initializing EasyOCR (may download models ~120 MB on first run)...")
        _ocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        logger.info("EasyOCR ready")
    return _ocr_reader

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Fake News Verification API")

# CORS middleware - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting Fake News Verification System...")
    
    # Try to load existing index first
    if retrieval_service.load_index():
        logger.info(f"Loaded existing index with {len(retrieval_service.articles)} articles")
        # Index exists — still load the WELFake DataFrame for analytics/stats
        # (load_dataset is lightweight for the df; we just won't rebuild the index)
        if not welfake_service.is_loaded():
            logger.info("Loading WELFake DataFrame for analytics...")
            welfake_service.load_dataset(max_articles=settings.MAX_ARTICLES_TO_INDEX)
            if welfake_service.is_loaded():
                logger.info(f"WELFake DataFrame ready ({len(welfake_service.df)} rows)")
            else:
                logger.warning("WELFake DataFrame could not be loaded — dataset stats unavailable")
    else:
        # No existing index, load WELFake dataset and build index
        logger.info("No existing index found. Loading WELFake dataset...")
        
        if welfake_service.load_dataset(max_articles=settings.MAX_ARTICLES_TO_INDEX):
            articles = welfake_service.get_articles()
            logger.info(f"Building index with {len(articles)} articles from WELFake dataset...")
            retrieval_service.build_index(articles)
            logger.info(f"Index built successfully with {len(articles)} articles")
        else:
            logger.warning("WELFake dataset not available. Please download from Kaggle.")
    
    # Train ML classifier (or load from cache)
    logger.info("Initializing ML classifier...")
    if ml_classifier.train():
        logger.info(f"ML classifier ready (accuracy: {ml_classifier.accuracy:.2%})")
    else:
        logger.warning("ML classifier not available - using LLM-only verification")


@app.get("/")
async def root():
    return {
        "message": "Fake News Verification API",
        "version": "2.0.0",
        "features": {
            "semantic_search": retrieval_service.index is not None,
            "ml_classifier": ml_classifier.is_trained,
            "ml_accuracy": f"{ml_classifier.accuracy:.2%}" if ml_classifier.is_trained else "N/A"
        },
        "endpoints": {
            "verify": "/api/verify",
            "health": "/health"
        }
    }

@app.get("/health")
async def health_check():
    stats = welfake_service.get_stats()
    return {
        "status": "healthy",
        "index_loaded": retrieval_service.index is not None,
        "articles_count": len(retrieval_service.articles),
        "ml_classifier": {
            "available": ml_classifier.is_trained,
            "accuracy": ml_classifier.accuracy if ml_classifier.is_trained else 0.0
        },
        "welfake_loaded": stats.get("loaded", False),
        "welfake_stats": stats
    }

@app.post("/api/verify", response_model=VerificationResponse)
async def verify_news(request: VerificationRequest):
    """Verify a news headline using hybrid ML + semantic search approach"""
    try:
        logger.info(f"Verifying headline: {request.headline} [lang={request.language}]")

        # Step 0: Translate to English if input is Hindi
        translated_headline = None
        headline_to_verify = request.headline
        if request.language == "hi":
            try:
                from deep_translator import GoogleTranslator
                translated = GoogleTranslator(source="hi", target="en").translate(request.headline)
                if translated and translated.strip():
                    translated_headline = translated.strip()
                    headline_to_verify = translated_headline
                    logger.info(f"Translated Hindi→English: {headline_to_verify}")
            except Exception as te:
                logger.warning(f"Translation failed, using original: {te}")

        # Step 1: Get ML classifier prediction (fast, high accuracy)
        ml_result = await asyncio.to_thread(ml_classifier.predict, headline_to_verify)
        logger.info(f"ML prediction: {ml_result['prediction']} (confidence: {ml_result['confidence']:.2%})")

        # Step 2: Retrieve relevant evidence from the local dataset
        evidence = []
        if retrieval_service.index is not None:
            evidence = retrieval_service.retrieve(
                headline_to_verify,
                top_k=settings.TOP_K_RESULTS
            )
            logger.info(f"Retrieved {len(evidence)} pieces of evidence")

        # --- Score tracking ---
        ml_score  = round(ml_result['confidence'], 4) if ml_result['ml_available'] else 0.0
        llm_score = 0.0
        evidence_score = round(
            sum(e.similarity_score for e in evidence) / len(evidence), 4
        ) if evidence else 0.0

        # Step 3: Determine credibility based on ML + evidence
        if ml_result['ml_available'] and ml_result['confidence'] > 0.85:
            # High confidence ML prediction - use it directly
            credibility = CredibilityLabel.TRUE if ml_result['prediction'] == "True" else CredibilityLabel.FAKE
            confidence  = ml_result['confidence']
            explanation = f"ML classifier ({ml_classifier.accuracy:.1%} accuracy) classified this as {ml_result['prediction'].upper()} with {ml_result['confidence']:.1%} confidence."
            if evidence:
                explanation += f" Found {len(evidence)} related articles for reference."

        elif evidence:
            # Use LLM for lower confidence or when ML unavailable
            verification_result = await asyncio.to_thread(
                llm_service.verify, request.headline, evidence
            )
            logger.info(f"LLM verification result: {verification_result['credibility']}")

            credibility_str = verification_result["credibility"].strip().lower()
            if credibility_str == "true":
                credibility = CredibilityLabel.TRUE
            elif credibility_str in ["fake", "false"]:
                credibility = CredibilityLabel.FAKE
            else:
                credibility = CredibilityLabel.UNVERIFIED

            llm_score = round(verification_result["confidence"], 4)
            confidence  = verification_result["confidence"]
            explanation = verification_result["explanation"]

            # Boost confidence if ML agrees
            if ml_result['ml_available']:
                ml_agrees = (
                    (ml_result['prediction'] == "True"  and credibility == CredibilityLabel.TRUE) or
                    (ml_result['prediction'] == "Fake"  and credibility == CredibilityLabel.FAKE)
                )
                if ml_agrees:
                    confidence = min(1.0, confidence + 0.1)
                    explanation += f" (ML classifier agrees with {ml_result['confidence']:.0%} confidence)"

        else:
            # No evidence and low ML confidence
            if ml_result['ml_available']:
                credibility = CredibilityLabel.TRUE if ml_result['prediction'] == "True" else CredibilityLabel.FAKE
                confidence  = ml_result['confidence'] * 0.8
                explanation = f"Based on ML analysis only (no evidence found). Classification: {ml_result['prediction']}"
            else:
                credibility = CredibilityLabel.UNVERIFIED
                confidence  = 0.0
                explanation = "Unable to verify: no evidence found and ML classifier unavailable."

        score_breakdown = {
            "ml_score":       ml_score,
            "llm_score":      llm_score,
            "evidence_score": evidence_score,
        }

        response = VerificationResponse(
            headline=request.headline,
            credibility=credibility,
            explanation=explanation,
            evidence=evidence,
            confidence=round(confidence, 4),
            score_breakdown=score_breakdown,
            translated_headline=translated_headline,
        )

        # ── Record to analytics DB (non-blocking best-effort) ────────────
        try:
            record_verification(
                headline=headline_to_verify,
                credibility=credibility.value,
                confidence=round(confidence, 4),
                score_breakdown=score_breakdown,
                source="text",
            )
        except Exception as ae:
            logger.warning(f"Analytics record skipped: {ae}")

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during verification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/translate")
async def translate_text(body: dict):
    """Translate any text to a target language (default: Hindi)"""
    try:
        from deep_translator import GoogleTranslator
        text   = body.get("text", "").strip()
        target = body.get("target", "hi")
        if not text:
            raise HTTPException(status_code=400, detail="text field is required")
        translated = GoogleTranslator(source="auto", target=target).translate(text)
        return {"translated": translated, "target": target}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Translation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ─── Feedback storage (JSON Lines — one JSON object per line) ─────────────────
FEEDBACK_FILE = Path(__file__).parent.parent / "feedback.jsonl"

@app.post("/api/feedback")
async def submit_feedback(req: FeedbackRequest):
    """Store a thumbs-up/down vote on a verification result."""
    try:
        entry = {
            "ts":               datetime.now(timezone.utc).isoformat(),
            "headline":         req.headline,
            "model_verdict":    req.model_verdict,
            "model_confidence": round(req.model_confidence, 4),
            "user_vote":        req.user_vote,          # "up" or "down"
            "user_comment":     req.user_comment or "",
        }
        with open(FEEDBACK_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        logger.info(f"Feedback saved: {req.user_vote} for verdict '{req.model_verdict}'")
        return {"ok": True, "message": "Thank you for your feedback!"}
    except Exception as e:
        logger.error(f"Error saving feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/feedback/stats")
async def feedback_stats():
    """Aggregate feedback stats — useful for model improvement analysis."""
    if not FEEDBACK_FILE.exists():
        return {"total": 0, "thumbs_up": 0, "thumbs_down": 0, "accuracy_rate": None, "by_verdict": {}, "recent": []}
    entries = []
    with open(FEEDBACK_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try: entries.append(json.loads(line))
                except json.JSONDecodeError: pass
    thumbs_up   = sum(1 for e in entries if e.get("user_vote") == "up")
    thumbs_down = sum(1 for e in entries if e.get("user_vote") == "down")
    total = len(entries)
    by_verdict: dict = {}
    for e in entries:
        v = e.get("model_verdict", "Unknown")
        if v not in by_verdict:
            by_verdict[v] = {"up": 0, "down": 0}
        by_verdict[v][e.get("user_vote", "up")] += 1
    return {
        "total":         total,
        "thumbs_up":     thumbs_up,
        "thumbs_down":   thumbs_down,
        "accuracy_rate": round(thumbs_up / total, 3) if total else None,
        "by_verdict":    by_verdict,
        "recent":        entries[-20:][::-1],   # latest 20, newest first
    }

@app.post("/api/rebuild-index")
async def rebuild_index():
    """Rebuild the FAISS index from WELFake dataset (admin endpoint)"""
    try:
        if not welfake_service.load_dataset(max_articles=settings.MAX_ARTICLES_TO_INDEX):
            raise HTTPException(
                status_code=404, 
                detail="WELFake dataset not found. Please download from Kaggle."
            )
        
        articles = welfake_service.get_articles()
        retrieval_service.build_index(articles)
        
        return {
            "message": "Index rebuilt successfully",
            "articles_count": len(articles),
            "stats": welfake_service.get_stats()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/retrain-ml")
async def retrain_ml():
    """Retrain the ML classifier (admin endpoint)"""
    try:
        success = ml_classifier.train(force_retrain=True)
        if success:
            return {
                "message": "ML classifier retrained successfully",
                "accuracy": ml_classifier.accuracy
            }
        else:
            raise HTTPException(
                status_code=500, 
                detail="Failed to retrain ML classifier. Check if dataset is available."
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ocr-verify")
async def ocr_verify(file: UploadFile = File(...)):
    """
    Accept an image upload, use Groq Vision to extract the headline/claim,
    then run it through the full existing verify pipeline.
    """
    # ── Validate file type ────────────────────────────────────────────────────
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Please upload a JPEG, PNG, or WEBP image."
        )

    try:
        # ── Read image ────────────────────────────────────────────────────────
        image_bytes = await file.read()

        # Enforce 8 MB size limit
        if len(image_bytes) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image too large. Maximum size is 8 MB.")

        logger.info(f"OCR verify: received image {file.filename!r} ({len(image_bytes)//1024} KB)")

        # ── Pre-process image with Pillow ─────────────────────────────────────
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Scale up small images to help OCR accuracy
        w, h = pil_img.size
        if w < 800:
            scale = 800 / w
            pil_img = pil_img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
            logger.info(f"Upscaled image to {pil_img.size}")

        img_array = np.array(pil_img)

        # ── Run local EasyOCR (blocking → thread pool) ────────────────────────
        reader = get_ocr_reader()
        logger.info("Running EasyOCR on image...")
        ocr_results = await asyncio.to_thread(
            reader.readtext, img_array, detail=1, paragraph=False
        )
        logger.info(f"EasyOCR found {len(ocr_results)} text regions")

        # Filter low-confidence detections (< 25%) and sort top-to-bottom
        confident = [(bbox, text, conf) for bbox, text, conf in ocr_results if conf >= 0.25]
        confident.sort(key=lambda r: r[0][0][1])  # sort by y-coordinate of top-left corner

        raw_ocr_text = " ".join(text for _, text, _ in confident).strip()
        logger.info(f"Raw OCR text ({len(raw_ocr_text)} chars): {raw_ocr_text[:150]!r}...")

        if not raw_ocr_text:
            raise HTTPException(
                status_code=422,
                detail="Could not extract any text from the image. Try a clearer screenshot with visible text.",
            )

        # Step 2: LLM cleans the garbled OCR dump -> returns single clean headline
        # EasyOCR reads ALL text (body, captions, URLs, menus). The LLM distills
        # it down to just the main factual claim so the verify pipeline gets
        # a proper headline, not a wall of noise.
        logger.info("Extracting headline from raw OCR using LLM...")
        from groq import Groq
        groq_client = Groq(api_key=settings.GROQ_API_KEY)

        def _call_groq_cleanup():
            return groq_client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a headline extraction assistant. "
                            "You receive raw OCR text scraped from a news article or social media screenshot. "
                            "The OCR often contains garbled characters, repeated sentences, URLs, nav menus, and article body text. "
                            "Your ONLY job: identify and return the single main news HEADLINE or factual CLAIM. "
                            "Rules: return ONLY the clean headline text, nothing else. "
                            "Fix obvious OCR typos. If no verifiable claim exists, return exactly: NO_CLAIM_FOUND"
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Raw OCR text from image:\n\n{raw_ocr_text[:3000]}"
                    }
                ],
                temperature=0.1,
                max_tokens=120,
                timeout=30,
            )

        cleanup_resp = await asyncio.to_thread(_call_groq_cleanup)
        extracted_text = cleanup_resp.choices[0].message.content.strip().strip('"\'')
        logger.info(f"LLM cleaned headline: {extracted_text!r}")

        if not extracted_text or extracted_text.upper() == "NO_CLAIM_FOUND":
            raise HTTPException(
                status_code=422,
                detail="Could not identify a verifiable headline in the image. Try a screenshot with a clear headline.",
            )

        # ── Pipe extracted text through the existing verify pipeline ──────────
        verify_request = VerificationRequest(headline=extracted_text, language="en")
        result = await verify_news(verify_request)

        result_dict = result.dict()
        result_dict["extracted_text"] = extracted_text
        result_dict["source"] = "image_ocr"

        # ── Record image-sourced verification ────────────────────────────
        try:
            record_verification(
                headline=extracted_text,
                credibility=result.credibility.value,
                confidence=result.confidence,
                score_breakdown=result.score_breakdown,
                source="image_ocr",
            )
        except Exception as ae:
            logger.warning(f"Analytics record skipped: {ae}")

        return result_dict

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR verify error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Image Forensics ─────────────────────────────────────────────────────────

@app.post("/api/image-forensics")
async def image_forensics(file: UploadFile = File(...)):
    """
    Run ELA (Error Level Analysis) + EXIF metadata extraction on an uploaded image.
    Returns forensic signals that can indicate manipulation or deepfake editing.
    No third-party AI API needed — 100% local Pillow operations.
    """
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported type: {file.content_type}. Use JPEG, PNG, or WEBP.",
        )
    try:
        image_bytes = await file.read()
        if len(image_bytes) > 15 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image too large (max 15 MB).")

        logger.info(f"Image forensics: {file.filename!r} ({len(image_bytes)//1024} KB)")

        ela_result  = run_ela(image_bytes)
        exif_result = run_exif(image_bytes)

        # Aggregate overall risk
        risk_scores = {"low": 1, "medium": 2, "high": 3, "unknown": 1}
        ela_risk  = risk_scores.get(ela_result.get("suspicion",  "unknown"), 1)
        exif_risk = risk_scores.get(exif_result.get("risk_level", "unknown"), 1)
        combined  = max(ela_risk, exif_risk)
        overall_risk = {1: "low", 2: "medium", 3: "high"}.get(combined, "unknown")

        return {
            "filename": file.filename,
            "ela":  ela_result,
            "exif": exif_result,
            "overall_risk": overall_risk,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image forensics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Analytics / Trend Dashboard ─────────────────────────────────────────────

@app.get("/api/analytics")
async def analytics_dashboard():
    """
    Aggregated statistics over all verifications stored in the local SQLite DB.
    Powers the Trend Dashboard tab on the frontend.
    """
    try:
        return get_dashboard_data()
    except Exception as e:
        logger.error(f"Analytics endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dataset-stats")
async def dataset_statistics():
    """
    Real-world misinformation intelligence mined from the WELFake dataset
    (72k labeled news articles). Powers the Dataset Intelligence section
    of the Dashboard tab.
    """
    try:
        return get_dataset_stats()
    except Exception as e:
        logger.error(f"Dataset stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Conversational chat endpoint for discussing news topics and fact-checking"""
    try:
        reply = await asyncio.to_thread(
            chat_service.chat,
            message=request.message,
            history=request.history
        )

        # Build updated history: append the new user message + assistant reply
        updated_history = list(request.history) + [
            ChatMessage(role="user", content=request.message),
            ChatMessage(role="assistant", content=reply)
        ]

        return ChatResponse(reply=reply, history=updated_history)

    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)