"""Chat intent routing for deciding when Obsidian retrieval is actually needed.

The router is deliberately conservative: greetings and ordinary conversational
messages bypass RAG. Requests containing personal/project/internal language, or
explicit requests about vault/notes/trades/projects, use Obsidian context.
"""

import re
from enum import Enum


class ChatMode(str, Enum):
    DIRECT = "direct"
    VAULT = "vault"


GREETING_PATTERNS = [
    r"^\s*(hi|hello|hey|hiya|heyy|good morning|good afternoon|good evening)\s*[!.?,]*\s*$",
    r"^\s*(?:hi|hello|hey)[,\s]+how are you(?: doing)?\s*[?.!]*\s*$",
    r"^\s*how are you(?: doing)?\s*[?.!]*\s*$",
    r"^\s*how('s| is) it going\s*[?.!]*\s*$",
    r"^\s*what's up\s*[?.!]*\s*$",
    r"^\s*how have you been\s*[?.!]*\s*$",
]

VAULT_PATTERNS = [
    r"\bmy\b",
    r"\bour\b",
    r"\bwe\b",
    r"\bpersonal\b",
    r"\bproject\b",
    r"\bprojects\b",
    r"\binternal\b",
    r"\bcompany\b",
    r"\btrade\b",
    r"\btrades\b",
    r"\btrading\b",
    r"\bportfolio\b",
    r"\bstrategy\b",
    r"\bstrategies\b",
    r"\bmental model\b",
    r"\bobsidian\b",
    r"\bvault\b",
    r"\bknowledge base\b",
    r"\bnotes?\b",
    r"\baccording to\b",
    r"\bwhat did i\b",
    r"\bwhat have i\b",
    r"\bmy previous\b",
    r"\bmy past\b",
    r"\bour documentation\b",
    r"\bour docs\b",
    r"\bthis project\b",
    r"\bthis product\b",
]

# Questions that usually require current/project-specific context even if they
# don't contain an explicit "my/project" phrase.
PROJECT_NOUNS = [
    "architecture", "implementation", "codebase", "backend", "frontend",
    "agent", "orchestrator", "obsidian integration", "audio studio",
    "product launch", "roadmap", "requirements", "configuration",
]


def classify_chat(query: str) -> ChatMode:
    text = (query or "").strip()
    if not text:
        return ChatMode.DIRECT

    lowered = text.lower()

    # Hard rule: short greetings/small talk always bypass retrieval.
    if any(re.search(pattern, lowered) for pattern in GREETING_PATTERNS):
        return ChatMode.DIRECT

    if any(re.search(pattern, lowered) for pattern in VAULT_PATTERNS):
        return ChatMode.VAULT

    # Keep simple/general knowledge questions direct. Only project-oriented
    # nouns are enough to trigger vault retrieval here.
    if any(noun in lowered for noun in PROJECT_NOUNS):
        return ChatMode.VAULT

    return ChatMode.DIRECT
