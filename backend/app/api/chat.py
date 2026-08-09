from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.api.rag import get_rag

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


@router.post("/chat")
async def chat_endpoint(req: ChatRequest):
    """RAG-enhanced chat endpoint. Retrieves relevant Obsidian context before calling LLM."""
    try:
        rag = get_rag()
        msgs = [{"role": m.role, "content": m.content} for m in req.messages]
        result = await rag.generate_rag_chat_reply(msgs)
        return {
            "success": True,
            "data": {
                "reply": result["reply"],
                "sources": result["sources"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
