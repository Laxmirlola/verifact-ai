"""
ML-based Fake News Classifier
Uses TF-IDF + Logistic Regression for high accuracy classification
Based on the notebook approach with ~98.7% accuracy
"""

import re
import os
import logging
import pickle
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Tuple, Optional, Dict, Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

from app.config import settings

logger = logging.getLogger(__name__)

# Global state for NLTK
_nltk_initialized = False
_STOPWORDS = set()
_STEMMER = None
_NLTK_AVAILABLE = False

def _init_nltk():
    global _nltk_initialized, _STOPWORDS, _STEMMER, _NLTK_AVAILABLE
    if _nltk_initialized:
        return
    
    try:
        import nltk
        from nltk.corpus import stopwords
        from nltk.stem.porter import PorterStemmer
        
        try:
            nltk.data.find('corpora/stopwords')
        except LookupError:
            nltk.download('stopwords', quiet=True)
        
        _STOPWORDS = set(stopwords.words('english'))
        _STEMMER = PorterStemmer()
        _NLTK_AVAILABLE = True
    except ImportError:
        logger.warning("NLTK not available, using basic preprocessing")
        _NLTK_AVAILABLE = False
        _STOPWORDS = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'must', 'shall',
            'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
            'from', 'as', 'into', 'through', 'during', 'before', 'after',
            'above', 'below', 'between', 'under', 'again', 'further',
            'then', 'once', 'here', 'there', 'when', 'where', 'why',
            'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some',
            'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
            'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
            'because', 'until', 'while', 'this', 'that', 'these', 'those'
        }
        _STEMMER = None
        
    _nltk_initialized = True



