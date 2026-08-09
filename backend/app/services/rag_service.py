from typing import List, Dict, Any, Optional
import logging
from app.services.obsidian import ObsidianClient
from app.services.chunker import chunk_markdown, compute_hash
from app.services.embedding import EmbeddingService
from app.services.vector_store import QdrantVectorStore
from app.config import settings
import httpx

logger = logging.getLogger("rag_service")

class RAGService:
    def __init__(self):
        self.obsidian = ObsidianClient()
        self.embedder = EmbeddingService()
        self.vector_store = QdrantVectorStore()

    async def index_vault(self, force_reindex: bool = False) -> Dict[str, Any]:
        """Performs incremental (or forced full) indexing of the Obsidian Vault."""
        stats = {
            "total_notes": 0,
            "processed": 0,
            "skipped": 0,
            "failed": 0,
            "chunks_created": 0
        }

        try:
            markdown_files = await self.obsidian.get_all_markdown_files()
        except Exception as e:
            logger.error(f"Failed to scan Obsidian files: {e}")
            return {"status": "error", "message": f"Obsidian API unreachable: {e}"}

        stats["total_notes"] = len(markdown_files)
        indexed_docs = self.vector_store.get_indexed_documents()

        current_paths = set(markdown_files)
        # Handle deleted notes
        for indexed_path in list(indexed_docs.keys()):
            if indexed_path not in current_paths:
                logger.info(f"Removing deleted note from vector store: {indexed_path}")
                self.vector_store.delete_by_document(indexed_path)

        for note_path in markdown_files:
            try:
                raw_content = await self.obsidian.read_note(note_path)
                if not raw_content.strip():
                    stats["skipped"] += 1
                    continue

                doc_hash = compute_hash(raw_content)

                # Incremental check: skip if hash unchanged and not force_reindex
                if not force_reindex and indexed_docs.get(note_path) == doc_hash:
                    stats["skipped"] += 1
                    continue

                # If modified, purge old chunks first
                if indexed_docs.get(note_path):
                    self.vector_store.delete_by_document(note_path)

                # Chunk note
                chunks = chunk_markdown(
                    note_path,
                    raw_content,
                    chunk_size=settings.RAG_CHUNK_SIZE,
                    chunk_overlap=settings.RAG_CHUNK_OVERLAP
                )

                # Generate embeddings & store
                chunks_with_embeddings = []
                for chunk in chunks:
                    vec = await self.embedder.get_embedding(chunk["content"])
                    chunk["embedding"] = vec
                    chunks_with_embeddings.append(chunk)

                self.vector_store.upsert_chunks(chunks_with_embeddings)
                stats["processed"] += 1
                stats["chunks_created"] += len(chunks)

            except Exception as e:
                logger.error(f"Error indexing note '{note_path}': {e}")
                stats["failed"] += 1

        return {"status": "success", "stats": stats}

    async def retrieve_context(self, query: str, top_k: int = settings.RAG_TOP_K) -> List[Dict[str, Any]]:
        """Retrieves top relevant note chunks for user query, hybridizing vector search with native Obsidian search."""
        query_vec = await self.embedder.get_embedding(query)
        raw_results = self.vector_store.search(query_vec, top_k=top_k)
        results = [r for r in raw_results if r.get("score", 0.0) >= settings.RAG_MIN_SCORE]

        retrieved_chunks = []
        seen_paths = set()

        for res in results:
            payload = res.get("payload", {})
            src_path = payload.get("source_path")
            if src_path:
                seen_paths.add(src_path)
            retrieved_chunks.append({
                "score": res.get("score", 0.0),
                "source_path": src_path,
                "file_name": payload.get("file_name"),
                "title": payload.get("title"),
                "heading": payload.get("heading"),
                "content": payload.get("content"),
                "tags": payload.get("tags", [])
            })

        native_chunks = []
        try:
            import re
            clean_query = re.sub(r'[^\w\s-]', ' ', query).strip()
            clean_query = ' '.join(clean_query.split())

            native_matches = []
            if clean_query:
                native_matches = await self.obsidian.search_notes(clean_query)

            if not native_matches:
                stop_words = {
                    "what", "where", "when", "which", "who", "whom", "whose", "why", "how",
                    "tell", "about", "show", "from", "with", "this", "that", "does", "have",
                    "been", "would", "could", "should", "some", "many", "there", "their",
                    "me", "my", "we", "us", "our", "you", "your", "it", "its", "in", "on",
                    "at", "to", "or", "of", "is", "am", "are", "be", "by", "as", "an",
                    "the", "and", "for", "if", "no", "not", "so", "up", "do", "can", "will"
                }
                raw_words = query.split()
                keywords = []
                for w in raw_words:
                    cw = re.sub(r'[^\w-]', '', w).strip()
                    if len(cw) >= 2 and cw.lower() not in stop_words:
                        keywords.append(cw)

                from collections import Counter
                kw_counts = Counter()
                kw_item_map = {}
                for kw in keywords:
                    sub_matches = await self.obsidian.search_notes(kw)
                    for item in sub_matches:
                        fn = item.get("filename")
                        if fn:
                            kw_counts[fn] += 1
                            kw_item_map[fn] = item

                sorted_files = [fn for fn, _ in kw_counts.most_common(top_k)]
                native_matches = [kw_item_map[fn] for fn in sorted_files]

            for item in native_matches[:top_k]:
                filename = item.get("filename")
                if filename:
                    content = await self.obsidian.read_note(filename)
                    file_name = filename.split("/")[-1]
                    title = file_name.rsplit(".", 1)[0]
                    native_chunks.append({
                        "score": 1.0,
                        "source_path": filename,
                        "file_name": file_name,
                        "title": title,
                        "heading": "",
                        "content": content[:1500],
                        "tags": []
                    })
        except Exception as e:
            logger.warning(f"Hybrid search fallback notice: {e}")

        # Combine native keyword matches (score 1.0) and vector store matches, deduplicating
        combined = native_chunks + retrieved_chunks
        combined.sort(key=lambda x: -x["score"])

        final_chunks = []
        seen = set()
        for chunk in combined:
            path = chunk.get("source_path")
            if path and path not in seen:
                seen.add(path)
                final_chunks.append(chunk)

        return final_chunks[:top_k]

    async def generate_rag_chat_reply(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Generates RAG-enhanced response with source attribution."""
        last_user_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")

        sources = []
        context_str = ""
        if last_user_msg:
            chunks = await self.retrieve_context(last_user_msg)
            seen_sources = set()
            formatted_contexts = []

            for idx, c in enumerate(chunks, 1):
                src_path = c.get("source_path")
                title = c.get("title")
                heading = f" > {c['heading']}" if c.get("heading") else ""

                formatted_contexts.append(f"--- Context [{idx}] (Source: {src_path}{heading}) ---\n{c['content']}")

                if src_path and src_path not in seen_sources:
                    seen_sources.add(src_path)
                    sources.append({
                        "title": title,
                        "source_path": src_path
                    })

            if formatted_contexts:
                context_str = "\n\n".join(formatted_contexts)

        # OBSIDIAN_ONLY: the vault is the source of truth. If retrieval found
        # nothing relevant, say so explicitly instead of letting the LLM
        # answer from its own training data (which would be indistinguishable
        # from a real vault-grounded answer to the user).
        if settings.OBSIDIAN_ONLY and not context_str:
            logger.info("No vault context found for query — returning INSUFFICIENT_VAULT_CONTEXT")
            return {
                "reply": (
                    "INSUFFICIENT_VAULT_CONTEXT — I couldn't find anything relevant to this "
                    "in your Obsidian vault. Try rephrasing, or confirm the vault is indexed "
                    "(POST /api/v1/rag/index)."
                ),
                "sources": []
            }

        # Call local LLM (Ollama or system prompt engine)
        llm_reply = await self._call_llm(messages, context_str)
        return {
            "reply": llm_reply,
            "sources": sources
        }

    async def _call_llm(self, messages: List[Dict[str, str]], context: str) -> str:
        """Call Ollama LLM with RAG context. Falls back to smart context synthesis if LLM unavailable."""
        user_query = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")

        system_instruction = (
            "You are Orchestrator, an AI assistant with direct access to the company's Obsidian knowledge base.\n"
            "Answer the user's question clearly and helpfully using ONLY the provided Obsidian context below.\n"
            "Structure your answer with bullet points or short paragraphs where appropriate.\n"
            "If the context doesn't contain enough information to answer fully, say so clearly — "
            "do NOT hallucinate or invent internal company details.\n"
            "Always be concise, accurate, and reference the knowledge base naturally."
        )

        prompt_messages = [{"role": "system", "content": system_instruction}]
        if context:
            prompt_messages.append({
                "role": "system",
                "content": f"=== Obsidian Knowledge Base Context ===\n\n{context}\n\n=== End of Context ==="
            })
        prompt_messages.extend(messages)

        # ── Try Ollama ────────────────────────────────────────────────────────
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(
                    f"{settings.OLLAMA_URL}/api/chat",
                    json={
                        "model": settings.LLM_MODEL,
                        "messages": prompt_messages,
                        "stream": False,
                        "options": {"temperature": 0.3}
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    reply = data.get("message", {}).get("content", "").strip()
                    if reply:
                        logger.info(f"LLM replied via Ollama ({settings.LLM_MODEL})")
                        return reply
                else:
                    logger.warning(f"Ollama returned status {res.status_code}: {res.text[:200]}")
        except httpx.ConnectError:
            logger.warning("Ollama not reachable — using context-synthesis fallback.")
        except Exception as e:
            logger.warning(f"LLM call failed ({e}) — using context-synthesis fallback.")

        # ── Smart context-synthesis fallback (no LLM needed) ─────────────────
        # This produces a readable answer from retrieved chunks without hallucinating.
        return self._synthesize_from_context(user_query, context)

    def _synthesize_from_context(self, query: str, context: str) -> str:
        """
        Rule-based answer synthesis from retrieved Obsidian chunks.
        Used when Ollama is unavailable. Extracts the most relevant sentences
        from context and assembles a coherent reply.
        """
        if not context:
            return (
                "I searched your Obsidian Knowledge Base but couldn't find notes relevant to your question. "
                "Try rephrasing, or make sure the vault is indexed with POST /api/v1/rag/index."
            )

        query_words = {w.lower() for w in query.split() if len(w) > 3}

        # Split context into individual source blocks
        blocks = [b.strip() for b in context.split("---") if b.strip() and not b.strip().startswith("Context [")]
        
        # Score lines by query word overlap
        scored_lines: List[tuple] = []
        for block in blocks:
            for line in block.splitlines():
                line = line.strip()
                if not line or len(line) < 20:
                    continue
                # Skip markdown headers-only lines
                clean = line.lstrip("#").strip()
                if not clean:
                    continue
                line_words = {w.lower() for w in line.split()}
                score = len(query_words & line_words)
                scored_lines.append((score, clean))

        # Take top lines by relevance, deduplicated
        seen: set = set()
        top_lines: List[str] = []
        for _, line in sorted(scored_lines, key=lambda x: -x[0]):
            if line not in seen and len(top_lines) < 8:
                seen.add(line)
                top_lines.append(f"• {line}")

        if not top_lines:
            # Fallback: just take first meaningful lines from context
            for line in context.splitlines():
                line = line.strip().lstrip("#").strip()
                if line and len(line) > 25 and not line.startswith("Context [") and not line.startswith("Source:"):
                    top_lines.append(f"• {line}")
                if len(top_lines) >= 6:
                    break

        answer = "\n".join(top_lines)
        return (
            f"Here's what I found in your Obsidian Knowledge Base about **\"{query}\"**:\n\n"
            f"{answer}\n\n"
            f"*Sources are listed below. For richer AI answers, ensure Ollama is running: `ollama serve`*"
        )
