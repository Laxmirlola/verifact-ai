import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";

// ─── API Base URL (set VITE_API_URL in .env for production) ─────────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

// ─── Pure-CSS Confidence Donut (no external chart library) ──────────────────
const SIGNALS = [
  { key: "ml_score",       color: "#8b5cf6", label: "ML Classifier",  icon: "🤖" },
  { key: "llm_score",      color: "#06b6d4", label: "LLM Analysis",   icon: "💡" },
  { key: "evidence_score", color: "#10b981", label: "Evidence Match", icon: "📚" },
];

function ConfidenceChart({ breakdown, overallConfidence }) {
  if (!breakdown) return null;

  const ml  = breakdown.ml_score       ?? 0;
  const llm = breakdown.llm_score      ?? 0;
  const ev  = breakdown.evidence_score ?? 0;
  const total = ml + llm + ev || 1;

  // conic-gradient percentages (each fills its slice)
  const mlPct  = (ml  / total) * 100;
  const llmPct = (llm / total) * 100;
  const evPct  = (ev  / total) * 100;
  const gap = 2; // 2% gap between slices

  // Adjust slices to leave gap
  let c1s = 0,            c1e = Math.max(0, mlPct  - gap);
  let c2s = mlPct,        c2e = Math.max(mlPct,  mlPct  + llmPct - gap);
  let c3s = mlPct+llmPct, c3e = Math.max(mlPct+llmPct, mlPct+llmPct+evPct-gap);

  const gradient = `conic-gradient(
    #8b5cf6 ${c1s}% ${c1e}%,
    transparent ${c1e}% ${mlPct}%,
    #06b6d4 ${c2s}% ${c2e}%,
    transparent ${c2e}% ${mlPct+llmPct}%,
    #10b981 ${c3s}% ${c3e}%,
    transparent ${c3e}% 100%
  )`;

  return (
    <div style={{ marginTop: 20, padding: "20px", borderRadius: 16, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(245,200,66,0.22)" }}>
      <p style={{ color: "#7a5c3c", fontSize: 13, marginBottom: 16, fontWeight: 600, fontFamily:"'Nunito',sans-serif" }}>📊 Confidence Score Breakdown</p>
      <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }} className="confidence-chart-inner">

        {/* Donut using CSS conic-gradient — zero dependencies */}
        <div style={{ position: "relative", width: 150, height: 150, flexShrink: 0 }}>
          <div style={{
            width: 150, height: 150, borderRadius: "50%",
            background: gradient,
            transition: "background 0.8s ease",
          }} />
          {/* Inner circle cutout */}
          <div style={{
            position: "absolute", top: 22, left: 22,
            width: 106, height: 106, borderRadius: "50%",
            background: "#fffbf0",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#2c1a06", lineHeight: 1, fontFamily:"'Nunito',sans-serif" }}>
              {Math.round(overallConfidence * 100)}%
            </span>
            <span style={{ fontSize: 10, color: "#a07050", marginTop: 3, fontFamily:"'Nunito',sans-serif" }}>Overall</span>
          </div>
        </div>

        {/* Legend + mini bars */}
        <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 14 }}>
          {SIGNALS.map(({ key, color, label, icon }) => {
            const value = breakdown[key] ?? 0;
            return (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#4a3018", fontFamily:"'Nunito',sans-serif" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                    {icon} {label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color }}>{Math.round(value * 100)}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${value * 100}%`, borderRadius: 3, background: color, transition: "width 1s ease-out" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Share Card (rendered off-screen → PNG download) ──────────────────────────
const VERDICT_STYLES = {
  True:       { bg: "#064e3b", border: "#10b981", badge: "#10b981", icon: "✓", label: "VERIFIED TRUE" },
  Fake:       { bg: "#4c0519", border: "#f43f5e", badge: "#f43f5e", icon: "✗", label: "LIKELY FAKE"   },
  Unverified: { bg: "#451a03", border: "#f59e0b", badge: "#f59e0b", icon: "?", label: "UNVERIFIED"    },
};

const ShareCard = ({ result, cardRef }) => {
  if (!result) return null;
  const vs = VERDICT_STYLES[result.credibility] ?? VERDICT_STYLES.Unverified;
  const ml  = result.score_breakdown?.ml_score       ?? 0;
  const llm = result.score_breakdown?.llm_score      ?? 0;
  const ev  = result.score_breakdown?.evidence_score ?? 0;

  return (
    <div ref={cardRef} style={{
      position: "fixed", left: "-9999px", top: 0,   // off-screen
      width: 680, padding: "36px",
      background: "linear-gradient(135deg,#fffbf0,#fff5f8,#fffde8)",
      fontFamily: "'Nunito', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 28 }}>
        <div style={{ display:"flex", alignItems:"center", gap: 12 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:"linear-gradient(135deg,#7c3aed,#6d28d9)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ color:"white", fontSize:20 }}>🛡️</span>
          </div>
          <div>
            <p style={{ color:"#2c1a06", fontWeight:700, fontSize:16, margin:0, fontFamily:"'Playfair Display',serif" }}>VeriFact AI</p>
            <p style={{ color:"#7a5c3c", fontSize:12, margin:0, fontFamily:"'Nunito',sans-serif" }}>AI-Powered Fact Check Result</p>
          </div>
        </div>
        <p style={{ color:"#a07050", fontSize:12, margin:0, fontFamily:"'Nunito',sans-serif" }}>{new Date().toLocaleDateString("en-IN", { year:"numeric", month:"short", day:"numeric" })}</p>
      </div>

      {/* Verdict banner */}
      <div style={{ background: vs.bg, border:`2px solid ${vs.border}`, borderRadius:16, padding:"20px 24px", marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <span style={{ width:44, height:44, borderRadius:"50%", background:vs.badge, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:22, fontWeight:700, flexShrink:0 }}>{vs.icon}</span>
          <div style={{ flex:1 }}>
            <span style={{ background:vs.badge, color:"white", borderRadius:8, padding:"3px 12px", fontSize:13, fontWeight:700 }}>{vs.label}</span>
            <p style={{ color:"#3a2010", fontSize:15, margin:"10px 0 0", fontStyle:"italic", lineHeight:1.5, fontFamily:"'Playfair Display',serif" }}>
              "{result.translated_headline ?? result.headline}"
            </p>
          </div>
        </div>
      </div>

      {/* Confidence row */}
      <div style={{ display:"flex", gap:12, marginBottom:20 }}>
        {[
          { label:"🤖 ML Score",      val: ml,  color:"#8b5cf6" },
          { label:"💡 LLM Score",     val: llm, color:"#06b6d4" },
          { label:"📚 Evidence",      val: ev,  color:"#10b981" },
          { label:"📊 Overall",       val: result.confidence, color:"#f59e0b" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ flex:1, background:"rgba(255,255,255,0.7)", borderRadius:12, padding:"12px 16px", border:"1px solid rgba(245,200,66,0.2)" }}>
            <p style={{ color, fontSize:11, margin:"0 0 4px", fontFamily:"'Nunito',sans-serif" }}>{label}</p>
            <p style={{ color:"#2c1a06", fontSize:20, fontWeight:700, margin:0, fontFamily:"'Nunito',sans-serif" }}>{Math.round(val*100)}%</p>
            <div style={{ height:4, borderRadius:2, background:"rgba(180,120,40,0.12)", marginTop:8 }}>
              <div style={{ height:"100%", width:`${val*100}%`, borderRadius:2, background:color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Explanation */}
      <div style={{ background:"rgba(255,248,220,0.7)", border:"1px solid rgba(245,200,66,0.25)", borderRadius:12, padding:"16px 20px", marginBottom:20 }}>
        <p style={{ color:"#a07050", fontSize:12, margin:"0 0 8px", fontFamily:"'Nunito',sans-serif", letterSpacing:"0.06em", fontWeight:700 }}>AI EXPLANATION</p>
        <p style={{ color:"#3a2010", fontSize:14, lineHeight:1.6, margin:0, fontFamily:"'Nunito',sans-serif" }}>{result.explanation}</p>
      </div>

      {/* Footer */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <p style={{ color:"#b08060", fontSize:11, margin:0, fontFamily:"'Nunito',sans-serif" }}>Verified by AI — Always cross-check with trusted sources</p>
        <p style={{ color:"#b08060", fontSize:11, margin:0, fontFamily:"'Nunito',sans-serif" }}>verifact.ai</p>
      </div>
    </div>
  );
};

// ─── Dashboard Chart Helpers (pure CSS / inline SVG — zero extra deps) ────────

function DailyBarChart({ data }) {
  const maxVal = Math.max(1, ...data.map(d => (d.True || 0) + (d.Fake || 0) + (d.Unverified || 0)));
  const W = Math.max(data.length * 60, 400);
  return (
    <div style={{ minWidth: W, height: 200, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160, paddingBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {data.map((d, i) => {
          const total = (d.True || 0) + (d.Fake || 0) + (d.Unverified || 0);
          const tH = total ? ((d.True || 0) / maxVal) * 140 : 0;
          const fH = total ? ((d.Fake || 0) / maxVal) * 140 : 0;
          const uH = total ? ((d.Unverified || 0) / maxVal) * 140 : 0;
          const label = d.day ? d.day.slice(5) : ""; // show MM-DD
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0, position: "relative" }} title={`${d.day}: True=${d.True||0}, Fake=${d.Fake||0}, Unverified=${d.Unverified||0}`}>
              <div style={{ display: "flex", flexDirection: "column-reverse", gap: 1, width: "100%", maxWidth: 36 }}>
                {tH > 0 && <div style={{ height: tH, background: "#10b981", borderRadius: "3px 3px 0 0", transition: "height 0.8s ease" }} />}
                {fH > 0 && <div style={{ height: fH, background: "#f43f5e", borderRadius: "3px 3px 0 0", transition: "height 0.8s ease" }} />}
                {uH > 0 && <div style={{ height: uH, background: "#f59e0b", borderRadius: "3px 3px 0 0", transition: "height 0.8s ease" }} />}
              </div>
              <p style={{ color: "#4b5563", fontSize: 9, position: "absolute", bottom: -20, whiteSpace: "nowrap" }}>{label}</p>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12 }}>
        {[{ color: "#10b981", label: "True" }, { color: "#f43f5e", label: "Fake" }, { color: "#f59e0b", label: "Unverified" }].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ color: "#6b7280", fontSize: 11 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeywordCloud({ words, color }) {
  const max = Math.max(1, ...words.map(w => w.count));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {words.map(({ word, count }) => {
        const ratio = count / max;
        const size = Math.round(11 + ratio * 14);
        const opacity = 0.4 + ratio * 0.6;
        return (
          <span key={word} title={`${count} occurrences`} style={{
            fontSize: size, fontWeight: ratio > 0.6 ? 700 : 500, color,
            opacity, padding: "3px 10px", borderRadius: 20,
            background: `${color}15`, border: `1px solid ${color}30`,
            cursor: "default", transition: "opacity 0.2s",
          }}>{word}</span>
        );
      })}
    </div>
  );
}

function ConfDistChart({ data }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map(({ range, count }) => {
        const pct = (count / max) * 100;
        const hue = parseInt(range) >= 60 ? "#10b981" : parseInt(range) >= 40 ? "#f59e0b" : "#f43f5e";
        return (
          <div key={range}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>{range}</span>
              <span style={{ color: hue, fontSize: 12, fontWeight: 600 }}>{count}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: hue, transition: "width 1s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HourlyChart({ data }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
      {data.map(({ hour, count }) => {
        const h = count ? Math.max(4, (count / max) * 72) : 4;
        const isActive = count > 0;
        return (
          <div key={hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }} title={`${hour}:00 — ${count} verifications`}>
            <div style={{ height: h, width: "100%", borderRadius: "3px 3px 0 0", background: isActive ? "linear-gradient(to top, #06b6d4, #3b82f6)" : "rgba(255,255,255,0.06)", transition: "height 0.8s ease" }} />
            {hour % 6 === 0 && <p style={{ color: "#4b5563", fontSize: 8 }}>{hour}h</p>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FakeNewsVerifier() {
  // --- Tabs ---
  const [activeTab, setActiveTab] = useState("verify"); // "verify" | "image" | "forensics" | "chat" | "dashboard"

  // --- Verify State ---
  const [headline, setHeadline] = useState("");
  const [language, setLanguage] = useState("en"); // "en" | "hi"
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [hindiResult, setHindiResult] = useState(null);   // { headline, explanation }
  const [hindiLoading, setHindiLoading] = useState(false);
  const [showHindi, setShowHindi] = useState(false);
  const [shareToast, setShareToast] = useState("");   // "" | "copied" | "downloading"
  const shareCardRef = useRef(null);
  // ─── Feedback state
  const [feedbackVote, setFeedbackVote]         = useState(null);   // null | "up" | "down"
  const [feedbackComment, setFeedbackComment]   = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted]   = useState(false);

  // --- Image Forensics State ---
  const [forensicsFile, setForensicsFile]       = useState(null);
  const [forensicsPreview, setForensicsPreview] = useState(null);
  const [forensicsLoading, setForensicsLoading] = useState(false);
  const [forensicsResult, setForensicsResult]   = useState(null);
  const [forensicsError, setForensicsError]     = useState("");
  const [forensicsDragOver, setForenicsDragOver] = useState(false);
  const forensicsInputRef = useRef(null);

  // --- Dashboard State ---
  const [dashData, setDashData]       = useState(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError]     = useState("");

  // --- Dataset Intelligence State ---
  const [dsData, setDsData]       = useState(null);
  const [dsLoading, setDsLoading] = useState(false);

  // --- Image OCR State ---
  const [imageFile, setImageFile]           = useState(null);
  const [imagePreview, setImagePreview]     = useState(null);
  const [imageLoading, setImageLoading]     = useState(false);
  const [extractedText, setExtractedText]   = useState("");
  const [imageDragOver, setImageDragOver]   = useState(false);
  const fileInputRef = useRef(null);

  // --- Chat State ---
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm your AI fact-checking assistant. Ask me anything about news topics, misinformation tactics, or paste a headline you'd like to discuss!",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]); // API history (no welcome msg)
  const chatEndRef = useRef(null);

  // ─── Restore result from shared URL (?v=base64) ────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedPayload = params.get("v");
    if (!sharedPayload) return;
    try {
      const decoded = JSON.parse(atob(sharedPayload));
      setResult(decoded);
    } catch {/* ignore malformed */}
  }, []);  // eslint-disable-line

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ─── Verify Logic ───────────────────────────────────────────────────────────
  const verifyHeadline = async () => {
    if (!headline.trim()) { setError("Please enter a headline"); return; }
    setLoading(true); setError(""); setResult(null);
    setHindiResult(null); setShowHindi(false);
    setFeedbackVote(null); setFeedbackComment(""); setFeedbackSubmitted(false);
    try {
      const response = await fetch(`${API_BASE}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline: headline.trim(), language }),
      });
      if (!response.ok) throw new Error("Verification failed");
      setResult(await response.json());
    } catch {
      setError("Failed to verify headline. Please ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Image OCR Logic ─────────────────────────────────────────────────────────
  const handleImageSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file (PNG, JPG, or WEBP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image is too large. Maximum size is 8 MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setResult(null);
    setExtractedText("");
    setError("");
    setFeedbackVote(null); setFeedbackComment(""); setFeedbackSubmitted(false);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setExtractedText("");
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const verifyImage = async () => {
    if (!imageFile) return;
    setImageLoading(true);
    setError("");
    setResult(null);
    setExtractedText("");
    setFeedbackVote(null); setFeedbackComment(""); setFeedbackSubmitted(false);
    const formData = new FormData();
    formData.append("file", imageFile);
    try {
      const res = await fetch(`${API_BASE}/api/ocr-verify`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "OCR verification failed");
      }
      const data = await res.json();
      setExtractedText(data.extracted_text || "");
      setResult(data);
    } catch (e) {
      setError(e.message || "Failed to process image. Please ensure the backend is running.");
    } finally {
      setImageLoading(false);
    }
  };

  const translateToHindi = async (res) => {
    if (hindiResult) { setShowHindi(true); return; }   // already translated
    setHindiLoading(true); setShowHindi(true);
    try {
      const headlineText = res.translated_headline ?? res.headline;
      const [h, e] = await Promise.all([
        fetch(`${API_BASE}/api/translate`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: headlineText, target: "hi" }),
        }).then(r => r.json()),
        fetch(`${API_BASE}/api/translate`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: res.explanation, target: "hi" }),
        }).then(r => r.json()),
      ]);
      setHindiResult({ headline: h.translated, explanation: e.translated });
    } catch {
      setHindiResult({ headline: res.headline, explanation: "⚠️ Translation failed." });
    } finally {
      setHindiLoading(false);
    }
  };

  // ─── Share helpers ────────────────────────────────────────────────────
  const showToast = (msg, ms = 2500) => {
    setShareToast(msg);
    setTimeout(() => setShareToast(""), ms);
  };

  const downloadCard = async () => {
    if (!shareCardRef.current) return;
    showToast("Generating image...", 5000);
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `fact-check-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("✓ Image downloaded!");
    } catch {
      showToast("⚠️ Download failed");
    }
  };

  const copyShareLink = () => {
    if (!result) return;
    const payload = {
      headline:           result.headline,
      credibility:        result.credibility,
      confidence:         result.confidence,
      explanation:        result.explanation,
      score_breakdown:    result.score_breakdown,
      translated_headline: result.translated_headline ?? null,
      evidence:           [],   // omit large evidence for URL size
    };
    const encoded = btoa(JSON.stringify(payload));
    const url = `${window.location.origin}${window.location.pathname}?v=${encoded}`;
    navigator.clipboard.writeText(url)
      .then(() => showToast("🔗 Link copied to clipboard!"))
      .catch(() => showToast("⚠️ Could not copy"));
  };

  // ─── Chat Logic ─────────────────────────────────────────────────────────────
  const sendChatMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;

    const userBubble = { role: "user", content: msg };
    setChatMessages((prev) => [...prev, userBubble]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: chatHistory }),
      });
      if (!response.ok) throw new Error("Chat failed");
      const data = await response.json();
      setChatHistory(data.history);
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Sorry, I couldn't connect to the backend. Please make sure it's running." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const clearChat = () => {
    setChatMessages([
      {
        role: "assistant",
        content: "👋 Hi! I'm your AI fact-checking assistant. Ask me anything about news topics, misinformation tactics, or paste a headline you'd like to discuss!",
      },
    ]);
    setChatHistory([]);
    setChatInput("");
  };

  // ─── Image Forensics Logic ────────────────────────────────────────────────────
  const handleForensicsSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setForensicsError("Please upload a valid image (PNG, JPG, WEBP)."); return; }
    if (file.size > 15 * 1024 * 1024) { setForensicsError("Image is too large. Max 15 MB."); return; }
    setForensicsFile(file);
    setForensicsPreview(URL.createObjectURL(file));
    setForensicsResult(null);
    setForensicsError("");
  };

  const clearForensics = () => {
    setForensicsFile(null);
    setForensicsPreview(null);
    setForensicsResult(null);
    setForensicsError("");
    if (forensicsInputRef.current) forensicsInputRef.current.value = "";
  };

  const runForensics = async () => {
    if (!forensicsFile) return;
    setForensicsLoading(true);
    setForensicsError("");
    setForensicsResult(null);
    const fd = new FormData();
    fd.append("file", forensicsFile);
    try {
      const res = await fetch(`${API_BASE}/api/image-forensics`, { method: "POST", body: fd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Forensics failed"); }
      setForensicsResult(await res.json());
    } catch (e) {
      setForensicsError(e.message || "Failed to run forensics. Please ensure the backend is running.");
    } finally {
      setForensicsLoading(false);
    }
  };

  // ─── Dashboard Logic ──────────────────────────────────────────────────────────
  const loadDashboard = async () => {
    setDashLoading(true);
    setDsLoading(true);
    setDashError("");
    try {
      // Fetch session analytics + dataset intelligence in parallel
      const [analyticsRes, datasetRes] = await Promise.all([
        fetch(`${API_BASE}/api/analytics`),
        fetch(`${API_BASE}/api/dataset-stats`),
      ]);
      if (!analyticsRes.ok) throw new Error("Failed to load analytics");
      const raw = await analyticsRes.json();
      // ── Normalize API field names → what the JSX expects ──────────────────
      const recentList = raw.recent_verifications ?? raw.recent ?? [];
      const imageCount = recentList.filter(r => r.source === "image_ocr").length;
      // Build avg_confidence_by_verdict from raw verdicts + avg_confidence
      const verdicts   = raw.verdicts ?? {};
      const rawTotal   = raw.total ?? 0;
      const avgConf    = raw.avg_confidence ?? 0;
      const avgConfByVerdict = raw.avg_confidence_by_verdict ??
        (rawTotal > 0 ? Object.fromEntries(
          Object.entries(verdicts)
            .filter(([, cnt]) => cnt > 0)
            .map(([v, cnt]) => [v, { avg: avgConf, count: cnt }])
        ) : {});
      setDashData({
        ...raw,
        confidence_distribution: raw.confidence_distribution ?? raw.confidence_dist ?? [],
        recent_verifications:    recentList,
        daily_trend:             raw.daily_trend             ?? [],
        hourly_activity:         raw.hourly_activity         ?? [],
        top_keywords:            raw.top_keywords            ?? [],
        top_fake_keywords:       raw.top_fake_keywords       ?? [],
        avg_confidence_by_verdict: avgConfByVerdict,
        totals: raw.totals ?? {
          total:            rawTotal,
          true_count:       verdicts.True        ?? 0,
          fake_count:       verdicts.Fake        ?? 0,
          unverified_count: verdicts.Unverified  ?? 0,
          image_count:      imageCount,
        },
      });
      if (datasetRes.ok) setDsData(await datasetRes.json());
    } catch (e) {
      setDashError(e.message || "Could not connect to backend.");
    } finally {
      setDashLoading(false);
      setDsLoading(false);
    }
  };

  // Auto-load dashboard when tab becomes active
  useEffect(() => {
    if (activeTab === "dashboard") loadDashboard();
  }, [activeTab]); // eslint-disable-line


  // ─── Feedback submit ──────────────────────────────────────────────────────────
  const submitFeedback = async () => {
    if (!result || !feedbackVote) return;
    setFeedbackSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline:         result.headline,
          model_verdict:    result.credibility,
          model_confidence: result.confidence,
          user_vote:        feedbackVote,
          user_comment:     feedbackComment.trim() || null,
        }),
      });
      setFeedbackSubmitted(true);
    } catch {
      // silently fail — don't disrupt the UX
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // ─── Verify Helpers ──────────────────────────────────────────────────────────
  const getVerdictClass = (c) => ({ True: "verdict-true", Fake: "verdict-fake", Unverified: "verdict-unverified" }[c] ?? "");
  const getBadgeClass   = (c) => ({ True: "badge-success", Fake: "badge-danger", Unverified: "badge-warning" }[c] ?? "badge-info");
  const getConfidenceClass = (n) => n >= 0.7 ? "high" : n >= 0.4 ? "medium" : "low";

  const getVerdictIcon = (credibility) => {
    const icons = {
      True: { bg: "from-emerald-400/20 to-green-500/20", color: "text-emerald-400", d: "M5 13l4 4L19 7" },
      Fake: { bg: "from-rose-400/20 to-pink-500/20",    color: "text-rose-400",    d: "M6 18L18 6M6 6l12 12" },
      Unverified: { bg: "from-amber-400/20 to-yellow-500/20", color: "text-amber-400", d: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    };
    const icon = icons[credibility];
    if (!icon) return null;
    return (
      <div className={`icon-container bg-gradient-to-br ${icon.bg}`}>
        <svg className={`w-6 h-6 ${icon.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={icon.d} />
        </svg>
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="animated-bg" />
      <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />

      {/* Header */}
      <header className="relative z-10 py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{background:'#DFC5FE',boxShadow:'0 8px 24px rgba(163,117,254,0.35)'}}>
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text glow-title">VeriFact AI</h1>
              <p className="text-sm md:text-base mt-1" style={{color:"#7a5c3c",fontFamily:"'Nunito',sans-serif"}}>AI-Powered Fact Checking with RAG Technology</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="tab-nav flex gap-2 mt-6 flex-wrap">
            <button
              id="tab-verify"
              onClick={() => setActiveTab("verify")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                activeTab === "verify"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-purple-500/30"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Verify Headline
            </button>

            {/* ── Image Fact-Check tab ── */}
            <button
              id="tab-image"
              onClick={() => setActiveTab("image")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                activeTab === "image"
                  ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/30"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Image Fact-Check
            </button>

            {/* ── Image Forensics tab ── */}
            <button
              id="tab-forensics"
              onClick={() => setActiveTab("forensics")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                activeTab === "forensics"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/30"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
              Image Forensics
              <span style={{ fontSize: 10, background: "rgba(251,191,36,0.3)", color: "#fde68a", padding: "1px 6px", borderRadius: 6, fontWeight: 700 }}>NEW</span>
            </button>

            <button
              id="tab-chat"
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                activeTab === "chat"
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-blue-500/30"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              AI Chat
              {chatMessages.length > 1 && (
                <span className="ml-1 bg-cyan-500/30 text-cyan-300 text-xs px-1.5 py-0.5 rounded-full">
                  {chatMessages.length - 1}
                </span>
              )}
            </button>

            {/* ── Trend Dashboard tab ── */}
            <button
              id="tab-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                activeTab === "dashboard"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Dashboard
              <span style={{ fontSize: 10, background: "rgba(52,211,153,0.3)", color: "#6ee7b7", padding: "1px 6px", borderRadius: 6, fontWeight: 700 }}>NEW</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 pb-12">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* ════════════ VERIFY TAB ════════════ */}
          {activeTab === "verify" && (
            <>
              {/* Input Section */}
              <div className="glass-card p-8 fade-in-up-1">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-white">Enter News Headline</h2>
                </div>

                {/* Language Toggle */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-gray-400 text-xs font-medium">Language:</span>
                  <div className="flex rounded-xl overflow-hidden border border-white/10">
                    <button
                      id="lang-en"
                      onClick={() => setLanguage("en")}
                      className={`px-3 py-1.5 text-xs font-semibold transition-all`}
                      style={language === "en" ? {background:'#DFC5FE',color:'#4a2c8a'} : {}}
                    >
                      🇺🇸 English
                    </button>
                    <button
                      id="lang-hi"
                      onClick={() => setLanguage("hi")}
                      className={`px-3 py-1.5 text-xs font-semibold transition-all`}
                      style={language === "hi" ? {background:'#DFC5FE',color:'#4a2c8a'} : {}}
                    >
                      🇮🇳 Hindi
                    </button>
                  </div>
                  {language === "hi" && (
                    <span className="text-orange-400 text-xs">
                      ✨ Type in Hindi — we'll translate automatically
                    </span>
                  )}
                </div>

                <textarea
                  className="glass-input w-full"
                  rows={4}
                  placeholder={
                    language === "hi"
                      ? "यहाँ हिंदी में समाचार शीर्षक टाइप करें..."
                      : "Paste or type a news headline here to verify its authenticity..."
                  }
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) verifyHeadline(); }}
                />

                {error && (
                  <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3 shake">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
                  <button
                    id="btn-verify"
                    onClick={verifyHeadline}
                    disabled={loading || !headline.trim()}
                    className="btn-primary w-full sm:w-auto flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      <><div className="loading-spinner" /><span>Analyzing...</span></>
                    ) : (
                      <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><span>Verify Headline</span></>
                    )}
                  </button>

                  {result && (
                    <button
                      id="btn-discuss"
                      onClick={() => {
                        const summary = `I just verified this headline: "${result.headline}". The result was: ${result.credibility} (${Math.round(result.confidence * 100)}% confidence). ${result.explanation}`;
                        setChatMessages((prev) => [...prev, { role: "user", content: summary }]);
                        setChatHistory((prev) => [...prev, { role: "user", content: summary }]);
                        setChatLoading(true);
                        setActiveTab("chat");
                        fetch("http://localhost:8080/api/chat", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ message: summary, history: chatHistory }),
                        })
                          .then((r) => r.json())
                          .then((data) => {
                            setChatHistory(data.history);
                            setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
                          })
                          .catch(() => setChatMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Couldn't connect to backend." }]))
                          .finally(() => setChatLoading(false));
                      }}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/30 transition-all text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      Discuss with AI
                    </button>
                  )}

                  <span className="text-gray-500 text-sm">
                    Press <kbd className="px-2 py-1 bg-white/10 rounded text-gray-400">Ctrl</kbd> + <kbd className="px-2 py-1 bg-white/10 rounded text-gray-400">Enter</kbd> to verify
                  </span>
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="glass-card p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                      <div className="loading-spinner" style={{ width: "28px", height: "28px", borderColor: "rgba(139,92,246,0.3)", borderTopColor: "#8b5cf6" }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Analyzing Headline</h3>
                      <p className="text-gray-400 text-sm">Searching trusted sources and verifying facts...</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 w-3/4 rounded shimmer" />
                    <div className="h-4 w-1/2 rounded shimmer" />
                    <div className="h-4 w-2/3 rounded shimmer" />
                  </div>
                </div>
              )}

              {/* Results */}
              {result && !loading && (
                <div className="space-y-6 result-appear">
                  <div className={`glass-card p-8 ${getVerdictClass(result.credibility)}`}>
                    <div className="flex flex-col md:flex-row md:items-start gap-6">
                      <div className="flex-shrink-0">{getVerdictIcon(result.credibility)}</div>
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`badge ${getBadgeClass(result.credibility)}`}>
                            {result.credibility === "True" && "✓ Verified True"}
                            {result.credibility === "Fake" && "✗ Likely Fake"}
                            {result.credibility === "Unverified" && "? Unverified"}
                          </span>
                          <span className="text-gray-400 text-sm">Confidence: {Math.round(result.confidence * 100)}%</span>
                        </div>
                        <div className="confidence-bar mt-2">
                          <div className={`confidence-fill ${getConfidenceClass(result.confidence)}`} style={{ width: `${result.confidence * 100}%` }} />
                        </div>
                        <ConfidenceChart breakdown={result.score_breakdown} overallConfidence={result.confidence} />
                        {/* Translation notice */}
                        {result.translated_headline && (
                          <div className="mt-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-start gap-2">
                            <span className="text-lg flex-shrink-0">🇮🇳</span>
                            <div>
                              <p className="text-orange-300 text-xs font-semibold mb-1">Hindi input — auto-translated to English for analysis</p>
                              <p className="text-gray-300 text-sm"><span className="text-gray-500">Original:</span> {result.headline}</p>
                              <p className="text-gray-300 text-sm"><span className="text-gray-500">Translated:</span> {result.translated_headline}</p>
                            </div>
                          </div>
                        )}
                        <div className="mt-4">
                          <p className="text-gray-400 text-sm mb-2">Analyzed Headline:</p>
                          <p className="text-white text-lg font-medium italic">"{result.headline}"</p>
                        </div>
                        <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                          {/* Header row with language toggle */}
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-gray-400 text-sm">AI Explanation:</p>
                            <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs font-semibold">
                              <button
                                id="result-lang-en"
                                onClick={() => setShowHindi(false)}
                                className={`px-2.5 py-1 transition-all ${
                                  !showHindi ? "bg-violet-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                                }`}
                              >
                                🇺🇸 EN
                              </button>
                              <button
                                id="result-lang-hi"
                                onClick={() => translateToHindi(result)}
                                className={`px-2.5 py-1 transition-all ${
                                  showHindi ? "bg-orange-500 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                                }`}
                              >
                                🇮🇳 हिंदी
                              </button>
                            </div>
                          </div>

                          {/* Headline display */}
                          <p className="text-gray-400 text-xs mb-1">Headline:</p>
                          <p className="text-white font-medium italic mb-3 text-sm">
                            "{showHindi && hindiResult ? hindiResult.headline : (result.translated_headline ?? result.headline)}"
                          </p>

                          {/* Explanation */}
                          {hindiLoading ? (
                            <div className="flex items-center gap-2 text-orange-300 text-sm">
                              <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: "rgba(251,146,60,0.3)", borderTopColor: "#fb923c" }} />
                              <span>Translating to Hindi...</span>
                            </div>
                          ) : (
                            <p className="text-gray-200 leading-relaxed" style={{ fontFamily: showHindi ? "'Noto Sans Devanagari', sans-serif" : "inherit" }}>
                              {showHindi && hindiResult ? hindiResult.explanation : result.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ─ Share Row ────────────────────────────────── */}
                  <div className="glass-card p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize:18 }}>📤</span>
                      <div>
                        <p className="text-white text-sm font-semibold">Share this result</p>
                        <p className="text-gray-400 text-xs">Download as image or copy a shareable link</p>
                      </div>
                    </div>
                    <div className="share-row-buttons flex gap-3">
                      <button
                        id="btn-download-card"
                        onClick={downloadCard}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderRadius:12, border:"none", cursor:"pointer", background:"linear-gradient(135deg,#c87de8,#a855f7)", color:"white", fontSize:13, fontWeight:600, transition:"all 0.2s", fontFamily:"'Nunito',sans-serif" }}
                        onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                        onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download Image
                      </button>
                      <button
                        id="btn-copy-link"
                        onClick={copyShareLink}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderRadius:12, border:"1px solid rgba(245,200,66,0.3)", cursor:"pointer", background:"rgba(255,245,220,0.7)", color:"#4a3018", fontSize:13, fontWeight:600, transition:"all 0.2s", fontFamily:"'Nunito',sans-serif" }}
                        onMouseEnter={e=>e.currentTarget.style.background="rgba(245,200,66,0.18)"}
                        onMouseLeave={e=>e.currentTarget.style.background="rgba(255,245,220,0.7)"}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                        </svg>
                        Copy Link
                      </button>
                    </div>
                  </div>

                  {/* Toast notification */}
                  {shareToast && (
                    <div className="share-toast" style={{ position:"fixed", bottom:32, right:32, zIndex:999, background:"rgba(255,248,230,0.97)", border:"1px solid rgba(245,200,66,0.35)", borderRadius:14, padding:"12px 20px", color:"#2c1a06", fontSize:14, fontWeight:600, boxShadow:"0 8px 32px rgba(180,100,40,0.18)", animation:"fadeIn 0.2s ease", fontFamily:"'Nunito',sans-serif" }}>
                      {shareToast}
                    </div>
                  )}

                  {/* Hidden share card — captured by html2canvas */}
                  <ShareCard result={result} cardRef={shareCardRef} />

                  {/* ─ Feedback Panel ──────────────────────────── */}
                  <div className="glass-card p-5">
                    {feedbackSubmitted ? (
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: 28 }}>🙏</span>
                        <div>
                          <p className="text-white font-semibold text-sm">Thank you for your feedback!</p>
                          <p className="text-gray-400 text-xs mt-0.5">Your input helps us improve accuracy over time.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-4">
                          <div>
                            <p className="text-white text-sm font-semibold">Was this result accurate?</p>
                            <p className="text-gray-400 text-xs mt-0.5">Your feedback trains the model to be better</p>
                          </div>
                          <div className="flex gap-2 ml-auto">
                            {/* Thumbs Up */}
                            <button
                              id="btn-feedback-up"
                              onClick={() => setFeedbackVote(v => v === "up" ? null : "up")}
                              style={{
                                display: "flex", alignItems: "center", gap: 7,
                                padding: "9px 18px", borderRadius: 12, border: "none", cursor: "pointer",
                                fontWeight: 600, fontSize: 13, transition: "all 0.2s",
                                background: feedbackVote === "up"
                                  ? "linear-gradient(135deg,#059669,#10b981)"
                                  : "rgba(16,185,129,0.1)",
                                color: feedbackVote === "up" ? "white" : "#6ee7b7",
                                boxShadow: feedbackVote === "up" ? "0 4px 16px rgba(16,185,129,0.35)" : "none",
                                transform: feedbackVote === "up" ? "scale(1.07)" : "scale(1)",
                              }}
                            >
                              <span style={{ fontSize: 18 }}>👍</span> Yes, accurate
                            </button>
                            {/* Thumbs Down */}
                            <button
                              id="btn-feedback-down"
                              onClick={() => setFeedbackVote(v => v === "down" ? null : "down")}
                              style={{
                                display: "flex", alignItems: "center", gap: 7,
                                padding: "9px 18px", borderRadius: 12, border: "none", cursor: "pointer",
                                fontWeight: 600, fontSize: 13, transition: "all 0.2s",
                                background: feedbackVote === "down"
                                  ? "linear-gradient(135deg,#be123c,#f43f5e)"
                                  : "rgba(244,63,94,0.1)",
                                color: feedbackVote === "down" ? "white" : "#fda4af",
                                boxShadow: feedbackVote === "down" ? "0 4px 16px rgba(244,63,94,0.35)" : "none",
                                transform: feedbackVote === "down" ? "scale(1.07)" : "scale(1)",
                              }}
                            >
                              <span style={{ fontSize: 18 }}>👎</span> Incorrect
                            </button>
                          </div>
                        </div>

                        {/* Comment box — slides in on thumbs-down */}
                        {feedbackVote === "down" && (
                          <div className="mt-4" style={{ animation: "slideUp 0.25s ease-out" }}>
                            <label className="text-gray-400 text-xs block mb-1">
                              What was wrong? <span className="text-gray-600">(optional)</span>
                            </label>
                            <textarea
                              id="feedback-comment"
                              className="glass-input w-full"
                              rows={2}
                              style={{ fontSize: 14, padding: 12 }}
                              placeholder="e.g. The verdict should be True, not Fake..."
                              value={feedbackComment}
                              onChange={e => setFeedbackComment(e.target.value)}
                            />
                          </div>
                        )}

                        {/* Submit button — only visible when a vote is selected */}
                        {feedbackVote && (
                          <div className="mt-3 flex justify-end">
                            <button
                              id="btn-feedback-submit"
                              onClick={submitFeedback}
                              disabled={feedbackSubmitting}
                              style={{
                                padding: "8px 20px", borderRadius: 10, border: "none", cursor: feedbackSubmitting ? "not-allowed" : "pointer",
                                background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "white",
                                fontSize: 13, fontWeight: 600, opacity: feedbackSubmitting ? 0.6 : 1,
                                display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
                              }}
                            >
                              {feedbackSubmitting ? (
                                <><div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /><span>Sending...</span></>
                              ) : (
                                <><span>✓</span><span>Submit Feedback</span></>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {result.evidence?.length > 0 && (
                    <div className="glass-card p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-white">Evidence Sources</h3>
                          <p className="text-gray-400 text-sm">{result.evidence.length} sources analyzed</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {result.evidence.map((ev, i) => (
                          <div key={i} className="evidence-card glass-card-hover p-5 rounded-xl bg-white/5 border border-white/10" style={{ animationDelay: `${i * 0.1}s` }}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/30 to-purple-500/30 flex items-center justify-center text-sm font-bold text-violet-300">{i + 1}</span>
                                <span className="font-semibold text-white">{ev.source}</span>
                              </div>
                              <span className="badge badge-info">{Math.round(ev.similarity_score * 100)}% match</span>
                            </div>
                            <h4 className="font-medium text-gray-200 mb-2">{ev.title}</h4>
                            <p className="text-sm text-gray-400 leading-relaxed">{ev.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* How It Works */}
              {!result && !loading && (
                <div className="glass-card p-8">
                  <h3 className="text-xl font-semibold text-white mb-8 text-center">How It Works</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                      { step: 1, title: "Input Headline", desc: "Enter any news headline you want to verify", gradient: "from-blue-500 to-cyan-500", iconBg: "from-blue-500/20 to-cyan-500/20" },
                      { step: 2, title: "AI Retrieval", desc: "System searches trusted sources using vector similarity", gradient: "from-violet-500 to-purple-500", iconBg: "from-violet-500/20 to-purple-500/20" },
                      { step: 3, title: "LLM Analysis", desc: "AI analyzes evidence and generates verification", gradient: "from-emerald-500 to-green-500", iconBg: "from-emerald-500/20 to-green-500/20" },
                      { step: 4, title: "Get Result", desc: "Receive credibility verdict with explanation", gradient: "from-orange-500 to-amber-500", iconBg: "from-orange-500/20 to-amber-500/20" },
                    ].map((item) => (
                      <div key={item.step} className="text-center group">
                        <div className={`step-indicator mx-auto mb-4 bg-gradient-to-br ${item.iconBg}`}>
                          <span className={`bg-gradient-to-br ${item.gradient} bg-clip-text text-transparent`}>{item.step}</span>
                        </div>
                        <h4 className="font-semibold text-white mb-2 group-hover:text-violet-400 transition-colors">{item.title}</h4>
                        <p className="text-sm text-gray-400">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════════════ IMAGE FACT-CHECK TAB ════════════ */}
          {activeTab === "image" && (
            <>
              {/* Upload Card */}
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Image Fact-Check</h2>
                    <p className="text-gray-400 text-sm mt-0.5">Upload a screenshot — AI reads & verifies the claim automatically</p>
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  id="image-upload-input"
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/gif"
                  style={{ display: "none" }}
                  onChange={(e) => handleImageSelect(e.target.files[0])}
                />

                {/* Drag-and-drop zone */}
                <div
                  id="image-drop-zone"
                  onDrop={(e) => { e.preventDefault(); setImageDragOver(false); handleImageSelect(e.dataTransfer.files[0]); }}
                  onDragOver={(e) => { e.preventDefault(); setImageDragOver(true); }}
                  onDragLeave={() => setImageDragOver(false)}
                  onClick={() => !imagePreview && fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${imageDragOver ? "#f43f5e" : imagePreview ? "rgba(251,113,133,0.5)" : "rgba(251,113,133,0.25)"}`,
                    borderRadius: 16,
                    padding: imagePreview ? "16px" : "48px 24px",
                    textAlign: "center",
                    cursor: imagePreview ? "default" : "pointer",
                    background: imageDragOver
                      ? "rgba(244,63,94,0.08)"
                      : imagePreview
                      ? "rgba(244,63,94,0.04)"
                      : "rgba(255,255,255,0.02)",
                    transition: "all 0.25s ease",
                    position: "relative",
                  }}
                >
                  {imagePreview ? (
                    // ── Preview state ──────────────────────────────────────────
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <img
                          src={imagePreview}
                          alt="preview"
                          style={{
                            maxHeight: 220,
                            maxWidth: "100%",
                            borderRadius: 10,
                            border: "1px solid rgba(251,113,133,0.3)",
                            display: "block",
                          }}
                        />
                        {/* Remove button overlay */}
                        <button
                          id="btn-remove-image"
                          onClick={(e) => { e.stopPropagation(); clearImage(); }}
                          style={{
                            position: "absolute", top: -10, right: -10,
                            width: 26, height: 26, borderRadius: "50%",
                            border: "none", cursor: "pointer",
                            background: "#f43f5e", color: "white",
                            fontSize: 14, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: "0 2px 8px rgba(244,63,94,0.5)",
                          }}
                        >✕</button>
                      </div>
                      <div style={{ flex: 1, minWidth: 160, textAlign: "left" }}>
                        <p style={{ color: "#fda4af", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📎 {imageFile?.name}</p>
                        <p style={{ color: "#6b7280", fontSize: 12 }}>{(imageFile?.size / 1024).toFixed(0)} KB · {imageFile?.type}</p>
                        <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
                          Ready to analyze. Click <strong style={{ color: "white" }}>Verify Image</strong> below.
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                          style={{
                            marginTop: 12, fontSize: 12, color: "#f87171",
                            background: "none", border: "1px solid rgba(248,113,113,0.3)",
                            borderRadius: 8, padding: "4px 12px", cursor: "pointer",
                          }}
                        >
                          🔄 Change image
                        </button>
                      </div>
                    </div>
                  ) : (
                    // ── Empty state ─────────────────────────────────────────────
                    <>
                      <div style={{
                        width: 72, height: 72, borderRadius: 20, margin: "0 auto 16px",
                        background: "linear-gradient(135deg, rgba(244,63,94,0.15), rgba(251,113,133,0.1))",
                        border: "1px solid rgba(244,63,94,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 32,
                        transition: "transform 0.2s ease",
                        transform: imageDragOver ? "scale(1.1)" : "scale(1)",
                      }}>
                        🖼️
                      </div>
                      <p style={{ color: "white", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
                        {imageDragOver ? "Drop it!" : "Drop a screenshot here"}
                      </p>
                      <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 4 }}>
                        or <span style={{ color: "#f87171", textDecoration: "underline" }}>click to browse</span>
                      </p>
                      <p style={{ color: "#4b5563", fontSize: 12, marginTop: 8 }}>
                        Supports PNG · JPG · WEBP · GIF &nbsp;·&nbsp; Max 8 MB
                      </p>
                    </>
                  )}
                </div>

                {/* Supported content hint */}
                {!imagePreview && (
                  <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                    {[
                      { icon: "🐦", label: "Twitter / X posts" },
                      { icon: "📘", label: "Facebook posts" },
                      { icon: "📱", label: "WhatsApp forwards" },
                      { icon: "📰", label: "News screenshots" },
                    ].map(({ icon, label }) => (
                      <span key={label} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        fontSize: 12, color: "#6b7280",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8, padding: "4px 10px",
                      }}>
                        {icon} {label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3 shake">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                {/* Verify button */}
                {imageFile && (
                  <div style={{ marginTop: 20 }}>
                    <button
                      id="btn-verify-image"
                      onClick={verifyImage}
                      disabled={imageLoading}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "13px 32px", borderRadius: 14, border: "none",
                        cursor: imageLoading ? "not-allowed" : "pointer",
                        background: imageLoading
                          ? "rgba(244,63,94,0.3)"
                          : "linear-gradient(135deg, #e11d48, #f43f5e)",
                        color: "white", fontWeight: 700, fontSize: 15,
                        boxShadow: imageLoading ? "none" : "0 4px 20px rgba(244,63,94,0.4)",
                        transition: "all 0.25s ease",
                        opacity: imageLoading ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => { if (!imageLoading) e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                    >
                      {imageLoading ? (
                        <><div className="loading-spinner" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} /> Extracting &amp; Verifying...</>
                      ) : (
                        <>
                          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          Verify Image
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Loading skeleton */}
              {imageLoading && (
                <div className="glass-card p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
                      <div className="loading-spinner" style={{ width: "28px", height: "28px", borderColor: "rgba(244,63,94,0.3)", borderTopColor: "#f43f5e" }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Reading Image...</h3>
                      <p className="text-gray-400 text-sm">AI Vision is extracting the claim, then verifying it</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 w-3/4 rounded shimmer" />
                    <div className="h-4 w-1/2 rounded shimmer" />
                    <div className="h-4 w-2/3 rounded shimmer" />
                  </div>
                </div>
              )}

              {/* Extracted text banner */}
              {extractedText && !imageLoading && (
                <div style={{
                  padding: "16px 20px", borderRadius: 14,
                  background: "linear-gradient(135deg, rgba(244,63,94,0.08), rgba(251,113,133,0.05))",
                  border: "1px solid rgba(244,63,94,0.25)",
                  display: "flex", gap: 14, alignItems: "flex-start",
                  animation: "fadeIn 0.4s ease",
                }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>🔍</span>
                  <div>
                    <p style={{ color: "#f87171", fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: "0.05em" }}>TEXT EXTRACTED FROM IMAGE</p>
                    <p style={{ color: "#e5e7eb", fontSize: 15, fontStyle: "italic", lineHeight: 1.6 }}>"{extractedText}"</p>
                  </div>
                </div>
              )}

              {/* Result card — reuse the same result block */}
              {result && !imageLoading && (
                <div className="space-y-6 result-appear">
                  <div className={`glass-card p-8 ${getVerdictClass(result.credibility)}`}>
                    <div className="flex flex-col md:flex-row md:items-start gap-6">
                      <div className="flex-shrink-0">{getVerdictIcon(result.credibility)}</div>
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`badge ${getBadgeClass(result.credibility)}`}>
                            {result.credibility === "True" && "✓ Verified True"}
                            {result.credibility === "Fake" && "✗ Likely Fake"}
                            {result.credibility === "Unverified" && "? Unverified"}
                          </span>
                          <span className="text-gray-400 text-sm">Confidence: {Math.round(result.confidence * 100)}%</span>
                          <span style={{ fontSize: 11, color: "#fda4af", background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 8, padding: "2px 8px", fontWeight: 600 }}>📷 Image OCR</span>
                        </div>
                        <div className="confidence-bar mt-2">
                          <div className={`confidence-fill ${getConfidenceClass(result.confidence)}`} style={{ width: `${result.confidence * 100}%` }} />
                        </div>
                        <ConfidenceChart breakdown={result.score_breakdown} overallConfidence={result.confidence} />
                        <div className="mt-4">
                          <p className="text-gray-400 text-sm mb-2">Extracted Claim:</p>
                          <p className="text-white text-lg font-medium italic">"{result.headline}"</p>
                        </div>
                        <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                          <p className="text-gray-400 text-sm mb-2">AI Explanation:</p>
                          <p className="text-gray-200 leading-relaxed">{result.explanation}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Evidence */}
                  {result.evidence?.length > 0 && (
                    <div className="glass-card p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-white">Evidence Sources</h3>
                          <p className="text-gray-400 text-sm">{result.evidence.length} sources analyzed</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {result.evidence.map((ev, i) => (
                          <div key={i} className="evidence-card glass-card-hover p-5 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/30 to-purple-500/30 flex items-center justify-center text-sm font-bold text-violet-300">{i + 1}</span>
                                <span className="font-semibold text-white">{ev.source}</span>
                              </div>
                              <span className="badge badge-info">{Math.round(ev.similarity_score * 100)}% match</span>
                            </div>
                            <h4 className="font-medium text-gray-200 mb-2">{ev.title}</h4>
                            <p className="text-sm text-gray-400 leading-relaxed">{ev.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tips card when nothing is showing */}
              {!imageFile && !result && (
                <div className="glass-card p-8">
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">💡 Tips for best results</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { icon: "✅", title: "Use clear screenshots", desc: "High-resolution images with readable text work best" },
                      { icon: "🎯", title: "Capture the headline", desc: "Make sure the main claim or headline is fully visible" },
                      { icon: "🚫", title: "Avoid heavy filters", desc: "Heavily edited or filtered images may reduce accuracy" },
                      { icon: "📐", title: "Crop unnecessary parts", desc: "Crop out profile pictures and unrelated UI for better focus" },
                    ].map(({ icon, title, desc }) => (
                      <div key={title} style={{
                        padding: "14px 16px", borderRadius: 12,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        display: "flex", gap: 14, alignItems: "flex-start",
                      }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                        <div>
                          <p style={{ color: "white", fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{title}</p>
                          <p style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════════════ IMAGE FORENSICS TAB ════════════ */}
          {activeTab === "forensics" && (
            <>
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Image Forensics</h2>
                    <p className="text-gray-400 text-sm mt-0.5">ELA analysis + EXIF metadata inspection to detect manipulation</p>
                  </div>
                </div>

                {/* Technique badges */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {[
                    { label: "Error Level Analysis", color: "#f59e0b" },
                    { label: "EXIF Metadata", color: "#06b6d4" },
                    { label: "Editing Software Detection", color: "#8b5cf6" },
                    { label: "Timestamp Verification", color: "#10b981" },
                  ].map(({ label, color }) => (
                    <span key={label} style={{ fontSize: 11, color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 8, padding: "3px 10px", fontWeight: 600 }}>{label}</span>
                  ))}
                </div>

                {/* File input */}
                <input
                  ref={forensicsInputRef}
                  id="forensics-upload-input"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => handleForensicsSelect(e.target.files[0])}
                />

                {/* Drop zone */}
                <div
                  id="forensics-drop-zone"
                  onDrop={(e) => { e.preventDefault(); setForenicsDragOver(false); handleForensicsSelect(e.dataTransfer.files[0]); }}
                  onDragOver={(e) => { e.preventDefault(); setForenicsDragOver(true); }}
                  onDragLeave={() => setForenicsDragOver(false)}
                  onClick={() => !forensicsPreview && forensicsInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${forensicsDragOver ? "#f59e0b" : forensicsPreview ? "rgba(245,158,11,0.5)" : "rgba(245,158,11,0.25)"}`,
                    borderRadius: 16, padding: forensicsPreview ? "16px" : "48px 24px",
                    textAlign: "center", cursor: forensicsPreview ? "default" : "pointer",
                    background: forensicsDragOver ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.02)",
                    transition: "all 0.25s ease",
                  }}
                >
                  {forensicsPreview ? (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <img src={forensicsPreview} alt="preview" style={{ maxHeight: 200, maxWidth: "100%", borderRadius: 10, border: "1px solid rgba(245,158,11,0.3)", display: "block" }} />
                        <button onClick={(e) => { e.stopPropagation(); clearForensics(); }}
                          style={{ position: "absolute", top: -10, right: -10, width: 26, height: 26, borderRadius: "50%", border: "none", cursor: "pointer", background: "#f59e0b", color: "white", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          ✕
                        </button>
                      </div>
                      <div style={{ flex: 1, minWidth: 160, textAlign: "left" }}>
                        <p style={{ color: "#fde68a", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📎 {forensicsFile?.name}</p>
                        <p style={{ color: "#6b7280", fontSize: 12 }}>{(forensicsFile?.size / 1024).toFixed(0)} KB · {forensicsFile?.type}</p>
                        <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>Click <strong style={{ color: "white" }}>Analyse Image</strong> below to start forensics.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ width: 72, height: 72, borderRadius: 20, margin: "0 auto 16px", background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.1))", border: "1px solid rgba(245,158,11,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🔬</div>
                      <p style={{ color: "white", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{forensicsDragOver ? "Drop it!" : "Drop image to analyse"}</p>
                      <p style={{ color: "#9ca3af", fontSize: 13 }}>or <span style={{ color: "#f59e0b", textDecoration: "underline" }}>click to browse</span></p>
                      <p style={{ color: "#4b5563", fontSize: 12, marginTop: 8 }}>PNG · JPG · WEBP &nbsp;·&nbsp; Max 15 MB</p>
                    </>
                  )}
                </div>

                {forensicsError && (
                  <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">{forensicsError}</div>
                )}

                {forensicsFile && (
                  <div style={{ marginTop: 20 }}>
                    <button
                      id="btn-run-forensics"
                      onClick={runForensics}
                      disabled={forensicsLoading}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "13px 32px", borderRadius: 14, border: "none",
                        cursor: forensicsLoading ? "not-allowed" : "pointer",
                        background: forensicsLoading ? "rgba(245,158,11,0.3)" : "linear-gradient(135deg, #d97706, #f59e0b)",
                        color: "white", fontWeight: 700, fontSize: 15,
                        boxShadow: forensicsLoading ? "none" : "0 4px 20px rgba(245,158,11,0.4)",
                        transition: "all 0.25s ease", opacity: forensicsLoading ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => { if (!forensicsLoading) e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                    >
                      {forensicsLoading ? (
                        <><div className="loading-spinner" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} /> Analysing...
                        </>
                      ) : (
                        <><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg> Analyse Image
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Loading */}
              {forensicsLoading && (
                <div className="glass-card p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                      <div className="loading-spinner" style={{ width: "28px", height: "28px", borderColor: "rgba(245,158,11,0.3)", borderTopColor: "#f59e0b" }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Running Forensics...</h3>
                      <p className="text-gray-400 text-sm">Performing ELA analysis and reading EXIF metadata</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 w-3/4 rounded shimmer" />
                    <div className="h-4 w-1/2 rounded shimmer" />
                    <div className="h-4 w-2/3 rounded shimmer" />
                  </div>
                </div>
              )}

              {/* Results */}
              {forensicsResult && !forensicsLoading && (() => {
                const el = forensicsResult.ela;
                const ex = forensicsResult.exif;
                const risk = forensicsResult.overall_risk;
                const riskStyle = {
                  low:    { bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.35)",  color: "#10b981", label: "✅ Low Risk — Appears Authentic" },
                  medium: { bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.35)",  color: "#f59e0b", label: "🔶 Medium Risk — Some Concerns" },
                  high:   { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.35)",   color: "#ef4444", label: "🔴 High Risk — Likely Manipulated" },
                }[risk] || { bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.35)", color: "#94a3b8", label: "❓ Risk Unknown" };

                return (
                  <div className="space-y-6 result-appear">
                    {/* Overall risk banner */}
                    <div style={{ padding: "20px 24px", borderRadius: 16, background: riskStyle.bg, border: `2px solid ${riskStyle.border}` }}>
                      <div className="flex items-center gap-4">
                        <span style={{ fontSize: 42 }}>{risk === "low" ? "🛡️" : risk === "medium" ? "⚠️" : "🚨"}</span>
                        <div>
                          <p style={{ color: riskStyle.color, fontWeight: 700, fontSize: 20 }}>{riskStyle.label}</p>
                          <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>Based on Error Level Analysis + EXIF Metadata inspection</p>
                        </div>
                      </div>
                    </div>

                    {/* Two columns: ELA + EXIF */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="forensics-grid">

                      {/* ── ELA Card ── */}
                      <div className="glass-card p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <span style={{ fontSize: 22 }}>🔍</span>
                          <div>
                            <h3 className="text-white font-semibold">Error Level Analysis</h3>
                            <p style={{ color: "#6b7280", fontSize: 12 }}>Pixel compression inconsistency map</p>
                          </div>
                        </div>

                        {el.ela_base64 && (
                          <div style={{ marginBottom: 16, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <img src={el.ela_base64} alt="ELA heatmap" style={{ width: "100%", display: "block" }} />
                            <p style={{ color: "#6b7280", fontSize: 11, padding: "6px 10px", background: "rgba(0,0,0,0.3)" }}>Bright regions = higher error = possible edit</p>
                          </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                          {[
                            { label: "Mean Error", val: `${el.mean_error}/255`, color: el.suspicion === "high" ? "#ef4444" : el.suspicion === "medium" ? "#f59e0b" : "#10b981" },
                            { label: "Max Error",  val: `${el.max_error}/255`,  color: "#9ca3af" },
                          ].map(({ label, val, color }) => (
                            <div key={label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.07)" }}>
                              <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 4 }}>{label}</p>
                              <p style={{ color, fontWeight: 700, fontSize: 16 }}>{val}</p>
                            </div>
                          ))}
                        </div>

                        <div style={{ padding: "12px 16px", borderRadius: 10, background: `${{ low: "rgba(16,185,129,0.08)", medium: "rgba(245,158,11,0.08)", high: "rgba(239,68,68,0.08)" }[el.suspicion] || "rgba(100,116,139,0.08)"}`, border: `1px solid ${{ low: "rgba(16,185,129,0.25)", medium: "rgba(245,158,11,0.25)", high: "rgba(239,68,68,0.25)" }[el.suspicion] || "rgba(100,116,139,0.2)"}` }}>
                          <p style={{ color: "white", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{el.label}</p>
                          <p style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.6 }}>{el.description}</p>
                        </div>
                      </div>

                      {/* ── EXIF Card ── */}
                      <div className="glass-card p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <span style={{ fontSize: 22 }}>🗂️</span>
                          <div>
                            <h3 className="text-white font-semibold">EXIF Metadata</h3>
                            <p style={{ color: "#6b7280", fontSize: 12 }}>Camera, software, timestamp details</p>
                          </div>
                        </div>

                        {/* Summary */}
                        <div style={{ padding: "12px 16px", borderRadius: 10, background: `${{ low: "rgba(16,185,129,0.08)", medium: "rgba(245,158,11,0.08)", high: "rgba(239,68,68,0.08)" }[ex.risk_level] || "rgba(100,116,139,0.08)"}`, border: `1px solid ${{ low: "rgba(16,185,129,0.25)", medium: "rgba(245,158,11,0.25)", high: "rgba(239,68,68,0.25)" }[ex.risk_level] || "rgba(100,116,139,0.2)"}`, marginBottom: 14 }}>
                          <p style={{ color: "white", fontSize: 13, fontWeight: 600 }}>{ex.summary}</p>
                        </div>

                        {/* Key facts */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                          {[
                            { label: "📷 Camera", val: ex.camera_model || "Not found" },
                            { label: "💾 Software", val: ex.software || "Not found" },
                            { label: "📅 Created", val: ex.created_at || "Not found" },
                            { label: "📍 GPS", val: ex.has_gps ? (ex.gps_coords || "Present") : "Not present" },
                          ].map(({ label, val }) => (
                            <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <p style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>{label}</p>
                              <p style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 500, wordBreak: "break-all" }}>{val}</p>
                            </div>
                          ))}
                        </div>

                        {/* Flags */}
                        {ex.flags?.length > 0 && (
                          <div>
                            <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>⚠️ SUSPICIOUS PATTERNS</p>
                            {ex.flags.map((flag, i) => (
                              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                                <span style={{ color: "#f59e0b", fontSize: 14, flexShrink: 0 }}>•</span>
                                <p style={{ color: "#fde68a", fontSize: 12, lineHeight: 1.5 }}>{flag}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Raw fields toggle */}
                        {ex.fields?.length > 0 && (
                          <details style={{ marginTop: 14 }}>
                            <summary style={{ color: "#6b7280", fontSize: 12, cursor: "pointer", userSelect: "none" }}>📋 View all {ex.fields.length} EXIF fields</summary>
                            <div style={{ maxHeight: 200, overflowY: "auto", marginTop: 8 }}>
                              {ex.fields.map(({ tag, value }, i) => (
                                <div key={i} style={{ display: "flex", gap: 12, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <span style={{ color: "#6b7280", fontSize: 11, minWidth: 130, flexShrink: 0 }}>{tag}</span>
                                  <span style={{ color: "#9ca3af", fontSize: 11, wordBreak: "break-all" }}>{value}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>

                    {/* Disclaimer */}
                    <div style={{ padding: "12px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <p style={{ color: "#6b7280", fontSize: 12 }}>⚠️ <strong style={{ color: "#9ca3af" }}>Note:</strong> ELA and EXIF are forensic hints, not definitive proof. Heavy JPEG compression can mimic manipulation signals. Always cross-check with other tools and sources.</p>
                    </div>
                  </div>
                );
              })()}

              {/* Empty state tips */}
              {!forensicsFile && !forensicsResult && (
                <div className="glass-card p-8">
                  <h3 className="text-lg font-semibold text-white mb-6">🔬 What this tool checks</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { icon: "📊", title: "Error Level Analysis (ELA)", desc: "Re-compresses the image and measures per-pixel error. Edited regions retain higher error energy." },
                      { icon: "📋", title: "EXIF Metadata", desc: "Reads camera brand, model, GPS coordinates, creation timestamp, and software used." },
                      { icon: "🖥️", title: "Editing Software Detection", desc: "Flags if the image was processed by Photoshop, GIMP, Lightroom, Snapseed, Canva, etc." },
                      { icon: "⏱️", title: "Timestamp Anomaly", desc: "Detects if the 'modified' timestamp differs from 'original capture' — a common sign of re-export." },
                    ].map(({ icon, title, desc }) => (
                      <div key={title} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 14 }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                        <div>
                          <p style={{ color: "white", fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{title}</p>
                          <p style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════════════ CHAT TAB ════════════ */}
          {activeTab === "chat" && (
            <div className="glass-card flex flex-col" style={{ height: "70vh" }}>
              {/* Chat Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">AI Fact-Check Assistant</h2>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                      Powered by Groq LLaMA 3.3 · Conversation memory enabled
                    </p>
                  </div>
                </div>
                <button
                  id="btn-clear-chat"
                  onClick={clearChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear
                </button>
              </div>

              {/* Suggested prompts */}
              {chatMessages.length === 1 && (
                <div className="px-5 pt-4 flex flex-wrap gap-2 flex-shrink-0">
                  {[
                    "How can I spot fake news?",
                    "What are common misinformation tactics?",
                    "How do I verify a news source?",
                    "What is clickbait?",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => { setChatInput(prompt); }}
                      className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white text-xs transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-sm ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-violet-500 to-purple-600"
                        : "bg-gradient-to-br from-cyan-500 to-blue-600"
                    }`}>
                      {msg.role === "user" ? "You" : "🤖"}
                    </div>
                    {/* Bubble */}
                    <div
                      className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-violet-600/40 to-purple-600/40 border border-violet-500/30 text-white rounded-tr-sm"
                          : "bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {chatLoading && (
                  <div className="flex gap-3 flex-row">
                    <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-sm bg-gradient-to-br from-cyan-500 to-blue-600">🤖</div>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Bar */}
              <div className="chat-input-area p-4 border-t border-white/10 flex-shrink-0">
                <div className="flex gap-3 items-end">
                  <textarea
                    id="chat-input"
                    rows={1}
                    className="glass-input flex-1 resize-none"
                    style={{ minHeight: "44px", maxHeight: "120px" }}
                    placeholder="Ask about a news topic, misinformation tactics, or paste a headline..."
                    value={chatInput}
                    onChange={(e) => {
                      setChatInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
                    }}
                  />
                  <button
                    id="btn-send-chat"
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim() || chatLoading}
                    style={{
                      width: "44px",
                      height: "44px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, #0891b2, #2563eb)",
                      border: "none",
                      borderRadius: "12px",
                      cursor: "pointer",
                      opacity: (!chatInput.trim() || chatLoading) ? 0.4 : 1,
                      transition: "all 0.2s ease",
                      boxShadow: "0 4px 15px rgba(8, 145, 178, 0.4)",
                    }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2 text-center">Press Enter to send · Shift+Enter for new line</p>
              </div>
            </div>
          )}

          {/* ════════════ DASHBOARD TAB ════════════ */}
          {activeTab === "dashboard" && (
            <>
              {dashLoading && (
                <div className="glass-card p-12 flex flex-col items-center gap-4">
                  <div className="loading-spinner" style={{ width: 40, height: 40, borderColor: "rgba(52,211,153,0.3)", borderTopColor: "#34d399" }} />
                  <p className="text-gray-400">Loading analytics...</p>
                </div>
              )}

              {dashError && (
                <div className="glass-card p-8 text-center">
                  <p className="text-rose-400">⚠️ {dashError}</p>
                  <button onClick={loadDashboard} className="mt-4 px-4 py-2 rounded-xl bg-white/10 text-gray-300 text-sm hover:bg-white/15">Retry</button>
                </div>
              )}

              {dashData && !dashLoading && (() => {
                const t = dashData.totals || {};
                const total = t.total || 0;
                const fakeRate = total ? Math.round((t.fake_count / total) * 100) : 0;

                return (
                  <div className="space-y-6">
                    {/* ── Page header ── */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-white">📊 Misinformation Intelligence Dashboard</h2>
                        <p className="text-gray-400 text-sm mt-1">Real-world dataset insights + live verification analytics</p>
                      </div>
                      <button onClick={loadDashboard} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 13, cursor: "pointer" }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                      </button>
                    </div>

                    {/* ══════════ SECTION 1: Dataset Intelligence ══════════ */}
                    {dsData?.available && (
                      <div className="space-y-4">
                        {/* Section label */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.08)" }} />
                          <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>🌐 Real-World Dataset Intelligence · {dsData.dataset_name}</span>
                          <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.08)" }} />
                        </div>
                        <p style={{ color: "#4b5563", fontSize: 11, textAlign: "center", marginTop: -8 }}>{dsData.dataset_note}</p>

                        {/* Big fake/real ratio cards */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="forensics-grid">
                          {/* Fake ratio */}
                          <div style={{ background: "linear-gradient(135deg, rgba(244,63,94,0.12), rgba(239,68,68,0.06))", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 20, padding: "28px 32px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: -20, right: -20, fontSize: 100, opacity: 0.05 }}>❌</div>
                            <p style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Fake News in Dataset</p>
                            <p style={{ fontSize: 56, fontWeight: 900, color: "#f43f5e", lineHeight: 1 }}>{dsData.fake_pct}<span style={{ fontSize: 24, fontWeight: 600 }}>%</span></p>
                            <p style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>{dsData.fake_count.toLocaleString()} fake articles out of {dsData.total_articles.toLocaleString()}</p>
                            <div style={{ marginTop: 16, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${dsData.fake_pct}%`, background: "linear-gradient(90deg, #f43f5e, #fb7185)", borderRadius: 999, transition: "width 1.2s ease" }} />
                            </div>
                          </div>
                          {/* Real ratio */}
                          <div style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(52,211,153,0.06))", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 20, padding: "28px 32px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: -20, right: -20, fontSize: 100, opacity: 0.05 }}>✅</div>
                            <p style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Real News in Dataset</p>
                            <p style={{ fontSize: 56, fontWeight: 900, color: "#10b981", lineHeight: 1 }}>{dsData.real_pct}<span style={{ fontSize: 24, fontWeight: 600 }}>%</span></p>
                            <p style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>{dsData.real_count.toLocaleString()} real articles out of {dsData.total_articles.toLocaleString()}</p>
                            <div style={{ marginTop: 16, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${dsData.real_pct}%`, background: "linear-gradient(90deg, #10b981, #34d399)", borderRadius: 999, transition: "width 1.2s ease" }} />
                            </div>
                          </div>
                        </div>

                        {/* Keyword clouds + topic fake-rates */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="forensics-grid">
                          {/* Fake keywords */}
                          {dsData.fake_keywords?.length > 0 && (
                            <div className="glass-card p-6">
                              <h3 className="text-white font-semibold mb-1">🚨 Common Words in Fake News</h3>
                              <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 14 }}>Most frequent terms in fake article headlines</p>
                              <KeywordCloud words={dsData.fake_keywords} color="#f43f5e" />
                            </div>
                          )}
                          {/* Real keywords */}
                          {dsData.real_keywords?.length > 0 && (
                            <div className="glass-card p-6">
                              <h3 className="text-white font-semibold mb-1">✅ Common Words in Real News</h3>
                              <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 14 }}>Most frequent terms in verified article headlines</p>
                              <KeywordCloud words={dsData.real_keywords} color="#10b981" />
                            </div>
                          )}
                        </div>

                        {/* Topic fake rates */}
                        {dsData.topic_fake_rates?.length > 0 && (
                          <div className="glass-card p-6">
                            <h3 className="text-white font-semibold mb-1">📌 Fake News Rate by Topic</h3>
                            <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 20 }}>What % of articles about each topic are fake? (from {dsData.total_articles.toLocaleString()} articles)</p>
                            <div className="space-y-3">
                              {dsData.topic_fake_rates.map(({ topic, total: tn, fake: fn, fake_rate }) => {
                                const color = fake_rate > 65 ? "#f43f5e" : fake_rate > 45 ? "#f59e0b" : "#10b981";
                                return (
                                  <div key={topic}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ color: "white", fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{topic}</span>
                                        <span style={{ color: "#4b5563", fontSize: 11 }}>{tn.toLocaleString()} articles</span>
                                      </div>
                                      <span style={{ color, fontWeight: 700, fontSize: 14 }}>{fake_rate}% fake</span>
                                    </div>
                                    <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden", position: "relative" }}>
                                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${100 - fake_rate}%`, background: "rgba(16,185,129,0.3)", borderRadius: "999px 0 0 999px" }} />
                                      <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: `${fake_rate}%`, background: color, borderRadius: "0 999px 999px 0", opacity: 0.8 }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ display: "flex", gap: 20, marginTop: 16, justifyContent: "center" }}>
                              {[{ c: "#f43f5e", l: ">65% fake" }, { c: "#f59e0b", l: "45–65% fake" }, { c: "#10b981", l: "<45% fake" }].map(({ c, l }) => (
                                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                                  <span style={{ color: "#6b7280", fontSize: 11 }}>{l}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Title length dist */}
                        {dsData.title_length_dist?.length > 0 && (
                          <div className="glass-card p-6">
                            <h3 className="text-white font-semibold mb-1">📏 Headline Length Distribution</h3>
                            <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>Distribution of headline character lengths across the dataset</p>
                            <div className="space-y-3">
                              {(() => {
                                const maxCount = Math.max(1, ...dsData.title_length_dist.map(d => d.count ?? 0));
                                return dsData.title_length_dist.map(({ range, count }) => {
                                  const pct = Math.round((count / maxCount) * 100);
                                  return (
                                    <div key={range}>
                                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                        <span style={{ color: "#9ca3af", fontSize: 12 }}>{range} chars</span>
                                        <span style={{ color: "#9ca3af", fontSize: 11, fontWeight: 600 }}>{(count ?? 0).toLocaleString()} articles</span>
                                      </div>
                                      <div style={{ height: 8, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
                                        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #8b5cf6, #06b6d4)", borderRadius: 999, transition: "width 1s ease" }} />
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                            <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                              {[{ c: "linear-gradient(90deg, #8b5cf6, #06b6d4)", l: "Article count" }].map(({ c, l }) => (
                                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <div style={{ width: 12, height: 8, borderRadius: 2, background: c }} />
                                  <span style={{ color: "#6b7280", fontSize: 11 }}>{l}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Section divider */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 8 }}>
                          <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.08)" }} />
                          <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>📱 Your Verification Session</span>
                          <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.08)" }} />
                        </div>
                      </div>
                    )}

                    {/* Stat cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
                      {[
                        { label: "Total Verified", val: total, icon: "🔍", color: "#8b5cf6" },
                        { label: "Verified True",  val: t.true_count || 0,       icon: "✅", color: "#10b981" },
                        { label: "Flagged Fake",   val: t.fake_count || 0,       icon: "❌", color: "#f43f5e" },
                        { label: "Unverified",     val: t.unverified_count || 0, icon: "❓", color: "#f59e0b" },
                        { label: "Via Image OCR",  val: t.image_count || 0,      icon: "📷", color: "#06b6d4" },
                        { label: "Fake Rate",      val: `${fakeRate}%`,          icon: "📉", color: fakeRate > 50 ? "#f43f5e" : "#10b981" },
                      ].map(({ label, val, icon, color }) => (
                        <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "20px", position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", top: -10, right: -10, fontSize: 50, opacity: 0.05 }}>{icon}</div>
                          <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                          <p style={{ color, fontSize: 28, fontWeight: 800 }}>{val}</p>
                          <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: `${color}20` }}>
                            <div style={{ height: "100%", width: total ? `${Math.min(100, (typeof val === "number" ? (val / total) * 100 : parseInt(val)) || 0)}%` : "0%", borderRadius: 2, background: color, transition: "width 1s ease" }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Trend chart (daily) */}
                    {dashData.daily_trend?.length > 0 && (
                      <div className="glass-card p-6">
                        <h3 className="text-white font-semibold mb-1">📅 Daily Verification Trend (last 14 days)</h3>
                        <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 20 }}>Number of verifications per day grouped by verdict</p>
                        <div style={{ overflowX: "auto" }}>
                          <DailyBarChart data={dashData.daily_trend} />
                        </div>
                      </div>
                    )}

                    {/* Two column: keywords + confidence dist */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="forensics-grid">

                      {/* Keyword cloud */}
                      {dashData.top_keywords?.length > 0 && (
                        <div className="glass-card p-6">
                          <h3 className="text-white font-semibold mb-1">🏷️ Top Trending Topics</h3>
                          <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>Most frequent keywords across all headlines</p>
                          <KeywordCloud words={dashData.top_keywords} color="#8b5cf6" />
                        </div>
                      )}

                      {/* Fake-specific keywords */}
                      {dashData.top_fake_keywords?.length > 0 && (
                        <div className="glass-card p-6">
                          <h3 className="text-white font-semibold mb-1">🚨 Top Misinformation Keywords</h3>
                          <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>Common words in headlines flagged as Fake</p>
                          <KeywordCloud words={dashData.top_fake_keywords} color="#f43f5e" />
                        </div>
                      )}
                    </div>

                    {/* Confidence distribution + hourly */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="forensics-grid">
                      {dashData.confidence_distribution?.length > 0 && (
                        <div className="glass-card p-6">
                          <h3 className="text-white font-semibold mb-1">📊 Confidence Distribution</h3>
                          <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>How confident was the model across all verifications?</p>
                          <ConfDistChart data={dashData.confidence_distribution} />
                        </div>
                      )}

                      {dashData.hourly_activity && (
                        <div className="glass-card p-6">
                          <h3 className="text-white font-semibold mb-1">⏰ Hourly Activity (last 7 days)</h3>
                          <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>Which hours see the most verification requests?</p>
                          <HourlyChart data={dashData.hourly_activity} />
                        </div>
                      )}
                    </div>

                    {/* Avg confidence per verdict */}
                    {Object.keys(dashData.avg_confidence_by_verdict || {}).length > 0 && (
                      <div className="glass-card p-6">
                        <h3 className="text-white font-semibold mb-4">🎯 Average Confidence by Verdict</h3>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                          {Object.entries(dashData.avg_confidence_by_verdict).map(([verdict, { avg, count }]) => {
                            const c = { True: "#10b981", Fake: "#f43f5e", Unverified: "#f59e0b" }[verdict] || "#9ca3af";
                            return (
                              <div key={verdict} style={{ flex: 1, minWidth: 140, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px 20px" }}>
                                <p style={{ color: c, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{verdict === "True" ? "✅ True" : verdict === "Fake" ? "❌ Fake" : "❓ Unverified"}</p>
                                <p style={{ color: "white", fontSize: 26, fontWeight: 800 }}>{Math.round((avg || 0) * 100)}%</p>
                                <p style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>{count} verification{count !== 1 ? "s" : ""}</p>
                                <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: `${c}20` }}>
                                  <div style={{ height: "100%", width: `${(avg || 0) * 100}%`, borderRadius: 2, background: c }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Recent verifications */}
                    {dashData.recent_verifications?.length > 0 && (
                      <div className="glass-card p-6">
                        <h3 className="text-white font-semibold mb-4">🕐 Recent Verifications</h3>
                        <div className="space-y-3">
                          {dashData.recent_verifications.map((v, i) => {
                            const c = { True: "#10b981", Fake: "#f43f5e", Unverified: "#f59e0b" }[v.credibility] || "#9ca3af";
                            return (
                              <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <span style={{ fontSize: 18, flexShrink: 0 }}>{v.source === "image_ocr" ? "📷" : "📝"}</span>
                                <p style={{ flex: 1, color: "#e5e7eb", fontSize: 13, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.headline}</p>
                                <span style={{ fontSize: 11, color: c, background: `${c}18`, border: `1px solid ${c}40`, borderRadius: 8, padding: "2px 8px", fontWeight: 600, flexShrink: 0 }}>{v.credibility}</span>
                                <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>{Math.round((v.confidence || 0) * 100)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {total === 0 && (
                      <div className="glass-card p-12 text-center">
                        <p style={{ fontSize: 48, marginBottom: 16 }}>📭</p>
                        <h3 className="text-white font-semibold text-lg mb-2">No data yet</h3>
                        <p className="text-gray-400">Go to the <strong className="text-violet-400">Verify Headline</strong> tab and verify a few headlines — they'll appear here automatically.</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-gray-500 text-sm">
            Powered by{" "}
            <span className="text-gray-400">RAG Technology</span> •{" "}
            <span className="text-gray-400">Groq LLM</span> •{" "}
            <span className="text-gray-400">EasyOCR</span> •{" "}
            <span className="text-gray-400">FAISS</span> •{" "}
            <span className="text-gray-400">Image Forensics</span> •{" "}
            <span className="text-gray-400">SQLite Analytics</span>
          </p>
          <p className="text-gray-600 text-xs mt-2">Results are AI-generated. Always verify from multiple sources.</p>
        </div>
      </footer>
    </div>
  );
}
