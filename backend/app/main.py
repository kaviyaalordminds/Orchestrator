from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.api.chat import router as chat_router
from app.api.rag import router as rag_router, get_rag
from app.api.audio import router as audio_router
from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger("orchestrator")


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup: warm the RAG service (loads Qdrant collection) so first request is fast."""
    logger.info("Orchestrator backend starting — warming RAG service…")
    rag = get_rag()
    stats = rag.vector_store.get_stats()
    pts = stats.get("points_count", 0)
    logger.info(f"Qdrant ready — collection '{stats.get('collection')}', {pts} indexed chunks.")
    if pts == 0:
        logger.info("Vector store is empty — triggering initial vault indexing…")
        result = await rag.index_vault(force_reindex=False)
        s = result.get("stats", {})
        logger.info(
            f"Initial indexing complete: {s.get('processed', 0)} notes processed, "
            f"{s.get('chunks_created', 0)} chunks created, "
            f"{s.get('skipped', 0)} skipped, {s.get('failed', 0)} failed."
        )
    else:
        logger.info("Existing index found — skipping auto-index (use POST /api/v1/rag/index to update).")
    yield
    logger.info("Orchestrator backend shutting down.")


app = FastAPI(
    title="Orchestrator Backend API",
    version="1.2.0",
    description=(
        "Orchestrator AI backend — integrates Obsidian Local REST API "
        "with Qdrant RAG to power the company knowledge assistant."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Local development; restrict in production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api/v1", tags=["Chat"])
app.include_router(rag_router, prefix="/api/v1/rag", tags=["RAG Admin"])
app.include_router(audio_router, prefix="/api/v1/audio", tags=["Audio"])


@app.get("/api/v1/health", tags=["System"])
async def health_check():
    """Real dependency health check; does not claim success when dependencies are down."""
    rag = get_rag()
    result = {
        "status": "ok",
        "service": "Orchestrator Backend",
        "version": "1.2.0",
        "chat_router": "2.0-intent-routing",
        "dependencies": {
            "qdrant": rag.vector_store.get_stats(),
            "obsidian": {"connected": False},
            "ollama": {"connected": False, "model": rag.embedder.model},
        },
    }

    try:
        health = await rag.obsidian.check_health()
        result["dependencies"]["obsidian"] = {
            "connected": True,
            "status": health.get("status"),
            "authenticated": health.get("authenticated"),
            "version": health.get("versions", {}).get("self"),
        }
    except Exception as exc:
        result["dependencies"]["obsidian"] = {
            "connected": False,
            "error": str(exc),
        }
        result["status"] = "degraded"

    try:
        import httpx
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{settings.OLLAMA_URL.rstrip('/')}/api/tags")
            response.raise_for_status()
            models = [m.get("name") for m in response.json().get("models", [])]
            result["dependencies"]["ollama"] = {
                "connected": True,
                "model": rag.embedder.model,
                "chat_model": settings.LLM_MODEL,
                "models": models,
                "chat_model_available": settings.LLM_MODEL in models,
                "embedding_model_available": rag.embedder.model in models,
            }
            if settings.LLM_MODEL not in models:
                result["status"] = "degraded"
    except Exception as exc:
        result["dependencies"]["ollama"] = {
            "connected": False,
            "chat_model": settings.LLM_MODEL,
            "embedding_model": rag.embedder.model,
            "error": str(exc),
        }
        result["status"] = "degraded"

    return result


@app.get("/api/v1/build")
async def build_info():
    return {
        "service": "Orchestrator",
        "build": "chat-routing-v3",
        "chat_routing": "intent + dedicated direct endpoint",
        "vault_for_greetings": False,
        "note": "Restart the backend after updating source files."
    }
