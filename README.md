# Orchestrator — Company Knowledge Assistant

A production-grade AI assistant that integrates your existing **Obsidian Knowledge Base** with a **RAG (Retrieval-Augmented Generation)** architecture to answer company questions using actual vault notes as context.

---

## Architecture

```
                USER / FRONTEND (index.html + chat.js)
                               │
                               ▼
                      POST /api/v1/chat
                               │
                               ▼
                     ┌──────────────────┐
                     │   RAG SERVICE    │
                     └────────┬─────────┘
                              │
             ┌────────────────┴───────────────┐
             ▼                               ▼
   ┌──────────────────┐            ┌──────────────────┐
   │  QDRANT VECTOR   │            │  OBSIDIAN REST   │
   │    DATABASE      │            │   API CLIENT     │
   │  (local on-disk) │            │  127.0.0.1:27124 │
   └────────┬─────────┘            └──────────────────┘
            │
     Relevant chunks
            │
            ▼
   ┌──────────────────┐
   │  LLM (Ollama /  │
   │  OpenAI / etc.) │
   └────────┬─────────┘
            ▼
      Answer + Sources
            │
            ▼
        Frontend UI
```

**Ingestion Pipeline:**
```
Existing Obsidian REST API → Markdown Parser → Semantic Chunker → Embeddings → Qdrant
```

---

## Key Guarantees

| Rule | Status |
|------|--------|
| Vault location unchanged | ✅ `/Users/bharath/Documents/Obsidian Vault` |
| Vault not copied into project | ✅ |
| Existing Obsidian plugin untouched | ✅ `obsidian-local-rest-api` v5.1.0 |
| No new MCP server installed | ✅ REST API used directly |
| Existing `/api/v1/chat` preserved | ✅ |
| No credentials committed | ✅ `.env` is gitignored |

---

## Quick Start

### Prerequisites

- Obsidian running with **Local REST API with MCP** plugin enabled
- Python 3.9+
- (Optional) [Ollama](https://ollama.ai) running locally for LLM inference

### 1. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env — set OBSIDIAN_API_KEY from Obsidian → Settings → Local REST API
```

### 2. Start the Backend

```bash
bash backend/start.sh
```

The server auto-indexes your vault on first start if the vector store is empty.

### 3. Open the Frontend

Open `index.html` in your browser (or serve it with any static file server).

---

## API Reference

### Chat

```
POST /api/v1/chat
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "What is our Q4 marketing strategy?" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reply": "Based on your Obsidian Knowledge Base…",
    "sources": [
      { "title": "Q4 Strategy", "source_path": "AI-OS/20-Marketing/Q4 Strategy.md" }
    ]
  }
}
```

### RAG Admin

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `POST` | `/api/v1/rag/index` | `X-Admin-Key` | Incremental index |
| `POST` | `/api/v1/rag/reindex` | `X-Admin-Key` | Force full re-index |
| `GET`  | `/api/v1/rag/status` | None | Obsidian + Qdrant health |
| `GET`  | `/api/v1/rag/search?query=…` | None | Debug: raw chunk search |

**Admin example:**
```bash
curl -X POST http://127.0.0.1:8000/api/v1/rag/index \
  -H "X-Admin-Key: your-admin-api-key-here"
```

---

## Incremental Indexing

The system uses **SHA-256 content hashing** for efficient incremental updates:

| Note state | Action |
|------------|--------|
| New | Chunk → Embed → Upsert to Qdrant |
| Modified | Delete old chunks → Re-chunk → Re-embed → Upsert |
| Deleted from vault | Remove chunks from Qdrant |
| Unchanged | Skip — no re-embedding |

This means re-indexing a large vault is fast — only changed notes are processed.

---

## Configuration

All settings are in `backend/.env` (never commit this file):

| Variable | Purpose | Default |
|----------|---------|---------|
| `OBSIDIAN_API_URL` | Obsidian Local REST API HTTPS URL | `https://127.0.0.1:27124` |
| `OBSIDIAN_API_KEY` | Bearer token from Obsidian settings | _(required)_ |
| `OBSIDIAN_VERIFY_SSL` | Verify self-signed cert | `false` |
| `QDRANT_LOCATION` | On-disk path for vector persistence | `./data/qdrant` |
| `QDRANT_COLLECTION` | Qdrant collection name | `obsidian_vault` |
| `OLLAMA_URL` | Local Ollama server URL | `http://127.0.0.1:11434` |
| `EMBEDDING_MODEL` | Ollama embedding model | `nomic-embed-text` |
| `LLM_MODEL` | Ollama chat model | `llama3` |
| `RAG_TOP_K` | Chunks returned per query | `5` |
| `RAG_CHUNK_SIZE` | Words per chunk | `500` |
| `RAG_CHUNK_OVERLAP` | Words of overlap between chunks | `100` |
| `ADMIN_API_KEY` | Protects `/rag/index` and `/rag/reindex` | _(set in production)_ |

