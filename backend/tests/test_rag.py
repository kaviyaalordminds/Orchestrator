"""
Comprehensive test suite for the Orchestrator RAG integration.
Covers: Obsidian connection, chunking, vector store, retrieval, chat, security.
Run:  pytest tests/ -v
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.obsidian import ObsidianClient
from app.services.chunker import chunk_markdown, extract_frontmatter, extract_tags, compute_hash
from app.services.vector_store import QdrantVectorStore
from app.services.rag_service import RAGService


# ─────────────────────────────────────────────────────────────────────────────
# Obsidian Client Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestObsidianConnection:
    @pytest.mark.asyncio
    async def test_health_ok(self):
        """Obsidian REST API must respond with status OK and authenticated=True."""
        client = ObsidianClient()
        health = await client.check_health()
        assert health["status"] == "OK"
        assert health["authenticated"] is True

    @pytest.mark.asyncio
    async def test_list_root(self):
        """Vault root must list at least one top-level folder."""
        client = ObsidianClient()
        files = await client.list_files()
        assert isinstance(files, list)
        assert len(files) > 0

    @pytest.mark.asyncio
    async def test_read_known_note(self):
        """Should successfully read a known note from the AI-OS vault."""
        client = ObsidianClient()
        content = await client.read_note("AI-OS/README.md")
        assert "AI-OS" in content
        assert len(content) > 100

    @pytest.mark.asyncio
    async def test_search_notes(self):
        """Native Obsidian search must return results for a common term."""
        client = ObsidianClient()
        results = await client.search_notes("marketing")
        assert isinstance(results, list)
        assert len(results) > 0
        assert "filename" in results[0]

    @pytest.mark.asyncio
    async def test_get_all_markdown_files(self):
        """Recursive file scan must find markdown files without hitting .obsidian/."""
        client = ObsidianClient()
        files = await client.get_all_markdown_files("AI-OS")
        assert len(files) > 5
        assert "AI-OS/README.md" in files
        # System folders must be excluded
        assert not any(".obsidian" in f for f in files)

    @pytest.mark.asyncio
    async def test_bad_api_key_rejected(self):
        """A wrong API key must not return authenticated=True."""
        client = ObsidianClient(api_key="badkey")
        health = await client.check_health()
        assert health.get("authenticated") is not True


# ─────────────────────────────────────────────────────────────────────────────
# Markdown Chunker Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestMarkdownChunker:
    def test_basic_chunking(self):
        raw = "# Title\n\nParagraph one.\n\n## Sub\n\nParagraph two."
        chunks = chunk_markdown("Test/Note.md", raw)
        assert len(chunks) >= 1
        assert all("source_path" in c for c in chunks)
        assert all("content_hash" in c for c in chunks)

    def test_frontmatter_extraction(self):
        raw = "---\ntitle: My Note\ntags: ai, test\n---\n# Body\nContent here."
        fm, body = extract_frontmatter(raw)
        assert fm.get("title") == "My Note"
        assert "Body" in body

    def test_tag_extraction(self):
        raw = "Some content with #ai-tag and #project/work tags."
        tags = extract_tags(raw)
        assert "ai-tag" in tags
        assert "project/work" in tags

    def test_chunk_metadata_preserved(self):
        raw = "---\ntags: dev\n---\n# Main\n\nContent."
        chunks = chunk_markdown("Folder/My Note.md", raw, chunk_size=50)
        assert chunks[0]["source_path"] == "Folder/My Note.md"
        assert chunks[0]["title"] == "My Note"
        assert chunks[0]["file_name"] == "My Note.md"

    def test_content_hash_is_deterministic(self):
        content = "Hello world"
        assert compute_hash(content) == compute_hash(content)

    def test_empty_note_yields_no_chunks(self):
        chunks = chunk_markdown("Empty.md", "   \n\n  ")
        assert chunks == [] or all(c["content"].strip() == "" for c in chunks)

    def test_large_section_is_split(self):
        words = " ".join([f"word{i}" for i in range(1200)])
        raw = f"# Big Section\n\n{words}"
        chunks = chunk_markdown("Big.md", raw, chunk_size=200, chunk_overlap=50)
        assert len(chunks) > 1

    def test_unicode_note(self):
        raw = "# Titre\n\nContenu en français avec des accents: é à ü ñ 日本語."
        chunks = chunk_markdown("Unicode.md", raw)
        assert any("français" in c["content"] for c in chunks)

    def test_no_duplicate_chunks(self):
        raw = "# Section\n\nA short note."
        c1 = chunk_markdown("Note.md", raw)
        c2 = chunk_markdown("Note.md", raw)
        ids1 = {c["chunk_id"] for c in c1}
        ids2 = {c["chunk_id"] for c in c2}
        assert ids1 == ids2  # deterministic


# ─────────────────────────────────────────────────────────────────────────────
# Vector Store Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestVectorStore:
    def test_collection_created(self):
        vs = QdrantVectorStore(location=":memory:", collection_name="test_col", vector_size=4)
        stats = vs.get_stats()
        assert stats["collection"] == "test_col"

    def test_upsert_and_search(self):
        vs = QdrantVectorStore(location=":memory:", collection_name="test_col2", vector_size=4)
        chunk = {
            "chunk_id": "doc1_0",
            "document_id": "doc1",
            "source_path": "Test/Note.md",
            "file_name": "Note.md",
            "title": "Note",
            "heading": "Section",
            "tags": ["test"],
            "content": "Test content here.",
            "content_hash": compute_hash("Test content here."),
            "embedding": [1.0, 0.0, 0.0, 0.0]
        }
        vs.upsert_chunks([chunk])
        results = vs.search([1.0, 0.0, 0.0, 0.0], top_k=1)
        assert len(results) == 1
        assert results[0]["payload"]["source_path"] == "Test/Note.md"

    def test_delete_by_document(self):
        vs = QdrantVectorStore(location=":memory:", collection_name="test_col3", vector_size=4)
        chunk = {
            "chunk_id": "del_doc_0",
            "document_id": "del_doc",
            "source_path": "Del/Note.md",
            "file_name": "Note.md",
            "title": "Note",
            "heading": "",
            "tags": [],
            "content": "Content to delete.",
            "content_hash": compute_hash("Content to delete."),
            "embedding": [0.0, 1.0, 0.0, 0.0]
        }
        vs.upsert_chunks([chunk])
        vs.delete_by_document("Del/Note.md")
        results = vs.search([0.0, 1.0, 0.0, 0.0], top_k=5)
        assert all(r["payload"]["source_path"] != "Del/Note.md" for r in results)

    def test_upsert_is_idempotent(self):
        vs = QdrantVectorStore(location=":memory:", collection_name="test_idem", vector_size=4)
        chunk = {
            "chunk_id": "idem_0",
            "document_id": "idem",
            "source_path": "Idem/Note.md",
            "file_name": "Note.md",
            "title": "Note",
            "heading": "",
            "tags": [],
            "content": "Idempotent.",
            "content_hash": compute_hash("Idempotent."),
            "embedding": [0.5, 0.5, 0.0, 0.0]
        }
        vs.upsert_chunks([chunk])
        vs.upsert_chunks([chunk])
        results = vs.search([0.5, 0.5, 0.0, 0.0], top_k=10)
        paths = [r["payload"]["source_path"] for r in results]
        assert paths.count("Idem/Note.md") == 1  # no duplicates



# ─────────────────────────────────────────────────────────────────────────────
# RAG Service Integration Tests
# Uses in-memory Qdrant to avoid file-lock conflicts with a running server.
# These tests require Obsidian to be running with the Local REST API enabled.
# ─────────────────────────────────────────────────────────────────────────────

def _rag_with_memory() -> RAGService:
    """Build a RAGService backed by in-memory Qdrant for test isolation."""
    rag = RAGService.__new__(RAGService)
    rag.obsidian = ObsidianClient()
    rag.embedder = __import__("app.services.embedding", fromlist=["EmbeddingService"]).EmbeddingService()
    rag.vector_store = QdrantVectorStore(location=":memory:", collection_name="test_rag", vector_size=__import__("app.config", fromlist=["settings"]).settings.QDRANT_VECTOR_SIZE)
    return rag


class TestRAGService:
    async def test_full_index_and_retrieve(self):
        """Full end-to-end: index vault, retrieve relevant chunks."""
        rag = _rag_with_memory()
        res = await rag.index_vault(force_reindex=True)
        assert res["status"] == "success"
        s = res["stats"]
        assert s["processed"] > 0
        assert s["chunks_created"] > 0
        assert s["failed"] == 0 or s["processed"] > s["failed"]

        # Retrieval must return sources
        chunks = await rag.retrieve_context("AI-OS")
        assert len(chunks) > 0
        assert all("source_path" in c for c in chunks)

    async def test_incremental_index_skips_unchanged(self):
        """Second indexing run on same notes must skip all unchanged notes."""
        rag = _rag_with_memory()
        await rag.index_vault(force_reindex=True)
        # Second index — all notes unchanged
        res2 = await rag.index_vault(force_reindex=False)
        assert res2["status"] == "success"
        assert res2["stats"]["processed"] == 0
        assert res2["stats"]["skipped"] > 0

    async def test_relevant_query_returns_sources(self):
        """Query about vault topic must return non-empty sources."""
        rag = _rag_with_memory()
        await rag.index_vault(force_reindex=True)
        result = await rag.generate_rag_chat_reply([
            {"role": "user", "content": "AI-OS"}
        ])
        assert "reply" in result
        assert len(result["sources"]) > 0
        # Source paths must be vault-relative paths (no absolute filesystem paths)
        for src in result["sources"]:
            path = src["source_path"]
            assert not path.startswith("/Users"), f"Absolute path leaked: {path}"

    async def test_no_result_query(self):
        """An unrelated query must not crash and must return a polite reply."""
        rag = _rag_with_memory()
        result = await rag.generate_rag_chat_reply([
            {"role": "user", "content": "xyzzy quux florp baz 99999999"}
        ])
        assert "reply" in result
        assert isinstance(result["reply"], str)
        assert len(result["reply"]) > 0

    async def test_source_paths_are_relative(self):
        """Source paths returned to users must never expose absolute filesystem paths."""
        rag = _rag_with_memory()
        await rag.index_vault(force_reindex=True)
        chunks = await rag.retrieve_context("marketing")
        for c in chunks:
            path = c.get("source_path", "")
            assert not path.startswith("/"), f"Absolute path exposed: {path}"
            assert "Users" not in path, f"User home dir exposed: {path}"
