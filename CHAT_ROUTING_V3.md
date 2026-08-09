# Chat Routing v3

This version adds a dedicated `/api/v1/chat/direct` endpoint and a frontend guard.

- Greetings/general chat -> `/api/v1/chat/direct` -> LLM only, no Obsidian retrieval.
- Personal/project/internal questions -> `/api/v1/chat` -> intent router -> Obsidian when needed.
- `/api/v1/build` identifies the running backend build.

If you still see an Obsidian response to `Hi`, you are not running this backend/frontend build. Stop all old uvicorn processes, start this backend on 127.0.0.1:8000, and hard-refresh the browser.
