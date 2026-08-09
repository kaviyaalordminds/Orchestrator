from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path
import logging
import os

# Resolve persistent storage directory alongside backend/
_BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
_QDRANT_DIR = str(_BASE_DIR / "data" / "qdrant")

class Settings(BaseSettings):
    # ─── Obsidian Local REST API ────────────────────────────────────────────
    OBSIDIAN_API_URL: str = Field(default="https://127.0.0.1:27124")
    OBSIDIAN_API_KEY: str = Field(default="")          # Set in .env — never commit
    OBSIDIAN_VERIFY_SSL: bool = Field(default=False)    # Self-signed cert; keep False locally

    # ─── Qdrant Vector Database ─────────────────────────────────────────────
    QDRANT_LOCATION: str = Field(default=_QDRANT_DIR)  # Persists between restarts
    QDRANT_COLLECTION: str = Field(default="obsidian_vault")
    QDRANT_VECTOR_SIZE: int = Field(default=768)  # nomic-embed-text produces 768-dim vectors

    # ─── LLM (Ollama local) ─────────────────────────────────────────────────
    OLLAMA_URL: str = Field(default="http://127.0.0.1:11434")
    EMBEDDING_MODEL: str = Field(default="nomic-embed-text")
    LLM_MODEL: str = Field(default="llama3")

    # ─── RAG Tuning ──────────────────────────────────────────────────────────
    RAG_TOP_K: int = Field(default=5)
    RAG_CHUNK_SIZE: int = Field(default=500)   # words per chunk
    RAG_CHUNK_OVERLAP: int = Field(default=100) # words of overlap between chunks
    # Minimum cosine similarity for a vector match to count as "relevant".
    # Without this, vector search always returns its top-K nearest points even
    # when nothing in the vault is actually related to the query — which
    # silently defeats OBSIDIAN_ONLY / INSUFFICIENT_VAULT_CONTEXT. Tune this
    # against your real embedding model; the deterministic fallback embedding
    # (used when Ollama is unreachable) has no real semantic signal, so it
    # will rarely clear this bar — that's intentional, not a bug.
    RAG_MIN_SCORE: float = Field(default=0.35)

    # ─── Admin API Security ──────────────────────────────────────────────────
    ADMIN_API_KEY: str = Field(default="")     # Protect /rag/index & /rag/reindex — set in .env

    # ─── Source Policy ───────────────────────────────────────────────────────
    # When True, chat answers are grounded only in retrieved Obsidian context.
    # If no relevant vault content is found, the chat endpoint returns
    # INSUFFICIENT_VAULT_CONTEXT instead of letting the LLM answer from its
    # own training data. This project has no web-search tool to gate, so this
    # flag only controls that vault-context-required behavior.
    OBSIDIAN_ONLY: bool = Field(default=True)

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

# Ensure persistent Qdrant directory exists
Path(settings.QDRANT_LOCATION).mkdir(parents=True, exist_ok=True)

_logger = logging.getLogger("orchestrator.config")
if not settings.OBSIDIAN_API_KEY.strip():
    _logger.warning(
        "OBSIDIAN_API_KEY is not set — every request to the Obsidian Local REST "
        "API will be rejected with 401. Set it in backend/.env (see .env.example)."
    )
