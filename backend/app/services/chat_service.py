from groq import Groq
from typing import List
from app.config import settings
from app.models import ChatMessage
import logging

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert AI news fact-checker and journalist assistant.
Your job is to help users understand news topics, identify misinformation, and think critically about news headlines.

You can:
- Explain why a piece of news might be fake or real
- Discuss common misinformation tactics (clickbait, out-of-context images, etc.)
- Help users understand media bias and how to spot it
- Answer follow-up questions about a previously analyzed headline
- Provide general guidance on verifying news from multiple sources

Be concise, clear, and educational. Always encourage users to verify from multiple trusted sources.
When you're unsure about specific facts, say so honestly rather than making things up.
"""

class ChatService:
    def __init__(self):
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY is not set in .env file")
        self.client = Groq(api_key=settings.GROQ_API_KEY)
        self.model = settings.GROQ_MODEL

    def chat(self, message: str, history: List[ChatMessage]) -> str:
        """
        Send a message to the LLM with full conversation history.
        Returns the assistant's reply as a string.
        """
        # Build the messages list: system prompt + history + new user message
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})

        messages.append({"role": "user", "content": message})

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=1024,
            )
            reply = response.choices[0].message.content
            logger.info(f"Chat reply generated ({len(reply)} chars)")
            return reply
        except Exception as e:
            logger.error(f"Groq chat error: {e}")
            return f"Sorry, I encountered an error: {str(e)}. Please try again."


chat_service = ChatService()
