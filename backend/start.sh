#!/usr/bin/env bash
# start.sh — Start the Orchestrator backend
# Usage: bash start.sh [--index]
#
#   --index   Trigger a full vault re-index before starting (useful after
#             adding many new notes). Otherwise the server auto-indexes on
#             first start if the vector store is empty.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV="$SCRIPT_DIR/venv"

# ── 1. Activate virtualenv ──────────────────────────────────────────────────
if [ ! -d "$VENV" ]; then
  echo "Creating Python virtual environment…"
  python3 -m venv "$VENV"
fi

source "$VENV/bin/activate"
pip install -q -r requirements.txt

# ── 2. Check for .env ───────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "⚠  No .env found — copying .env.example as a starting point."
  cp .env.example .env
  echo "   Edit backend/.env and set OBSIDIAN_API_KEY and ADMIN_API_KEY before production use."
fi

# ── 3. Optional manual pre-index ────────────────────────────────────────────
if [[ "${1:-}" == "--index" ]]; then
  echo "Running full vault re-index before server start…"
  python - <<'PYEOF'
import asyncio, sys, os
sys.path.insert(0, os.getcwd())
from app.services.rag_service import RAGService

async def main():
    rag = RAGService()
    res = await rag.index_vault(force_reindex=True)
    s = res.get("stats", {})
    print(f"Index complete: {s.get('processed',0)} processed, "
          f"{s.get('chunks_created',0)} chunks, {s.get('failed',0)} failed.")

asyncio.run(main())
PYEOF
fi

# ── 4. Start FastAPI server ─────────────────────────────────────────────────
echo ""
echo "Starting Orchestrator backend on http://127.0.0.1:8000"
echo "  API Docs: http://127.0.0.1:8000/docs"
echo ""
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
