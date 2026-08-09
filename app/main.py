from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.api.chat import router as chat_router
from app.api.rag import router as rag_router, get_rag

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
    version="1.1.0",
    description=(
        "Orchestrator AI backend — integrates Obsidian Local REST API "
        "with Qdrant RAG to power the company knowledge assistant."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Lock down to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api/v1", tags=["Chat"])
app.include_router(rag_router, prefix="/api/v1/rag", tags=["RAG Admin"])


@app.get("/api/v1/health", tags=["System"])
def health_check():
    return {"status": "ok", "service": "Orchestrator Backend", "version": "1.1.0"}