---

## Running Tests

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

**Test coverage:**
- Obsidian REST API connection, authentication, note reading, search
- Markdown parsing: frontmatter, tags, headings, Unicode, empty notes
- Chunking: section splitting, overlap, metadata preservation, idempotency
- Vector store: upsert, search, delete, idempotency
- RAG service: full indexing, incremental indexing, retrieval, chat completion
- Security: source path exposure, bad API key rejection

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `Connection refused` on port 8000 | Backend not running | `bash backend/start.sh` |
| `authenticated: false` | Wrong `OBSIDIAN_API_KEY` | Copy key from Obsidian → Settings → Local REST API |
| `points_count: 0` | Vault not yet indexed | `POST /api/v1/rag/index` |
| No sources returned | Query term not in vault | Try `/api/v1/rag/search?query=…` to debug |
| Obsidian API unreachable | Obsidian app not open | Open Obsidian on your Mac |
| Slow first response | Qdrant loading index | Warm-up happens once on startup |
| LLM returns no reply | Ollama model not pulled | `ollama pull llama3 && ollama pull nomic-embed-text` |

---

## File Structure

```
Orchestrator/
├── index.html                  # Frontend SPA
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── app.js              # Core app (API base, auth headers)
│       ├── chat.js             # Chat UI — source badge rendering added
│       └── …
├── backend/
│   ├── .env.example            # Config template (copy to .env)
│   ├── requirements.txt        # Python dependencies
│   ├── start.sh                # Startup convenience script
│   ├── pytest.ini
│   ├── app/
│   │   ├── main.py             # FastAPI app + lifespan startup
│   │   ├── config.py           # Pydantic settings
│   │   ├── api/
│   │   │   ├── chat.py         # POST /api/v1/chat
│   │   │   └── rag.py          # /api/v1/rag/* (index, reindex, status, search)
│   │   └── services/
│   │       ├── obsidian.py     # Obsidian REST API client
│   │       ├── chunker.py      # Markdown parser & semantic chunker
│   │       ├── embedding.py    # Embedding service (Ollama + fallback)
│   │       ├── vector_store.py # Qdrant integration
│   │       └── rag_service.py  # RAG orchestrator (index, retrieve, chat)
│   ├── data/
│   │   └── qdrant/             # Persistent vector storage (gitignored)
│   └── tests/
│       └── test_rag.py         # Comprehensive test suite
└── README.md                   # This file
```

---

## Security Notes

- The Obsidian vault is accessed **read-only** via the Local REST API. No notes are created, modified, or deleted.
- Absolute vault filesystem paths are never exposed to users — only vault-relative paths like `AI-OS/README.md`.
- API keys are loaded from `.env` and never logged or returned in API responses.
- Admin indexing endpoints require `X-Admin-Key` header when `ADMIN_API_KEY` is set.
- The vector store contains only note content chunks — never credentials or system metadata.


## Chat routing behavior

Chat now uses intent routing. Greetings and ordinary general questions are sent directly to the configured LLM without Obsidian retrieval. Personal, internal, project-specific, and explicitly Obsidian-related questions use the existing RAG pipeline. Obsidian source metadata is hidden from normal chat responses; `/api/v1/chat` accepts `include_sources=true` only when source inspection is explicitly requested.

The current uploaded backend uses Ollama as its LLM provider. There is no Claude Code/MCP client implementation in this codebase yet, so the direct path currently means the configured LLM (Ollama). Claude Code can be integrated later without changing the routing contract.
