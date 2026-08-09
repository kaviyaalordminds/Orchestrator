import httpx
from typing import List, Dict, Any, Optional
import logging
from app.config import settings

logger = logging.getLogger("obsidian_client")

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
        clean_path = path.strip("/")
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
        clean_path = note_path.strip("/")
        endpoint = f"{self.base_url}/vault/{clean_path}"
        headers = {**self.headers, "Accept": "text/markdown, text/plain, */*"}
        async with self._get_client() as client:
            res = await client.get(endpoint, headers=headers)
            res.raise_for_status()
            return res.text

    async def search_notes(self, query: str) -> List[Dict[str, Any]]:
        endpoint = f"{self.base_url}/search/simple/"
        async with self._get_client() as client:
            res = await client.post(endpoint, params={"query": query}, headers=self.headers)
            if res.status_code != 200:
                return []
            return res.json()
