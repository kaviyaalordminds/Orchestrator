from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from app.api.rag import get_rag
from app.services.chat_intent import classify_chat
from app.services.chat_store import ChatStore

router = APIRouter()
_chat_store = ChatStore()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    include_sources: bool = False


class Conversation(BaseModel):
    id: int
    title: str
    preview: str = ""
    timestamp: str
    messages: List[ChatMessage]


@router.get("/chat/conversations")
async def list_conversations():
    return {"success": True, "data": await _chat_store.list()}


@router.post("/chat/conversations")
async def save_conversation(conversation: Conversation):
    saved = await _chat_store.upsert(conversation.model_dump())
    return {"success": True, "data": saved}


@router.delete("/chat/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    deleted = await _chat_store.delete(conversation_id)
    return {"success": True, "data": {"deleted": deleted}}


@router.post("/chat")
async def chat_endpoint(req: ChatRequest):
    """Chat endpoint with intent-based direct-vs-vault routing.

    Normal conversation bypasses Obsidian. Sources are hidden unless the
    caller explicitly requests them for diagnostics.
    """
    try:
        rag = get_rag()
        msgs = [{"role": m.role, "content": m.content} for m in req.messages]
        result = await rag.generate_rag_chat_reply(
            msgs,
            include_sources=req.include_sources,
        )
        return {
            "success": True,
            "data": {
                "reply": result["reply"],
                "sources": result["sources"],
                "mode": result.get("mode", "direct"),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/diagnostics")
async def chat_diagnostics(message: str = "Hi"):
    """Show which chat mode the CURRENT running backend would select.

    This endpoint intentionally performs no Obsidian retrieval and is useful
    for diagnosing stale/multiple backend processes.
    """
    mode = classify_chat(message)
    return {
        "service": "Orchestrator Chat",
        "router_version": "2.0-intent-routing",
        "message": message,
        "mode": mode.value,
        "obsidian_retrieval": mode.value == "vault",
    }

@router.post("/chat/direct")
async def chat_direct_endpoint(req: ChatRequest):
    """Force a direct LLM conversation with ZERO Obsidian retrieval."""
    try:
        rag = get_rag()
        msgs = [{"role": m.role, "content": m.content} for m in req.messages]
        last_user_msg = next(
            (m["content"] for m in reversed(msgs) if m["role"] == "user"),
            "",
        )
        reply = await rag._call_llm(
            msgs,
            context="",
            use_vault=False,
        )
        return {
            "success": True,
            "data": {
                "reply": reply,
                "sources": [],
                "mode": "direct",
                "obsidian_retrieval": False,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
