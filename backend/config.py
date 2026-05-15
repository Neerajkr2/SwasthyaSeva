# backend/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List

class Settings(BaseSettings):
    database_url:             str   = "postgresql+asyncpg://postgres:password@localhost:5432/swasthyaseva"
    firebase_credentials_path:str  = "./firebase-credentials.json"
    jwt_secret_key:           str   = "change-me"
    jwt_algorithm:            str   = "HS256"
    jwt_expire_minutes:       int   = 10080
    anthropic_api_key:        str   = ""
    recaptcha_secret_key:     str   = ""
    ml_models_dir:            str   = "./ml/saved_models"
    allowed_origins:          str   = "http://localhost:3000"
    environment:              str   = "development"

    # ── RAG (Healthcare Knowledge Retrieval) ────────────────────────────
    # How many articles to inject as grounding context per chat turn.
    rag_top_k:                int   = 3
    # Minimum cosine-similarity score for an article to be considered
    # relevant enough to inject. 0.04 is a good default for TF-IDF over
    # short medical articles; raise to be stricter, lower to be lenient.
    rag_min_relevance:        float = 0.04

    @property
    def origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
