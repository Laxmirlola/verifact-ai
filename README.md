# 🛡️ VeriFact AI — AI-Powered Fake News Verifier

> An intelligent, full-stack fact-checking platform built with **FastAPI + React** using RAG (Retrieval-Augmented Generation), a trained ML classifier, LLM analysis (Groq), and image forensics.

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 **Headline Verifier** | Paste any news headline → get a True/Fake/Unverified verdict with confidence scores |
| 🖼️ **Image Fact-Check** | Upload a screenshot → EasyOCR extracts text → LLM cleans it → runs through verifier |
| 🔬 **Image Forensics** | ELA (Error Level Analysis) + EXIF metadata to detect manipulated/deepfake images |
| 💬 **AI Chat** | Conversational fact-checking assistant powered by Groq LLM |
| 📊 **Trend Dashboard** | Real-time analytics dashboard + WELFake dataset intelligence |
| 🌐 **Hindi Support** | Input in Hindi or translate results to Hindi using deep-translator |

---

## 🏗️ Architecture

```
fake-news-verifier/
├── backend/                  # FastAPI Python backend
│   ├── app/
│   │   ├── main.py           # All API routes
│   │   ├── models.py         # Pydantic schemas
│   │   ├── config.py         # Settings from .env
│   │   ├── services/
│   │   │   ├── retrieval.py          # FAISS semantic search
│   │   │   ├── llm_service.py        # Groq LLM integration
│   │   │   ├── ml_classifier.py      # TF-IDF + Logistic Regression
│   │   │   ├── welfake_service.py    # WELFake 72k dataset loader
│   │   │   ├── chat_service.py       # Chat endpoint logic
│   │   │   ├── analytics_service.py  # SQLite analytics
│   │   │   └── image_forensics.py    # ELA + EXIF analysis
│   │   └── data/             # Dataset files (not committed — see below)
│   └── requirements.txt
└── frontend/                 # React + Vite frontend
    └── src/
        ├── App.jsx           # Main app (single-file React app)
        └── index.css         # Global styles
```

---

## 🚀 Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- A free [Groq API key](https://console.groq.com/)
- (Optional) A free [NewsAPI key](https://newsapi.org/) for live news data

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/fake-news-verifier.git
cd fake-news-verifier
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt

# Copy env template and fill in your keys
copy .env.example .env
```

Edit `backend/.env`:
```
GROQ_API_KEY=your_groq_api_key_here
NEWS_API_KEY=your_newsapi_key_here
LLM_PROVIDER=groq
HOST=0.0.0.0
PORT=8080
MAX_ARTICLES_TO_INDEX=3000
```

> **Note:** The WELFake dataset CSV files are **not committed** to GitHub (300 MB+). The app works without them — the ML classifier and LLM still function. To enable the full RAG pipeline, download [WELFake_Dataset.csv](https://www.kaggle.com/datasets/saurabhshahane/fake-news-classification) and place it in `backend/app/data/`.

Start the backend:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deployment

- **Frontend** → Deploy to [Vercel](https://vercel.com) (free) — set `VITE_API_URL` to your backend URL
- **Backend** → Deploy to [Render](https://render.com) (free tier) or Railway

See the detailed deployment guide in the repo wiki or releases.

---

## 🧠 How It Works

1. **ML Classifier** — A TF-IDF vectorizer + Logistic Regression model trained on the WELFake dataset (93%+ accuracy) provides the first fast verdict.
2. **FAISS Semantic Search (RAG)** — The headline is embedded with `all-MiniLM-L6-v2` and the top-K most similar articles are retrieved from the 72k-article index.
3. **LLM Analysis** — When ML confidence is low, or additional explanation is needed, Groq's LLM synthesizes the evidence and provides an explanation.
4. **Score Fusion** — ML score, LLM score, and evidence score are combined for the final verdict.

---

## 📄 License

MIT License — feel free to use, fork, and build upon this project.

---

*Built as a Final Year Major Project — demonstrating RAG, ML, and LLM integration for combating misinformation.*
