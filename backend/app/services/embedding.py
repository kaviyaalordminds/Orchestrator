import httpx
from typing import List
import math
import hashlib
import logging
from app.config import settings

logger = logging.getLogger("embedding")

class EmbeddingService:
    def __init__(self, ollama_url: str = settings.OLLAMA_URL, model: str = settings.EMBEDDING_MODEL):
        self.ollama_url = ollama_url.rstrip("/")
        self.model = model
        self._ollama_available: bool | None = None  # cached after first probe

    async def get_embedding(self, text: str) -> List[float]:
        # Truncate to avoid IDNA / token-limit issues with very long strings
        safe_text = text[:4000] if len(text) > 4000 else text

        if self._ollama_available is not False:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    res = await client.post(
                        f"{self.ollama_url}/api/embeddings",
                        json={"model": self.model, "prompt": safe_text}
                    )
                    if res.status_code == 200:
                        data = res.json()
                        if "embedding" in data and data["embedding"]:
                            self._ollama_available = True
                            return data["embedding"]
                    # Model not pulled or unavailable — fall through
                    self._ollama_available = False
                    logger.warning(
                        f"Ollama embedding unavailable (status {res.status_code}). "
                        "Using deterministic fallback. Pull model with: "
                        f"ollama pull {self.model}"
                    )
            except Exception as e:
                self._ollama_available = False
                logger.warning(f"Ollama not reachable ({e}). Using deterministic fallback embeddings.")

        return self._generate_fallback_embedding(safe_text, dim=settings.QDRANT_VECTOR_SIZE)

    def _generate_fallback_embedding(self, text: str, dim: int = settings.QDRANT_VECTOR_SIZE) -> List[float]:
        """
        Deterministic pseudo-embedding based on text hash.
        Enables full RAG functionality without Ollama — semantic search quality
        is keyword-level rather than semantic; adequate for hybrid retrieval.
        Replace with a real embedding model for production semantic search.
        """
        vec = []
        for i in range(dim):
            seed_str = f"{text}_{i}"
            h = int(hashlib.md5(seed_str.encode("utf-8")).hexdigest(), 16)
            val = (h % 20000 - 10000) / 10000.0
            vec.append(val)
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        return [x / norm for x in vec]
