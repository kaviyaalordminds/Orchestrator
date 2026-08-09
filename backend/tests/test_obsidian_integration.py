"""
End-to-end integration tests that do NOT require a real Obsidian install.

A minimal in-process HTTP server reproduces the exact contract of the
Obsidian Local REST API (GET /, GET /vault/<path>, POST /search/simple/) so
the full pipeline — list notes, read notes, search, chunk, embed, retrieve,
build context, attach sources, and the OBSIDIAN_ONLY negative case — is
exercised for real, end to end, without depending on the user's machine.

Run:  pytest tests/test_obsidian_integration.py -v
"""
import json
import sys
import os
import threading
import http.server
import socket
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.obsidian import ObsidianClient, _validate_vault_relative_path
from app.services.vector_store import QdrantVectorStore
from app.services.embedding import EmbeddingService
from app.services.rag_service import RAGService

VALID_KEY = "test-key-123"

VAULT = {
    "Projects/AI-Project.md": "# AI Project\n\nThe Orchestrator AI project integrates Obsidian with a RAG backend.\n",
    "Notes/Unrelated.md": "# Grocery List\n\nMilk, eggs, bread.\n",
}


class FakeObsidianHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # silence

    def _authed(self) -> bool:
        return self.headers.get("Authorization") == f"Bearer {VALID_KEY}"

    def _send_json(self, code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/":
            if not self._authed():
                self._send_json(200, {"status": "OK", "authenticated": False, "versions": {"self": "1.0.0"}})
                return
            self._send_json(200, {"status": "OK", "authenticated": True, "versions": {"self": "1.0.0"}})
            return

        if self.path.startswith("/vault/"):
            rel = self.path[len("/vault/"):].strip("/")
            if not rel:
                folders = sorted({p.split("/")[0] + "/" for p in VAULT})
                self._send_json(200, {"files": list(folders)})
                return
            if rel in VAULT:
                body = VAULT[rel].encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/markdown")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            # directory listing
            prefix = rel.rstrip("/") + "/"
            children = sorted({p[len(prefix):].split("/")[0] for p in VAULT if p.startswith(prefix)})
            if children:
                self._send_json(200, {"files": children})
                return
            self.send_response(404)
            self.end_headers()
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path.startswith("/search/simple/"):
            from urllib.parse import urlparse, parse_qs
            query = parse_qs(urlparse(self.path).query).get("query", [""])[0].lower()
            matches = [
                {"filename": path, "score": 1.0}
                for path, content in VAULT.items()
                if query and query in content.lower()
            ]
            self._send_json(200, matches)
            return
        self.send_response(404)
        self.end_headers()


@pytest.fixture(scope="module")
def fake_obsidian_url():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), FakeObsidianHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}"
    server.shutdown()


def _rag_against_fake(url: str) -> RAGService:
    rag = RAGService.__new__(RAGService)
    rag.obsidian = ObsidianClient(base_url=url, api_key=VALID_KEY, verify_ssl=False)
    rag.embedder = EmbeddingService()
    rag.vector_store = QdrantVectorStore(location=":memory:", collection_name="fake_test", vector_size=768)
    return rag


class TestObsidianClientAgainstFakeServer:
    @pytest.mark.asyncio
    async def test_health_authenticated(self, fake_obsidian_url):
        client = ObsidianClient(base_url=fake_obsidian_url, api_key=VALID_KEY, verify_ssl=False)
        health = await client.check_health()
        assert health["status"] == "OK"
        assert health["authenticated"] is True

    @pytest.mark.asyncio
    async def test_bad_key_not_authenticated(self, fake_obsidian_url):
        client = ObsidianClient(base_url=fake_obsidian_url, api_key="wrong-key", verify_ssl=False)
        health = await client.check_health()
        assert health["authenticated"] is False

    @pytest.mark.asyncio
    async def test_list_and_read(self, fake_obsidian_url):
        client = ObsidianClient(base_url=fake_obsidian_url, api_key=VALID_KEY, verify_ssl=False)
        files = await client.get_all_markdown_files()
        assert "Projects/AI-Project.md" in files
        content = await client.read_note("Projects/AI-Project.md")
        assert "Orchestrator AI project" in content

    @pytest.mark.asyncio
    async def test_search(self, fake_obsidian_url):
        client = ObsidianClient(base_url=fake_obsidian_url, api_key=VALID_KEY, verify_ssl=False)
        results = await client.search_notes("Orchestrator")
        assert any(r["filename"] == "Projects/AI-Project.md" for r in results)

    @pytest.mark.asyncio
    async def test_get_note_metadata(self, fake_obsidian_url):
        client = ObsidianClient(base_url=fake_obsidian_url, api_key=VALID_KEY, verify_ssl=False)
        meta = await client.get_note_metadata("Projects/AI-Project.md")
        assert meta["source_path"] == "Projects/AI-Project.md"
        assert meta["file_name"] == "AI-Project.md"

    def test_path_traversal_blocked(self):
        with pytest.raises(PermissionError):
            _validate_vault_relative_path("../../etc/passwd")
        with pytest.raises(PermissionError):
            _validate_vault_relative_path("Projects/../../secret.md")
        assert _validate_vault_relative_path("Projects/AI-Project.md") == "Projects/AI-Project.md"


class TestEndToEndRAGPipeline:
    """
    USER -> AI Agent -> Obsidian search -> relevant notes -> context ->
    AI Agent -> response -> sources
    """

    @pytest.mark.asyncio
    async def test_full_pipeline_returns_grounded_answer_with_sources(self, fake_obsidian_url):
        rag = _rag_against_fake(fake_obsidian_url)
        index_result = await rag.index_vault(force_reindex=True)
        assert index_result["status"] == "success"
        assert index_result["stats"]["chunks_created"] > 0

        result = await rag.generate_rag_chat_reply(
            [{"role": "user", "content": "What do I have about my AI project?"}]
        )
        assert "reply" in result
        assert "INSUFFICIENT_VAULT_CONTEXT" not in result["reply"]
        assert len(result["sources"]) > 0
        assert result["sources"][0]["source_path"] == "Projects/AI-Project.md"

    @pytest.mark.asyncio
    async def test_negative_query_returns_insufficient_context(self, fake_obsidian_url):
        """A topic absent from the vault must not be answered from the LLM's own knowledge."""
        rag = _rag_against_fake(fake_obsidian_url)
        await rag.index_vault(force_reindex=True)

        result = await rag.generate_rag_chat_reply(
            [{"role": "user", "content": "quantum flux capacitor warp drive schematics zzqx"}]
        )
        assert "INSUFFICIENT_VAULT_CONTEXT" in result["reply"]
        assert result["sources"] == []

    @pytest.mark.asyncio
    async def test_health_endpoint_reports_real_connectivity(self, fake_obsidian_url):
        rag = _rag_against_fake(fake_obsidian_url)
        health = await rag.obsidian.check_health()
        assert health["status"] == "OK"
        assert health["authenticated"] is True
