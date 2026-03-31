from pydantic import BaseModel
from typing import List, Optional
from enum import Enum

class CredibilityLabel(str, Enum):
    TRUE = "True"
    FAKE = "Fake"
    UNVERIFIED = "Unverified"

class NewsArticle(BaseModel):
    title: str
    content: str
    source: str
    url: str
    published_date: Optional[str] = None

class VerificationRequest(BaseModel):
    headline: str
    language: str = "en"   # "en" (English) or "hi" (Hindi)

class RetrievedEvidence(BaseModel):
    title: str
    content: str
    source: str
    similarity_score: float

class VerificationResponse(BaseModel):
    headline: str
    credibility: CredibilityLabel
    explanation: str
    evidence: List[RetrievedEvidence]
    confidence: float
    score_breakdown: Optional[dict] = None          # {ml_score, llm_score, evidence_score}
    translated_headline: Optional[str] = None       # Set when input was translated from Hindi


# --- Chat Models ---

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []  # full conversation so far

class ChatResponse(BaseModel):
    reply: str
    history: List[ChatMessage]  # updated history including this turn

# --- Feedback Models ---

class FeedbackRequest(BaseModel):
    headline: str                       # the headline that was verified
    model_verdict: str                  # what the model said: True / Fake / Unverified
    model_confidence: float             # 0.0 – 1.0
    user_vote: str                      # "up" or "down"
    user_comment: Optional[str] = None  # optional free-text correction
