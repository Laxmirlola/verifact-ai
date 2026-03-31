---
description: How to start the Fake News Verifier (frontend + backend)
---

## Start the Backend

Open a terminal in `c:\Users\KIIT\Desktop\fake-news-verifier\backend` and run:

// turbo
```
cd c:\Users\KIIT\Desktop\fake-news-verifier\backend; .\venv\Scripts\activate; uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

Wait until you see:
```
INFO:     Application startup complete.
```

> Note: The first request to Image Fact-Check will take ~30 seconds while EasyOCR downloads its models (~120 MB). After that it's fast.

---

## Start the Frontend

Open a **second** terminal in `c:\Users\KIIT\Desktop\fake-news-verifier\frontend` and run:

// turbo
```
cd c:\Users\KIIT\Desktop\fake-news-verifier\frontend; npm run dev
```

Wait until you see:
```
  ➜  Local:   http://localhost:5173/
```

---

## Open in Browser

Go to: **http://localhost:5173**

---

## Verify Both Are Running

- Backend health check: http://localhost:8080/health
- Frontend: http://localhost:5173

---

## Quick Troubleshooting

| Problem | Fix |
|---|---|
| "Failed to verify headline" | Backend is not running — start it (Step 1 above) |
| Backend crashes on startup | Delete `backend/app/__pycache__` and restart |
| Port 8080 already in use | Run `Stop-Process -Name python -Force` then restart backend |
| Image Fact-Check stuck loading | Reload the page, try again — first OCR run downloads models |