class MLClassifier:
    """ML-based fake news classifier using TF-IDF + Logistic Regression"""
    
    def __init__(self):
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.model: Optional[LogisticRegression] = None
        self.is_trained = False
        self.accuracy = 0.0
        
        # Paths for saving/loading models
        self.model_path = Path(settings.DATA_DIR) / "ml_model.pkl"
        self.vectorizer_path = Path(settings.DATA_DIR) / "ml_vectorizer.pkl"
    
    def preprocess_text(self, text: str) -> str:
        """Preprocess text using stemming and stopword removal"""
        _init_nltk()
        
        # Remove non-alphabetic characters
        text = re.sub('[^a-zA-Z]', ' ', text)
        text = text.lower()
        words = text.split()
        
        if _NLTK_AVAILABLE and _STEMMER:
            # Apply stemming and remove stopwords
            words = [_STEMMER.stem(word) for word in words if word not in _STOPWORDS]
        else:
            # Basic preprocessing without NLTK or with fallback rules
            words = [word for word in words if word not in _STOPWORDS]
        
        return ' '.join(words)
    
    def load_dataset(self) -> Tuple[pd.DataFrame, bool]:
        """Load dataset from available sources"""
        # Try True.csv and Fake.csv first (higher quality labels)
        true_path = Path(settings.DATA_DIR) / "True.csv"
        fake_path = Path(settings.DATA_DIR) / "Fake.csv"
        
        if true_path.exists() and fake_path.exists():
            logger.info("Loading True.csv and Fake.csv datasets...")
            df_true = pd.read_csv(true_path)
            df_true['label'] = 1  # 1 = True/Real
            
            df_fake = pd.read_csv(fake_path)
            df_fake['label'] = 0  # 0 = Fake
            
            df = pd.concat([df_true, df_fake], axis=0)
            df = df.sample(frac=1, random_state=42).reset_index(drop=True)
            
            # Create content column
            df['content'] = df['title'].fillna('') + " " + df['text'].fillna('')
            
            logger.info(f"Loaded {len(df)} articles (True: {len(df_true)}, Fake: {len(df_fake)})")
            return df, True
        
        # Fallback to WELFake dataset
        welfake_path = Path(settings.WELFAKE_DATASET_PATH)
        if welfake_path.exists():
            logger.info("Loading WELFake dataset...")
            df = pd.read_csv(welfake_path)
            
            # WELFake has: title, text, label (0=Real, 1=Fake)
            # Invert labels to match our convention (1=True, 0=Fake)
            df['label'] = 1 - df['label']
            df['content'] = df['title'].fillna('') + " " + df['text'].fillna('')
            
            # Sample for memory management
            if len(df) > 20000:
                df = df.sample(n=20000, random_state=42)
            
            logger.info(f"Loaded {len(df)} articles from WELFake")
            return df, True
        
        logger.warning("No dataset found for ML training")
        return pd.DataFrame(), False
    
    def train(self, force_retrain: bool = False) -> bool:
        """Train the ML model or load from cache"""
        # Try to load existing model
        if not force_retrain and self._load_model():
            logger.info("Loaded pre-trained ML model")
            return True
        
        # Load dataset
        df, success = self.load_dataset()
        if not success or df.empty:
            logger.error("Cannot train ML model: no dataset available")
            return False
        
        logger.info("Training ML classifier...")
        
        # Preprocess content
        logger.info("Preprocessing text (this may take a few minutes)...")
        df['processed'] = df['content'].apply(self.preprocess_text)
        
        # Vectorize
        logger.info("Vectorizing text with TF-IDF...")
        self.vectorizer = TfidfVectorizer(max_features=50000)
        X = self.vectorizer.fit_transform(df['processed'])
        y = df['label']
        
        # Split and train
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, stratify=y, random_state=42
        )
        
        logger.info("Training Logistic Regression model...")
        self.model = LogisticRegression(max_iter=1000, n_jobs=-1)
        self.model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test)
        self.accuracy = accuracy_score(y_test, y_pred)
        self.is_trained = True
        
        logger.info(f"ML Model trained with accuracy: {self.accuracy:.4f} ({self.accuracy*100:.2f}%)")
        
        # Save model
        self._save_model()
        
        return True
    
    def predict(self, headline: str) -> Dict[str, Any]:
        """Predict if a headline is fake or true"""
        if not self.is_trained or self.model is None or self.vectorizer is None:
            return {
                "prediction": "unknown",
                "confidence": 0.0,
                "ml_available": False
            }
        
        # Preprocess
        processed = self.preprocess_text(headline)
        
        # Vectorize
        X = self.vectorizer.transform([processed])
        
        # Predict with probability
        prediction = self.model.predict(X)[0]
        probabilities = self.model.predict_proba(X)[0]
        
        # Get confidence (probability of predicted class)
        confidence = float(max(probabilities))
        
        # Convert prediction: 1=True, 0=Fake
        label = "True" if prediction == 1 else "Fake"
        
        return {
            "prediction": label,
            "confidence": confidence,
            "ml_available": True,
            "model_accuracy": self.accuracy,
            "true_probability": float(probabilities[1]) if len(probabilities) > 1 else 0.0,
            "fake_probability": float(probabilities[0]) if len(probabilities) > 0 else 0.0
        }
    
    def _save_model(self) -> bool:
        """Save trained model to disk"""
        try:
            with open(self.model_path, 'wb') as f:
                pickle.dump({
                    'model': self.model,
                    'accuracy': self.accuracy
                }, f)
            
            with open(self.vectorizer_path, 'wb') as f:
                pickle.dump(self.vectorizer, f)
            
            logger.info(f"ML model saved to {self.model_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to save ML model: {e}")
            return False
    
    def _load_model(self) -> bool:
        """Load pre-trained model from disk"""
        if not self.model_path.exists() or not self.vectorizer_path.exists():
            return False
        
        try:
            with open(self.model_path, 'rb') as f:
                data = pickle.load(f)
                self.model = data['model']
                self.accuracy = data['accuracy']
            
            with open(self.vectorizer_path, 'rb') as f:
                self.vectorizer = pickle.load(f)
            
            self.is_trained = True
            logger.info(f"Loaded ML model (accuracy: {self.accuracy:.4f})")
            return True
        except Exception as e:
            logger.error(f"Failed to load ML model: {e}")
            return False


# Global instance
ml_classifier = MLClassifier()
