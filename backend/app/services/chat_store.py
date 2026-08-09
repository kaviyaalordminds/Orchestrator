from __future__ import annotations

import asyncio
import json
import os
import tempfile
from pathlib import Path
from typing import Any

from app.config import settings


class ChatStore:
    """Small persistent JSON store for local chat conversations.

    The application is currently a local single-user app, so a JSON file is
    sufficient and avoids introducing a database dependency. Writes are
    atomic, so a browser refresh or backend restart cannot leave a half-written
    history file.
    """

    def __init__(self, path: str | None = None):
        self.path = Path(path or settings.CHAT_HISTORY_FILE).resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()

    def _read_sync(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            return []
        try:
            with self.path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except (OSError, json.JSONDecodeError):
            return []

    def _write_sync(self, conversations: list[dict[str, Any]]) -> None:
        fd, temp_name = tempfile.mkstemp(
            prefix=".chat_history_",
            suffix=".tmp",
            dir=str(self.path.parent),
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(conversations, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_name, self.path)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)

    async def list(self) -> list[dict[str, Any]]:
        async with self._lock:
            conversations = await asyncio.to_thread(self._read_sync)
        conversations.sort(key=lambda c: str(c.get("timestamp", "")), reverse=True)
        return conversations

    async def upsert(self, conversation: dict[str, Any]) -> dict[str, Any]:
        async with self._lock:
            conversations = await asyncio.to_thread(self._read_sync)
            cid = str(conversation.get("id"))
            conversations = [
                c for c in conversations if str(c.get("id")) != cid
            ]
            conversations.append(conversation)
            conversations.sort(
                key=lambda c: str(c.get("timestamp", "")), reverse=True
            )
            await asyncio.to_thread(self._write_sync, conversations)
        return conversation

    async def delete(self, conversation_id: str) -> bool:
        async with self._lock:
            conversations = await asyncio.to_thread(self._read_sync)
            remaining = [
                c for c in conversations
                if str(c.get("id")) != str(conversation_id)
            ]
            changed = len(remaining) != len(conversations)
            if changed:
                await asyncio.to_thread(self._write_sync, remaining)
            return changed
