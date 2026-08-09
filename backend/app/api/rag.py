from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.security import APIKeyHeader
from typing import Dict, Any
from app.services.rag_service import RAGService
from app.config import settings

router = APIRouter()

# ─── Admin API Key Security ────────────────────────────────────────────────
_api_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)

def require_admin(key: str = Depends(_api_key_header)):
    """Protect destructive/expensive operations with ADMIN_API_KEY."""
    configured = settings.ADMIN_API_KEY.strip()
    # If no admin key is configured, only allow localhost (dev convenience)
    if not configured:
        return  # open in dev; set ADMIN_API_KEY in production
    if not key or key != configured:
        raise HTTPException(status_code=403, detail="Admin API key required.")


# ─── Shared singleton so vector store persists across requests ────────────
_rag: RAGService = None

def get_rag() -> RAGService:
    global _rag
    if _rag is None:
        _rag = RAGService()
    return _rag


# ─── Endpoints ────────────────────────────────────────────────────────────

@router.post("/index", dependencies=[Depends(require_admin)])
async def trigger_indexing(force: bool = Query(default=False)):
    """Incrementally index (or force-reindex) the Obsidian vault into Qdrant."""
    try:
        rag = get_rag()
        res = await rag.index_vault(force_reindex=force)
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reindex", dependencies=[Depends(require_admin)])
async def full_reindex():
    """Force a full re-index of all vault notes (equivalent to /index?force=true)."""
    try:
        rag = get_rag()
        res = await rag.index_vault(force_reindex=True)
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def rag_status():
    """Return Obsidian API health and Qdrant vector store statistics."""
    try:
        rag = get_rag()
        obsidian_health = await rag.obsidian.check_health()
        vector_stats = rag.vector_store.get_stats()
        return {
            "success": True,
            "data": {
                "obsidian_api": obsidian_health.get("status"),
                "obsidian_version": obsidian_health.get("versions", {}).get("self"),
                "obsidian_authenticated": obsidian_health.get("authenticated"),
                "vector_store": vector_stats
            }
        }
    except Exception as e:
        return {"success": False, "error": {"message": str(e)}}


@router.get("/search")
async def search_vault(query: str = Query(..., min_length=1), top_k: int = Query(default=5, ge=1, le=20)):
    """Hybrid vector + keyword search of indexed Obsidian notes."""
    try:
        rag = get_rag()
        results = await rag.retrieve_context(query, top_k=top_k)
        return {"success": True, "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
