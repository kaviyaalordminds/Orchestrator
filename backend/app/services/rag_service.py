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
        results = self.vector_store.search(query_vec, top_k=top_k)
        
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

    async def generate_rag_chat_reply(
        self,
        messages: List[Dict[str, str]],
        include_sources: bool = False,
    ) -> Dict[str, Any]:
        """Route chat between direct LLM conversation and vault-grounded RAG.

        Basic conversation never touches Obsidian. Vault retrieval is only
        performed when the intent router determines that internal/personal/
        project context is relevant.
        """
        from app.services.chat_intent import ChatMode, classify_chat

        last_user_msg = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"),
            "",
        )
        mode = classify_chat(last_user_msg)

        logger.info("Chat routing: mode=%s query=%r", mode.value, last_user_msg[:120])

        if mode == ChatMode.DIRECT:
            reply = await self._call_llm(
                messages,
                context="",
                use_vault=False,
            )
            return {
                "reply": reply,
                "sources": [],
                "mode": mode.value,
            }

        chunks = await self.retrieve_context(last_user_msg)
        sources = []
        formatted_contexts = []
        seen_sources = set()

        for idx, chunk in enumerate(chunks, 1):
            src_path = chunk.get("source_path")
            title = chunk.get("title")
            heading = f" > {chunk['heading']}" if chunk.get("heading") else ""

            if chunk.get("content"):
                formatted_contexts.append(
                    f"--- Context [{idx}] ---\n{chunk['content']}"
                )

            if src_path and src_path not in seen_sources:
                seen_sources.add(src_path)
                sources.append({
                    "title": title,
                    "source_path": src_path,
                })

        context_str = "\n\n".join(formatted_contexts)

        reply = await self._call_llm(
            messages,
            context_str,
            use_vault=True,
        )

        # Source metadata is intentionally hidden from the normal chat API.
        # It is returned only when explicitly requested for diagnostics/source
        # inspection.
        return {
            "reply": reply,
            "sources": sources if include_sources else [],
            "mode": mode.value,
        }

    async def _call_llm(
        self,
        messages: List[Dict[str, str]],
        context: str,
        use_vault: bool = False,
    ) -> str:
        """Call the configured LLM with either direct or vault-grounded mode."""
        if use_vault:
            system_instruction = (
                "You are Orchestrator, a professional AI assistant. "
                "The user's question requires internal/personal/project context. "
                "Use ONLY the supplied Obsidian context for internal facts. "
                "Treat that context as private reference material, not as text "
                "to reproduce. Answer the user's actual question directly and "
                "professionally. Do not mention the Obsidian Knowledge Base, "
                "RAG, retrieval, context blocks, file paths, source files, "
                "trade lists, or search results unless the user explicitly asks "
                "for sources. Do not dump notes or raw context. "
                "If the supplied context is insufficient, say that the available "
                "project knowledge does not contain enough information and do "
                "not invent internal facts."
            )
        else:
            system_instruction = (
                "You are Orchestrator, a helpful conversational AI assistant. "
                "Answer the user's message naturally and directly using your "
                "normal general knowledge and conversation ability. "
                "Do not query, mention, or depend on the Obsidian Knowledge Base "
                "for ordinary conversation. Do not fabricate personal or "
                "project-specific facts."
            )

        prompt_messages = [{"role": "system", "content": system_instruction}]

        if use_vault and context:
            prompt_messages.append({
                "role": "system",
                "content": (
                    "Private project context for answering this request. "
                    "Use it internally; never output this block verbatim:\n\n"
                    f"{context}"
                ),
            })
        elif use_vault and not context:
            prompt_messages.append({
                "role": "system",
                "content": (
                    "No relevant internal context was retrieved. Do not invent "
                    "internal/project facts."
                ),
            })

        prompt_messages.extend(messages)

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(
                    f"{settings.OLLAMA_URL.rstrip('/')}/api/chat",
                    json={
                        "model": settings.LLM_MODEL,
                        "messages": prompt_messages,
                        "stream": False,
                        "options": {"temperature": 0.3},
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    reply = data.get("message", {}).get("content", "").strip()
                    if reply:
                        logger.info(
                            "LLM replied via Ollama (%s), mode=%s",
                            settings.LLM_MODEL,
                            "vault" if use_vault else "direct",
                        )
                        return reply
                else:
                    logger.warning(
                        "Ollama returned status %s: %s",
                        res.status_code,
                        res.text[:300],
                    )
        except httpx.ConnectError:
            logger.error("Ollama is not reachable at %s", settings.OLLAMA_URL)
        except Exception as exc:
            logger.exception("LLM call failed: %s", exc)

        # Do not expose raw vault chunks as a fake answer. For direct chat there
        # is no safe deterministic fallback, so return a clear service error.
        if use_vault:
            if context:
                return (
                    "I retrieved relevant project knowledge, but the AI model "
                    "is currently unavailable to turn it into a final answer. "
                    "Please check the LLM backend and try again."
                )
            return (
                "I couldn't generate the answer because the AI model is "
                "currently unavailable."
            )

        return (
            "I couldn't generate a response because the AI model is currently "
            "unavailable. Please check the LLM backend and try again."
        )
