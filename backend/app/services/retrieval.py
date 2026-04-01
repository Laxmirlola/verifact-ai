import faiss
import numpy as np
import json
import os
from typing import List, Tuple
from app.models import NewsArticle, RetrievedEvidence
from app.services.embeddings import embedding_service
from app.config import settings

class RetrievalService:
    def __init__(self):
        self.index = None
        self.articles = []
        
    def build_index(self, articles: List[NewsArticle]):
        """Build FAISS index from news articles"""
        self.articles = articles
        
        # Generate embeddings for all articles
        texts = [f"{article.title}. {article.content}" for article in articles]
        embeddings = embedding_service.generate_embeddings_batch(texts)
        
        # Create FAISS index
        dimension = embedding_service.get_embedding_dimension()
        self.index = faiss.IndexFlatL2(dimension)

        self.index.add(embeddings.astype('float32'))
        
        # Save index
        os.makedirs(settings.FAISS_INDEX_PATH, exist_ok=True)
        faiss.write_index(self.index, f"{settings.FAISS_INDEX_PATH}/index.faiss")
        
        # Save articles
        with open(settings.NEWS_ARTICLES_PATH, 'w') as f:
            json.dump([article.dict() for article in articles], f, indent=2)
    
    def load_index(self):
        """Load existing FAISS index"""
        index_path = f"{settings.FAISS_INDEX_PATH}/index.faiss"
        if os.path.exists(index_path):
            self.index = faiss.read_index(index_path)
            
            # Load articles
            with open(settings.NEWS_ARTICLES_PATH, 'r') as f:
                articles_data = json.load(f)
                self.articles = [NewsArticle(**article) for article in articles_data]
            return True
        return False
    
    def retrieve(self, query: str, top_k: int = 5) -> List[RetrievedEvidence]:
        """Retrieve top-k most relevant articles"""
        if self.index is None:
            raise ValueError("Index not loaded. Please build or load index first.")
        
        # Generate query embedding
        query_embedding = embedding_service.generate_embedding(query)
        
        # Search in FAISS
        distances, indices = self.index.search(
            query_embedding.reshape(1, -1).astype('float32'), 
            top_k
        )
        
        # Prepare results
        results = []
        for idx, distance in zip(indices[0], distances[0]):
            if idx < len(self.articles):
                article = self.articles[idx]
                # Convert L2 distance to similarity score (0-1 range)
                similarity = 1 / (1 + distance)
                
                results.append(RetrievedEvidence(
                    title=article.title,
                    content=article.content[:500],  # Truncate for context
                    source=article.source,
                    similarity_score=round(float(similarity), 4)
                ))
        
        return results

retrieval_service = RetrievalService()