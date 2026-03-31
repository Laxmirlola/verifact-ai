from groq import Groq
from typing import List
import json
import re
from app.config import settings
from app.models import RetrievedEvidence, CredibilityLabel


class LLMService:
    def __init__(self):
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY is not set in .env file")
        
        self.client = Groq(api_key=settings.GROQ_API_KEY)
        self.model = settings.GROQ_MODEL  # defaults to llama-3.3-70b-versatile
    
    def create_verification_prompt(self, headline: str, evidence: List[RetrievedEvidence]) -> str:
        """Create RAG prompt for fact verification"""
        
        evidence_text = "\n\n".join([
            f"Source {i+1} ({ev.source}):\nTitle: {ev.title}\nContent: {ev.content}\n"
            for i, ev in enumerate(evidence)
        ])
        
        prompt = f"""You are a fact-checking AI assistant. Your task is to verify the credibility of a news headline based on retrieved evidence from trusted sources.

News Headline to Verify:
"{headline}"

Retrieved Evidence from Trusted Sources:
{evidence_text}

Instructions:
1. Analyze the headline against the retrieved evidence
2. Determine if the headline is TRUE, FAKE, or UNVERIFIED
3. Provide a clear, concise explanation (2-3 sentences)
4. Base your judgment ONLY on the provided evidence
5. If evidence is insufficient, mark as UNVERIFIED

Response Format (JSON):
{{
    "credibility": "True/Fake/Unverified",
    "explanation": "Your explanation here",
    "confidence": 0.85
}}

Provide your response:"""
        
        return prompt
    
    def verify(self, headline: str, evidence: List[RetrievedEvidence]) -> dict:
        """Main verification method using Groq"""
        prompt = self.create_verification_prompt(headline, evidence)
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a fact-checking assistant. Always respond with valid JSON."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1024
            )
            return self._parse_response(response.choices[0].message.content)
        except Exception as e:
            print(f"Groq API error: {e}")
            return {
                "credibility": "Unverified",
                "explanation": f"Error during verification: {str(e)}",
                "confidence": 0.0
            }
    
    def _parse_response(self, response_text: str) -> dict:
        """Parse LLM response to extract credibility, explanation, and confidence"""
        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{[^}]+\}', response_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return {
                    "credibility": result.get("credibility", "Unverified"),
                    "explanation": result.get("explanation", response_text),
                    "confidence": float(result.get("confidence", 0.5))
                }
        except:
            pass
        
        # Fallback parsing
        credibility = "Unverified"
        confidence = 0.5
        
        response_lower = response_text.lower()
        if "true" in response_lower and "fake" not in response_lower:
            credibility = "True"
            confidence = 0.7
        elif "fake" in response_lower or "false" in response_lower:
            credibility = "Fake"
            confidence = 0.7
        
        return {
            "credibility": credibility,
            "explanation": response_text[:300] if len(response_text) > 300 else response_text,
            "confidence": confidence
        }


llm_service = LLMService()