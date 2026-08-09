from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from typing import List, Dict, Any, Optional
from pathlib import Path
import uuid
import logging
from app.config import settings

logger = logging.getLogger("vector_store")


def _make_qdrant_client(location: str) -> QdrantClient:
    """
    Create a QdrantClient correctly depending on the location string:
      - ":memory:"         → in-memory (test / no-persist mode)
      - any other string  → on-disk local persistent storage at that path

    IMPORTANT: always use path= for local disk; never pass a filesystem path
    to location= because Qdrant will try to open it as a remote HTTPS URL,
    causing 'IDNA encoding failed' errors on long paths.
    """
    if location == ":memory:":
        return QdrantClient(location=":memory:")
    # Resolve to absolute path so Qdrant doesn't mis-interpret it as a URL
    abs_path = str(Path(location).resolve())
    Path(abs_path).mkdir(parents=True, exist_ok=True)
    return QdrantClient(path=abs_path)


class QdrantVectorStore:
    def __init__(
        self,
        location: str = settings.QDRANT_LOCATION,
        collection_name: str = settings.QDRANT_COLLECTION,
        vector_size: int = settings.QDRANT_VECTOR_SIZE,
    ):
        self.collection_name = collection_name
        self.vector_size = vector_size
        self.client = _make_qdrant_client(location)
        self._ensure_collection()

    def _ensure_collection(self):
        try:
            existing = [c.name for c in self.client.get_collections().collections]
            if self.collection_name in existing:
                # Check if vector size matches — if not, recreate (e.g. switching embedding models)
                info = self.client.get_collection(self.collection_name)
                existing_size = info.config.params.vectors.size
                if existing_size != self.vector_size:
                    logger.warning(
                        f"Qdrant collection '{self.collection_name}' has vector size {existing_size}, "
                        f"but config requires {self.vector_size}. Dropping and recreating…"
                    )
                    self.client.delete_collection(self.collection_name)
                    existing = []  # fall through to create
                else:
                    logger.info(f"Using existing Qdrant collection '{self.collection_name}' ({existing_size}d)")
                    return

            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=self.vector_size, distance=Distance.COSINE),
            )
            logger.info(f"Created Qdrant collection '{self.collection_name}' (vector_size={self.vector_size})")
        except Exception as e:
            logger.error(f"Failed to ensure Qdrant collection: {e}")


    # ─── Write ───────────────────────────────────────────────────────────────

    def upsert_chunks(self, chunks_with_embeddings: List[Dict[str, Any]]):
        points = []
        for item in chunks_with_embeddings:
            # Deterministic UUID from chunk_id → idempotent upserts
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, item["chunk_id"]))
            payload = {
                "chunk_id":     item["chunk_id"],
                "document_id":  item["document_id"],
                "source_path":  item["source_path"],
                "file_name":    item["file_name"],
                "title":        item["title"],
                "heading":      item.get("heading", ""),
                "tags":         item.get("tags", []),
                "content":      item["content"],
                "content_hash": item["content_hash"],
            }
            points.append(PointStruct(id=point_id, vector=item["embedding"], payload=payload))

        if points:
            self.client.upsert(collection_name=self.collection_name, points=points)

    def delete_by_document(self, source_path: str):
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=Filter(
                must=[FieldCondition(key="source_path", match=MatchValue(value=source_path))]
            ),
        )

    # ─── Read ────────────────────────────────────────────────────────────────

    def search(self, query_vector: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
        try:
            results = self.client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                limit=top_k,
            ).points
        except Exception as e:
            logger.error(f"Vector search error: {e}")
            return []
        return [{"score": hit.score, "payload": hit.payload} for hit in results]

    def get_indexed_documents(self) -> Dict[str, str]:
        """Return mapping of source_path → content_hash for all indexed chunks."""
        indexed: Dict[str, str] = {}
        try:
            offset = None
            while True:
                scroll_res, next_offset = self.client.scroll(
                    collection_name=self.collection_name,
                    offset=offset,
                    limit=1000,
                    with_payload=True,
                    with_vectors=False,
                )
                for pt in scroll_res:
                    payload = pt.payload or {}
                    path = payload.get("source_path")
                    content_hash = payload.get("content_hash")
                    if path and content_hash:
                        indexed[path] = content_hash
                if next_offset is None:
                    break
                offset = next_offset
        except Exception as e:
            logger.warning(f"Error scrolling vector store: {e}")
        return indexed

    def get_stats(self) -> Dict[str, Any]:
        try:
            info = self.client.get_collection(self.collection_name)
            return {
                "collection":   self.collection_name,
                "points_count": getattr(info, "points_count", 0) or 0,
                "status":       str(getattr(info, "status", "unknown")),
            }
        except Exception as e:
            return {"collection": self.collection_name, "error": str(e)}
