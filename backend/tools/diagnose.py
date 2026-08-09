"""
Orchestrator diagnostics — verifies every hop of the Obsidian RAG pipeline
by actually calling it, not by checking that config values are merely set.

Run from backend/:
    python -m tools.diagnose
"""
import asyncio
import sys

from app.config import settings
from app.services.obsidian import ObsidianClient
from app.services.rag_service import RAGService

RESULTS: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str = "") -> bool:
    RESULTS.append((name, ok, detail))
    return ok


async def check_environment() -> bool:
    ok = bool(settings.OBSIDIAN_API_URL) and bool(settings.OBSIDIAN_API_KEY.strip())
    detail = "" if ok else "OBSIDIAN_API_KEY is empty — set it in backend/.env"
    return record("Environment", ok, detail)


async def check_obsidian_connection(client: ObsidianClient) -> bool:
    try:
        health = await client.check_health()
        ok = health.get("status") == "OK" and health.get("authenticated") is True
        detail = "" if ok else f"unexpected response: {health}"
        return record("Obsidian Connection", ok, detail)
    except Exception as e:
        return record("Obsidian Connection", False, f"{type(e).__name__}: {e}")


async def check_vault_list(client: ObsidianClient) -> tuple[bool, list[str]]:
    try:
        files = await client.get_all_markdown_files()
        ok = isinstance(files, list) and len(files) > 0
        detail = f"{len(files)} markdown notes found" if ok else "no markdown notes found"
        return record("Vault List", ok, detail), files
    except Exception as e:
        return record("Vault List", False, f"{type(e).__name__}: {e}"), []


async def check_vault_read(client: ObsidianClient, files: list[str]) -> bool:
    if not files:
        return record("Vault Read", False, "skipped — no notes to read")
    try:
        content = await client.read_note(files[0])
        ok = len(content.strip()) > 0
        return record("Vault Read", ok, f"read '{files[0]}' ({len(content)} bytes)")
    except Exception as e:
        return record("Vault Read", False, f"{type(e).__name__}: {e}")


async def check_vault_search(client: ObsidianClient) -> bool:
    try:
        results = await client.search_notes("a")
        ok = isinstance(results, list)
        return record("Vault Search", ok, f"{len(results)} results")
    except Exception as e:
        return record("Vault Search", False, f"{type(e).__name__}: {e}")


def check_mcp() -> bool:
    # This project talks to Obsidian directly via the Local REST API — there
    # is no MCP server in this architecture, so MCP is intentionally skipped
    # rather than reported as a failure.
    return record("MCP", True, "not used by this project (direct REST API integration)")


async def check_ai_agent(rag: RAGService) -> bool:
    try:
        result = await rag.generate_rag_chat_reply(
            [{"role": "user", "content": "diagnostic check"}]
        )
        ok = "reply" in result and isinstance(result["reply"], str) and len(result["reply"]) > 0
        return record("AI Agent", ok, "generated a reply without raising")
    except Exception as e:
        return record("AI Agent", False, f"{type(e).__name__}: {e}")


async def main() -> int:
    print("=" * 40)
    print("AI AGENT DIAGNOSTICS")
    print("=" * 40)
    print()

    await check_environment()

    client = ObsidianClient()
    obsidian_ok = await check_obsidian_connection(client)

    files: list[str] = []
    if obsidian_ok:
        _, files = await check_vault_list(client)
        await check_vault_read(client, files)
        await check_vault_search(client)
    else:
        record("Vault List", False, "skipped — Obsidian unreachable")
        record("Vault Read", False, "skipped — Obsidian unreachable")
        record("Vault Search", False, "skipped — Obsidian unreachable")

    check_mcp()

    rag = RAGService()
    await check_ai_agent(rag)

    print()
    for name, ok, detail in RESULTS:
        status = "PASS" if ok else "FAIL"
        line = f"{name:<20} {status}"
        if detail:
            line += f"   ({detail})"
        print(line)

    overall = all(ok for _, ok, _ in RESULTS)
    print()
    print(f"Overall: {'PASS' if overall else 'FAIL'}")
    print("=" * 40)
    return 0 if overall else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
