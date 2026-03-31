import requests
from typing import List, Optional
from app.models import NewsArticle
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class NewsAPIService:
    """Service to fetch real-time news from NewsAPI"""
    
    def __init__(self):
        self.api_key = settings.NEWS_API_KEY
        self.base_url = "https://newsapi.org/v2"
    
    def search_news(self, query: str, page_size: int = 10) -> List[NewsArticle]:
        """Search for news articles related to a query"""
        if not self.api_key:
            logger.warning("NEWS_API_KEY not set, falling back to sample articles")
            return []
        
        try:
            # Use the "everything" endpoint for broader search
            url = f"{self.base_url}/everything"
            params = {
                "q": query,
                "apiKey": self.api_key,
                "pageSize": page_size,
                "language": "en",
                "sortBy": "relevancy"
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") != "ok":
                logger.error(f"NewsAPI error: {data.get('message', 'Unknown error')}")
                return []
            
            articles = []
            for article in data.get("articles", []):
                # Skip articles with missing content
                if not article.get("content") or not article.get("title"):
                    continue
                
                # Clean up content (NewsAPI truncates content with "[+X chars]")
                content = article.get("content", "")
                if "[+" in content:
                    content = content.split("[+")[0]
                
                # Use description if content is too short
                description = article.get("description", "")
                if len(content) < len(description):
                    content = description
                
                articles.append(NewsArticle(
                    title=article.get("title", ""),
                    content=content,
                    source=article.get("source", {}).get("name", "Unknown"),
                    url=article.get("url", ""),
                    published_date=article.get("publishedAt", "")
                ))
            
            logger.info(f"Fetched {len(articles)} articles from NewsAPI for query: {query}")
            return articles
            
        except requests.exceptions.RequestException as e:
            logger.error(f"NewsAPI request failed: {e}")
            return []
        except Exception as e:
            logger.error(f"Error fetching news: {e}")
            return []
    
    def get_top_headlines(self, country: str = "us", category: Optional[str] = None) -> List[NewsArticle]:
        """Get top headlines"""
        if not self.api_key:
            return []
        
        try:
            url = f"{self.base_url}/top-headlines"
            params = {
                "country": country,
                "apiKey": self.api_key,
                "pageSize": 20
            }
            if category:
                params["category"] = category
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            articles = []
            for article in data.get("articles", []):
                if not article.get("content") or not article.get("title"):
                    continue
                
                content = article.get("content", "")
                if "[+" in content:
                    content = content.split("[+")[0]
                
                description = article.get("description", "")
                if len(content) < len(description):
                    content = description
                
                articles.append(NewsArticle(
                    title=article.get("title", ""),
                    content=content,
                    source=article.get("source", {}).get("name", "Unknown"),
                    url=article.get("url", ""),
                    published_date=article.get("publishedAt", "")
                ))
            
            return articles
            
        except Exception as e:
            logger.error(f"Error fetching headlines: {e}")
            return []


news_api_service = NewsAPIService()
