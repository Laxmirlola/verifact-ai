import pandas as pd
import logging
from typing import List, Optional
from pathlib import Path
from app.models import NewsArticle
from app.config import settings

logger = logging.getLogger(__name__)


class WELFakeService:
    """Service to load and search the WELFake dataset"""
    
    def __init__(self):
        self.articles: List[NewsArticle] = []
        self.df: Optional[pd.DataFrame] = None
        self._loaded = False
    
    def load_dataset(self, max_articles: Optional[int] = None) -> bool:
        """Load the WELFake dataset from CSV — memory-safe via nrows"""
        dataset_path = Path(settings.WELFAKE_DATASET_PATH)
        
        if not dataset_path.exists():
            logger.warning(f"WELFake dataset not found at {dataset_path}")
            logger.info("Please download from: https://www.kaggle.com/datasets/saurabhshahane/fake-news-classification")
            return False
        
        try:
            logger.info(f"Loading WELFake dataset from {dataset_path}...")
            # Use nrows to avoid reading the entire 245 MB CSV into RAM.
            # Default cap: 5000 rows which is plenty for embedding/index use.
            row_limit = max_articles if max_articles else 5000
            self.df = pd.read_csv(dataset_path, nrows=row_limit, low_memory=False)
            logger.info(f"Read {len(self.df)} rows from WELFake (capped at {row_limit})")
            
            # Convert to NewsArticle format
            self.articles = []
            for idx, row in self.df.iterrows():
                title = str(row.get('title', '')) if pd.notna(row.get('title')) else ''
                text = str(row.get('text', '')) if pd.notna(row.get('text')) else ''
                label = row.get('label', 0)  # 0 = Real, 1 = Fake
                
                # Skip articles without title or text
                if not title.strip() or not text.strip():
                    continue
                
                # Determine source based on label
                source = "Verified Source" if label == 0 else "Unverified Source"
                
                self.articles.append(NewsArticle(
                    title=title.strip(),
                    content=text.strip()[:2000],  # Limit content length
                    source=source,
                    url="",  # No URL in dataset
                    published_date=None
                ))
            
            self._loaded = True
            logger.info(f"Loaded {len(self.articles)} articles from WELFake dataset")
            return True
            
        except Exception as e:
            logger.error(f"Error loading WELFake dataset: {e}")
            return False
    
    def get_articles(self) -> List[NewsArticle]:
        """Get all loaded articles"""
        return self.articles
    
    def is_loaded(self) -> bool:
        """Check if dataset is loaded"""
        return self._loaded
    
    def get_stats(self) -> dict:
        """Get dataset statistics"""
        if not self._loaded or self.df is None:
            return {"loaded": False}
        
        return {
            "loaded": True,
            "total_articles": len(self.articles),
            "real_articles": int((self.df['label'] == 0).sum()) if 'label' in self.df.columns else 0,
            "fake_articles": int((self.df['label'] == 1).sum()) if 'label' in self.df.columns else 0
        }


# Global service instance
welfake_service = WELFakeService()
