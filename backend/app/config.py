import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # API Keys
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    NEWS_API_KEY = os.getenv("NEWS_API_KEY")
    
    # Models
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq")  # Default to groq now
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-pro")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
    GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    
    # Paths
    DATA_DIR = "app/data"
    FAISS_INDEX_PATH = "app/data/faiss_index"
    NEWS_ARTICLES_PATH = "app/data/news_articles.json"
    WELFAKE_DATASET_PATH = "app/data/WELFake_Dataset.csv"
    
    # Dataset Config
    MAX_ARTICLES_TO_INDEX = int(os.getenv("MAX_ARTICLES_TO_INDEX", 10000))  # Limit for memory
    
    # Server
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8080))
    
    # Retrieval Config
    TOP_K_RESULTS = 5

settings = Settings()