# 🛡️ VeriFact AI — AI-Powered Fake News Verifier

> An intelligent, full-stack fact-checking platform built with **FastAPI + React** using **RAG (Retrieval-Augmented Generation)**, a trained **ML classifier**, **LLM analysis** via Groq, and **image forensics** — all running together to combat misinformation.

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Groq](https://img.shields.io/badge/LLM-Groq%20LLaMA%203-orange)
![FAISS](https://img.shields.io/badge/Search-FAISS-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 📋 Table of Contents

1. [Features](#-features)
2. [System Architecture](#-system-architecture)
3. [How It Works — Deep Dive](#-how-it-works--deep-dive)
   - [Headline Verification Pipeline](#1-headline-verification-pipeline)
   - [ML Classifier](#2-ml-classifier-tf-idf--logistic-regression)
   - [RAG Semantic Search](#3-rag-semantic-search-faiss--sentence-transformers)
   - [LLM Analysis](#4-llm-analysis-groq--llama-33-70b)
   - [Score Fusion & Final Verdict](#5-score-fusion--final-verdict)
   - [Image Fact-Checking (OCR)](#6-image-fact-checking-easyocr--groq-vision)
   - [Image Forensics (ELA + EXIF)](#7-image-forensics-ela--exif)
   - [AI Chat Assistant](#8-ai-chat-assistant)
   - [Analytics Dashboard](#9-analytics-dashboard)
4. [Tech Stack](#-tech-stack)
5. [Project Structure](#-project-structure)
6. [Local Setup](#-local-setup)
7. [Deployment](#-deployment)
8. [API Reference](#-api-reference)
9. [Dataset](#-dataset-welfake)
10. [License](#-license)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 **Headline Verifier** | Paste any news headline → get a **True / Fake / Unverified** verdict with a full confidence score breakdown |
| 🖼️ **Image Fact-Check** | Upload a news screenshot → EasyOCR extracts the text → LLM cleans it → runs through the full verification pipeline |
| 🔬 **Image Forensics** | Error Level Analysis (ELA) + EXIF metadata inspection to detect manipulated or deepfake images |
| 💬 **AI Chat** | Conversational fact-checking assistant powered by Groq's LLaMA 3 model |
| 📊 **Trend Dashboard** | Real-time analytics dashboard showing verdict trends, keyword clouds, hourly activity, and WELFake dataset intelligence |
| 🌐 **Hindi Support** | Input headlines in Hindi (auto-translated to English before verification) or translate results back to Hindi |
| 🗳️ **User Feedback** | Thumbs up/down on each result — votes are stored and tracked to measure model accuracy |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Headline │  │  Image   │  │  Image   │  │   AI     │   │
│  │ Verifier │  │ OCR Tab  │  │Forensics │  │   Chat   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼──────────────┼──────────┘
        │  REST API (fetch)         │              │
        ▼             ▼             ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI)                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Verification Pipeline                   │    │
│  │                                                      │    │
│  │   Input Headline                                     │    │
│  │        │                                             │    │
│  │        ▼                                             │    │
│  │  ┌─────────────┐    ┌──────────────────────────┐    │    │
│  │  │  ML Classifier│  │  FAISS Semantic Search   │    │    │
│  │  │ TF-IDF +     │  │  (all-MiniLM-L6-v2)      │    │    │
│  │  │ Logistic Reg │  │  → top-5 similar articles │    │    │
│  │  └──────┬───────┘  └────────────┬─────────────┘    │    │
│  │         │                       │                   │    │
│  │         ▼                       ▼                   │    │
│  │  ┌─────────────────────────────────────────────┐   │    │
│  │  │         Score Fusion Engine                  │   │    │
│  │  │  ML Score + LLM Score + Evidence Score       │   │    │
│  │  │  → Final Verdict: True / Fake / Unverified   │   │    │
│  │  └─────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ EasyOCR     │  │ Image ELA +  │  │  SQLite Analytics│   │
│  │ + Groq LLM  │  │ EXIF Forensics│ │  + Dataset Stats │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        │                    │
        ▼                    ▼
 ┌────────────┐      ┌────────────────┐
 │ Groq Cloud │      │ WELFake 72k    │
 │ LLaMA 3.3  │      │ Article Dataset│
 │ 70B model  │      │ (local CSV)    │
 └────────────┘      └────────────────┘
```

---

## 🧠 How It Works — Deep Dive

### 1. Headline Verification Pipeline

When a user submits a headline, the backend runs a **multi-stage hybrid pipeline** that combines machine learning, semantic search, and LLM reasoning:

```
User Input: "Scientists confirm vaccines cause autism"
      │
      ▼
[Step 0] Language Detection
      │ If Hindi → Google Translate → English
      ▼
[Step 1] ML Classifier (fast, ~5ms)
      │ TF-IDF vectorization + Logistic Regression
      │ Returns: prediction="Fake", confidence=0.94
      ▼
[Step 2] FAISS Semantic Retrieval
      │ Embed headline with all-MiniLM-L6-v2 (384-dim vector)
      │ Search 3000-article FAISS index (L2 distance)
      │ Returns: top-5 most similar articles with scores
      ▼
[Step 3] Decision Engine
      │ IF ML confidence > 85% → use ML result directly
      │ ELSE → call Groq LLM with retrieved evidence (RAG)
      ▼
[Step 4] Score Fusion
      │ Combine ML score + LLM score + evidence similarity
      │ If ML and LLM agree → boost confidence by 10%
      ▼
[Step 5] Response
      Verdict: FAKE (94% confidence)
      Explanation: "ML classifier (93.1% accuracy) classified
      this as FAKE with 94% confidence. Found 5 related articles."
      Score Breakdown: ml=0.94, llm=0.0, evidence=0.73
```

---

### 2. ML Classifier (TF-IDF + Logistic Regression)

**File:** `backend/app/services/ml_classifier.py`

This is the primary, fastest layer of verification. It is a classical NLP classification pipeline trained on 44,000+ labeled news articles.

#### Training Process:
1. **Data Loading** — Loads `True.csv` and `Fake.csv` datasets (or falls back to `WELFake_Dataset.csv`). Labels are assigned: `1 = Real`, `0 = Fake`.
2. **Text Preprocessing** — Each article title + body is cleaned:
   - Strip non-alphabetic characters
   - Convert to lowercase
   - Remove English stopwords (via NLTK)
   - Apply Porter Stemming (reduces words to their root form, e.g., "running" → "run")
3. **TF-IDF Vectorization** — Converts text to a sparse numerical matrix using the top **50,000 features** (word/n-gram frequencies weighted by how unique they are across documents).
4. **Logistic Regression** — Trained on an 80/20 train/test split with stratification. Uses `max_iter=1000`, `n_jobs=-1` (all CPU cores).
5. **Caching** — The trained model is serialized to `ml_model.pkl` and `ml_vectorizer.pkl` so the server loads it instantly on restart instead of retraining.

#### Prediction:
```python
# For a new headline:
processed = stemmer.stem(remove_stopwords(headline))
X = vectorizer.transform([processed])       # sparse 50k-dim vector
proba = model.predict_proba(X)[0]           # [fake_prob, real_prob]
confidence = max(proba)                     # e.g., 0.94
label = "True" if prediction == 1 else "Fake"
```

**Accuracy: ~93-98%** depending on which dataset is used (True.csv/Fake.csv gives higher accuracy than WELFake alone).

---

### 3. RAG Semantic Search (FAISS + Sentence Transformers)

**File:** `backend/app/services/retrieval.py` + `embeddings.py`

RAG (Retrieval-Augmented Generation) grounds the LLM's response in real evidence instead of letting it hallucinate. Here's how it works:

#### Index Building (done once at startup):
1. Load up to `MAX_ARTICLES_TO_INDEX` (default: 3,000) articles from the WELFake dataset
2. For each article, concatenate: `title + ". " + content`
3. Pass through **`all-MiniLM-L6-v2`** (a 22M-parameter sentence transformer) → produces a **384-dimensional float vector** per article
4. All vectors are added to a **FAISS `IndexFlatL2`** index (exact L2 nearest-neighbor search)
5. The index and articles are saved to disk so they survive server restarts

#### Retrieval (per query):
1. The user's headline is embedded with the same model → one 384-dim vector
2. FAISS searches the entire index in milliseconds using L2 distance
3. Top-5 nearest articles are returned
4. L2 distance is converted to a similarity score: `similarity = 1 / (1 + distance)` → range [0, 1]

```
Query: "WHO declares new pandemic"
       ↓ embed (384 floats)
FAISS search across 3,000 vectors
       ↓
Result 1: "WHO warns of emerging disease X" (score: 0.87)
Result 2: "Global health alert issued by WHO" (score: 0.81)
Result 3: "Pandemic preparedness report 2023" (score: 0.74)
...
```

---

### 4. LLM Analysis (Groq + LLaMA 3.3 70B)

**File:** `backend/app/services/llm_service.py`

The LLM is invoked when the ML classifier's confidence is **below 85%**, or when a human-readable explanation is needed alongside high-confidence ML results.

#### RAG Prompt Construction:
The system builds a structured prompt that contains:
- The news headline to verify
- The top-5 retrieved articles as context (title + first 500 chars)
- Strict instructions to only judge based on the provided evidence
- A required JSON output format

```
System: "You are a fact-checking AI assistant. Always respond with valid JSON."

User: """
News Headline to Verify: "Vaccines linked to autism, new study claims"

Retrieved Evidence from Trusted Sources:
Source 1 (WELFake):
  Title: CDC confirms no link between vaccines and autism
  Content: Multiple peer-reviewed studies spanning 20 years...

Source 2 (WELFake):
  Title: Anti-vaccine claims debunked by Harvard researchers
  Content: ...

[Instructions to return JSON: credibility, explanation, confidence]
"""
```

The LLM responds with:
```json
{
  "credibility": "Fake",
  "explanation": "The retrieved evidence explicitly contradicts the headline. Multiple peer-reviewed studies and CDC data confirm no causal link between vaccines and autism.",
  "confidence": 0.95
}
```

**Model used:** `llama-3.3-70b-versatile` via Groq's ultra-fast inference API (typically < 2 seconds response time).

---

### 5. Score Fusion & Final Verdict

**File:** `backend/app/main.py` — `verify_news()` function

The three scores are combined with the following logic:

```python
# Decision tree:
if ml_confidence > 0.85:
    # Trust ML directly — fast path, no LLM call needed
    verdict = ml_prediction
    confidence = ml_confidence

elif evidence_available:
    # Call LLM with RAG evidence
    llm_result = llm_service.verify(headline, evidence)
    verdict = llm_result["credibility"]
    confidence = llm_result["confidence"]

    # If ML agrees with LLM → boost confidence by 10%
    if ml_agrees_with_llm:
        confidence = min(1.0, confidence + 0.10)

else:
    # No evidence, low ML confidence
    verdict = ml_prediction
    confidence = ml_confidence * 0.8  # penalty for low certainty
```

The final response includes a `score_breakdown`:
```json
{
  "ml_score": 0.94,
  "llm_score": 0.0,
  "evidence_score": 0.73
}
```
This breakdown is visualized as a **conic-gradient donut chart** on the frontend.

---

### 6. Image Fact-Checking (EasyOCR + Groq Vision)

**File:** `backend/app/main.py` — `/api/ocr-verify` endpoint

This allows users to upload a **screenshot of a news article** or **social media post** and have it fact-checked automatically.

#### Pipeline:
```
User uploads image (PNG/JPG/WEBP, max 8 MB)
        │
        ▼
[Step 1] Pillow pre-processing
        │ Convert to RGB
        │ Upscale if width < 800px (for better OCR)
        ▼
[Step 2] EasyOCR (local, no API needed)
        │ Runs a deep learning OCR model (~120MB, downloaded once)
        │ GPU=False (CPU mode for compatibility)
        │ Filters detections with confidence < 25%
        │ Sorts text regions top-to-bottom by Y coordinate
        │ Joins into raw OCR text string
        ▼
[Step 3] Groq LLM — Headline Extraction
        │ Raw OCR contains: article body, navigation menus,
        │   URLs, ads, captions, dates — all mixed together
        │ LLM prompt: "Extract ONLY the main news headline from this OCR dump"
        │ Returns: single clean headline string, or "NO_CLAIM_FOUND"
        ▼
[Step 4] Standard verification pipeline
        │ (same as text input: ML → FAISS → LLM → Score Fusion)
        ▼
Response includes: extracted_text, credibility, confidence, evidence, source="image_ocr"
```

---

### 7. Image Forensics (ELA + EXIF)

**File:** `backend/app/services/image_forensics.py`

This module detects whether an image has been **digitally manipulated** — useful for detecting deepfakes, spliced photos, and edited news images. It works entirely **locally** with no external API.

#### Error Level Analysis (ELA):

ELA exploits the fact that **JPEG compression is lossy and non-uniform**. When an image is re-saved at a lower quality, unedited regions compress to a predictable low error level. **Edited/spliced regions retain higher error levels** because they were compressed at a different time.

```
Algorithm:
1. Load original image
2. Re-save at JPEG quality=75 to a buffer
3. Compute pixel-wise absolute difference: |original - resaved|
4. Amplify the difference: scale so max pixel maps to 255
5. Apply 3x contrast enhancement
6. Encode as PNG base64 (returned as data URI for browser display)

Suspicion thresholds (empirical):
  mean_error > 18  → HIGH suspicion ("Likely Manipulated")
  mean_error > 8   → MEDIUM suspicion ("Possibly Edited")
  mean_error ≤ 8   → LOW suspicion ("Appears Authentic")
```

#### EXIF Metadata Analysis:

EXIF data is embedded by cameras in every photo. The system reads all EXIF tags and flags suspicious patterns:

| Flag | What It Means |
|---|---|
| Editing software detected (Photoshop, GIMP, etc.) | Image was processed through editing software |
| No camera make/model | Image may be a screenshot or AI-generated |
| Timestamp mismatch (DateTimeOriginal ≠ DateTime) | File was modified after original capture |
| No EXIF data at all | Could be a screenshot or metadata was deliberately stripped |

The overall risk level is determined by the combination of ELA and EXIF results:
```python
overall_risk = max(ela_risk, exif_risk)  # worst case wins
```

---

### 8. AI Chat Assistant

**File:** `backend/app/services/chat_service.py`

A conversational interface powered by Groq's LLaMA model. Unlike the verifier (which is purely evidence-based), the chat endpoint allows open-ended discussion about:
- Misinformation tactics and how to spot them
- Media literacy topics
- Follow-up questions about verification results
- General fact-checking guidance

The chat maintains a **conversation history** (sent with each request) so the LLM has context from previous messages in the session.

---

### 9. Analytics Dashboard

**File:** `backend/app/services/analytics_service.py`

Every verification (text or image) is recorded into a local **SQLite database** (`analytics.db`). The dashboard aggregates this data in real time.

#### What's tracked per verification:
```sql
CREATE TABLE verifications (
    id          INTEGER PRIMARY KEY,
    ts          TEXT,        -- ISO timestamp (UTC)
    headline    TEXT,
    credibility TEXT,        -- "True" | "Fake" | "Unverified"
    confidence  REAL,
    ml_score    REAL,
    llm_score   REAL,
    evidence_score REAL,
    source      TEXT         -- "text" | "image_ocr"
);
```

#### Dashboard metrics computed:
- **Verdict distribution** — True / Fake / Unverified counts
- **Confidence distribution** — bucketed histogram (0-20%, 20-40%, etc.)
- **Daily trend** — last 14 days of verifications by verdict
- **Hourly activity** — 24-hour activity heatmap
- **Top keywords** — most frequent meaningful words across all headlines (fake-specific and overall)
- **Average confidence by verdict** — how confident the model is for each outcome

#### Dataset Intelligence (WELFake stats):
- Reads the 72,134-article WELFake CSV in 5,000-row chunks (memory-safe)
- Computes: fake %, real %, fake keyword cloud, real keyword cloud, topic-wise fake rates
- Results are **cached for 24 hours** in `dataset_stats_cache.json` so the CSV isn't re-read on every dashboard load

---

## 🔧 Tech Stack

### Backend
| Library | Purpose |
|---|---|
| **FastAPI** | Async REST API framework |
| **Uvicorn** | ASGI server |
| **sentence-transformers** | `all-MiniLM-L6-v2` for 384-dim text embeddings |
| **FAISS (faiss-cpu)** | Billion-scale vector similarity search |
| **scikit-learn** | TF-IDF vectorizer + Logistic Regression classifier |
| **NLTK** | Stopword removal + Porter stemming |
| **Groq SDK** | LLaMA 3.3 70B inference (fast, free tier available) |
| **EasyOCR** | Deep learning OCR for image text extraction |
| **Pillow (PIL)** | Image processing for ELA forensics |
| **pandas** | Dataset loading + analytics aggregation |
| **SQLite** | Lightweight analytics database (no setup needed) |
| **deep-translator** | Hindi ↔ English translation via Google Translate |
| **python-dotenv** | Environment variable management |
| **Pydantic** | Request/response schema validation |

### Frontend
| Library | Purpose |
|---|---|
| **React 18** | UI framework |
| **Vite** | Blazing-fast dev server + build tool |
| **Tailwind CSS** | Utility-first CSS (dev dependency) |
| **html2canvas** | Screenshot the result card for sharing |
| **Recharts** | Chart library (used for dashboard) |

---

## 📁 Project Structure

```
fake-news-verifier/
├── backend/
│   ├── Procfile                      # Render deployment start command
│   ├── requirements.txt              # Python dependencies
│   ├── .env.example                  # Environment variable template
│   └── app/
│       ├── main.py                   # All API routes (verify, OCR, forensics, chat, analytics)
│       ├── models.py                 # Pydantic request/response schemas
│       ├── config.py                 # Settings loaded from .env
│       ├── data/
│       │   ├── ml_model.pkl          # Pre-trained Logistic Regression model
│       │   ├── ml_vectorizer.pkl     # Pre-trained TF-IDF vectorizer
│       │   ├── faiss_index/          # FAISS index (built from dataset on first run)
│       │   ├── news_articles.json    # Indexed articles (for retrieval results)
│       │   ├── analytics.db          # SQLite analytics database
│       │   └── *.csv                 # WELFake dataset (NOT committed — too large)
│       └── services/
│           ├── ml_classifier.py      # TF-IDF + Logistic Regression
│           ├── retrieval.py          # FAISS index build + semantic search
│           ├── embeddings.py         # Sentence Transformer wrapper
│           ├── llm_service.py        # Groq LLM prompt + response parsing
│           ├── welfake_service.py    # WELFake CSV loader + article extractor
│           ├── chat_service.py       # Conversational chat logic
│           ├── analytics_service.py  # SQLite record + dashboard aggregation
│           ├── image_forensics.py    # ELA + EXIF analysis
│           ├── news_api.py           # NewsAPI integration (optional)
│           └── news_scraper.py       # Web scraping fallback
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── .env.example                  # VITE_API_URL template
    └── src/
        ├── App.jsx                   # Entire React app (2200+ lines)
        └── index.css                 # Global styles + animations
```

---

## 🚀 Local Setup

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **A free Groq API key** → https://console.groq.com/ (sign up, create API key, free tier is generous)
- *(Optional)* A free [NewsAPI key](https://newsapi.org/)

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/verifact-ai.git
cd verifact-ai
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
copy .env.example .env         # Windows
# cp .env.example .env         # macOS/Linux
```

Edit `backend/.env`:
```env
GROQ_API_KEY=your_groq_api_key_here
NEWS_API_KEY=your_newsapi_key_here     # optional
LLM_PROVIDER=groq
HOST=0.0.0.0
PORT=8080
MAX_ARTICLES_TO_INDEX=3000
```

Start the backend:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

> **Note on the Dataset:** The WELFake CSV files (`True.csv`, `Fake.csv`, `WELFake_Dataset.csv`) are **not committed to GitHub** because they are 300 MB+. The app works without them — the pre-trained `ml_model.pkl` is committed so the ML classifier loads instantly. The FAISS index (semantic search) requires the dataset to build on first run. Without it, only ML + LLM verification is available.
>
> To enable full RAG, download from Kaggle: https://www.kaggle.com/datasets/saurabhshahane/fake-news-classification and place all CSV files in `backend/app/data/`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 🌐 Deployment

### Frontend → Vercel (Free)
1. Push code to GitHub
2. Import repo at https://vercel.com
3. Set **Root Directory** to `frontend`
4. Add environment variable: `VITE_API_URL` = `https://your-backend.onrender.com`
5. Deploy → get a `*.vercel.app` URL instantly

### Backend → Render (Free Tier)
1. Create a new **Web Service** at https://render.com
2. Set **Root Directory** to `backend`
3. **Build Command:** `pip install -r requirements.txt`
4. **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables: `GROQ_API_KEY`, `LLM_PROVIDER=groq`, `MAX_ARTICLES_TO_INDEX=3000`

> **Free tier note:** Render spins down inactive services after 15 minutes. The first request after inactivity takes ~30–60 seconds to wake up.

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check — shows index status, ML accuracy |
| `POST` | `/api/verify` | Verify a text headline |
| `POST` | `/api/ocr-verify` | Upload image → OCR → verify |
| `POST` | `/api/image-forensics` | Upload image → ELA + EXIF analysis |
| `POST` | `/api/chat` | Send message to AI chat assistant |
| `POST` | `/api/translate` | Translate text to Hindi (or any language) |
| `POST` | `/api/feedback` | Submit thumbs up/down on a result |
| `GET` | `/api/feedback/stats` | Get aggregated user feedback stats |
| `GET` | `/api/analytics` | Get dashboard data (trends, verdicts, keywords) |
| `GET` | `/api/dataset-stats` | Get WELFake dataset intelligence |
| `POST` | `/api/rebuild-index` | Admin: rebuild FAISS index from dataset |
| `POST` | `/api/retrain-ml` | Admin: retrain ML classifier |

### Example: Verify a Headline
```bash
curl -X POST https://your-api.onrender.com/api/verify \
  -H "Content-Type: application/json" \
  -d '{"headline": "Scientists discover cure for cancer", "language": "en"}'
```

Response:
```json
{
  "headline": "Scientists discover cure for cancer",
  "credibility": "Unverified",
  "confidence": 0.61,
  "explanation": "ML classifier classified this as potentially fake with moderate confidence. No directly matching evidence was found in the database to confirm or deny this specific claim.",
  "evidence": [...],
  "score_breakdown": {
    "ml_score": 0.61,
    "llm_score": 0.0,
    "evidence_score": 0.43
  },
  "translated_headline": null
}
```

---

## 📊 Dataset: WELFake

The project uses the **WELFake dataset** from Kaggle:
- **72,134** labeled news articles
- **Binary labels:** 0 = Real, 1 = Fake
- Sources: Kaggle, McIntire, Reuters, BuzzFeed Political
- Fields: `title`, `text`, `label`

The dataset powers:
1. **ML Classifier training** — all 72k articles used for TF-IDF + Logistic Regression
2. **FAISS semantic index** — first N articles (configurable, default 3,000) indexed for RAG
3. **Dataset Intelligence dashboard** — topic-wise fake rates, keyword analysis, title length distribution

> Download: https://www.kaggle.com/datasets/saurabhshahane/fake-news-classification

---

## 📄 License

MIT License — feel free to use, fork, and build upon this project.

```
MIT License

Copyright (c) 2024 VeriFact AI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software.
```

---

## 🙏 Acknowledgements

- [WELFake Dataset](https://www.kaggle.com/datasets/saurabhshahane/fake-news-classification) — Saurabh Shahane (Kaggle)
- [Groq](https://groq.com/) — Ultra-fast LLaMA 3 inference
- [FAISS](https://github.com/facebookresearch/faiss) — Meta AI Research
- [Sentence Transformers](https://www.sbert.net/) — UKP Lab
- [EasyOCR](https://github.com/JaidedAI/EasyOCR) — Jaided AI

---

*Built as a Final Year Major Project — demonstrating the power of hybrid AI systems (RAG + ML + LLM) for real-world misinformation detection.*
