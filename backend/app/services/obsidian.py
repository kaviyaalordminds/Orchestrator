import httpx
from typing import List, Dict, Any, Optional
import logging
from app.config import settings

logger = logging.getLogger("obsidian_client")


def _validate_vault_relative_path(path: str) -> str:
    """
    Defense-in-depth: reject path traversal segments before a path is used to
    build a request to the Obsidian Local REST API. The API itself resolves
    paths within its own vault, but this backend never forwards an unresolved
    ".." segment regardless.
    """
    clean = path.strip("/")
    if not clean:
        return clean
    for part in clean.split("/"):
        if part == "..":
            raise PermissionError(f"Path traversal rejected: '{path}' is outside the vault")
    return clean


class ObsidianClient:
    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None, verify_ssl: Optional[bool] = None):
        self.base_url = (base_url or settings.OBSIDIAN_API_URL).rstrip("/")
        self.api_key = api_key or settings.OBSIDIAN_API_KEY
        self.verify_ssl = verify_ssl if verify_ssl is not None else settings.OBSIDIAN_VERIFY_SSL
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json"
        }

    def _get_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(verify=self.verify_ssl, timeout=30.0)

    async def check_health(self) -> Dict[str, Any]:
        async with self._get_client() as client:
            res = await client.get(f"{self.base_url}/", headers=self.headers)
            res.raise_for_status()
            return res.json()

    async def list_files(self, path: str = "") -> List[str]:
        clean_path = _validate_vault_relative_path(path)
        endpoint = f"{self.base_url}/vault/{clean_path}" if clean_path else f"{self.base_url}/vault/"
        async with self._get_client() as client:
            res = await client.get(endpoint, headers=self.headers)
            if res.status_code == 404:
                return []
            res.raise_for_status()
            data = res.json()
            return data.get("files", [])

    async def get_all_markdown_files(self, prefix: str = "") -> List[str]:
        markdown_files: List[str] = []
        queue = [prefix]

        async with self._get_client() as client:
            while queue:
                curr_dir = queue.pop(0).strip("/")
                endpoint = f"{self.base_url}/vault/{curr_dir}/" if curr_dir else f"{self.base_url}/vault/"
                try:
                    res = await client.get(endpoint, headers=self.headers)
                    if res.status_code != 200:
                        continue
                    files = res.json().get("files", [])
                    for item in files:
                        full_item = f"{curr_dir}/{item}".strip("/") if curr_dir else item
                        if item.endswith("/"):
                            # Filter system folders like .obsidian/ or .git/
                            if not item.startswith("."):
                                queue.append(full_item)
                        elif item.endswith(".md"):
                            markdown_files.append(full_item)
                except Exception as e:
                    logger.warning(f"Error scanning directory '{curr_dir}': {e}")

        return markdown_files

    async def read_note(self, note_path: str) -> str:
        clean_path = _validate_vault_relative_path(note_path)
        endpoint = f"{self.base_url}/vault/{clean_path}"
        headers = {**self.headers, "Accept": "text/markdown, text/plain, */*"}
        async with self._get_client() as client:
            res = await client.get(endpoint, headers=headers)
            res.raise_for_status()
            return res.text

    async def get_note_metadata(self, note_path: str) -> Dict[str, Any]:
        """Frontmatter + tags + size for a note, without the caller needing chunker internals."""
        from app.services.chunker import extract_frontmatter, extract_tags, compute_hash

        content = await self.read_note(note_path)
        frontmatter, _ = extract_frontmatter(content)
        tags = extract_tags(content)
        clean_path = note_path.strip("/")
        return {
            "source_path": clean_path,
            "file_name": clean_path.split("/")[-1],
            "frontmatter": frontmatter,
            "tags": tags,
            "content_hash": compute_hash(content),
            "size_bytes": len(content.encode("utf-8")),
        }

    async def search_notes(self, query: str) -> List[Dict[str, Any]]:
        endpoint = f"{self.base_url}/search/simple/"
        async with self._get_client() as client:
            res = await client.post(endpoint, params={"query": query}, headers=self.headers)
            if res.status_code != 200:
                return []
            return res.json()
