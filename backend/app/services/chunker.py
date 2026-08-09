import re
import hashlib
from typing import List, Dict, Any, Tuple

def compute_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

def extract_frontmatter(content: str) -> Tuple[Dict[str, Any], str]:
    frontmatter = {}
    body = content
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            fm_text = parts[1]
            body = parts[2].strip()
            for line in fm_text.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    frontmatter[k.strip()] = v.strip().strip('"').strip("'")
    return frontmatter, body

def extract_tags(content: str) -> List[str]:
    # Extract obsidian tags e.g. #tag or #multi/level/tag
    tags = re.findall(r"(?:^|\s)#([a-zA-Z0-9_\-/]+)", content)
    return list(set(tags))

def chunk_markdown(note_path: str, raw_content: str, chunk_size: int = 500, chunk_overlap: int = 100) -> List[Dict[str, Any]]:
    doc_hash = compute_hash(raw_content)
    file_name = note_path.split("/")[-1]
    title = file_name.rsplit(".", 1)[0]
    
    frontmatter, body = extract_frontmatter(raw_content)
    tags = extract_tags(raw_content)
    if "tags" in frontmatter and isinstance(frontmatter["tags"], str):
        tags.extend([t.strip() for t in frontmatter["tags"].split(",") if t.strip()])
    tags = list(set(tags))

    # Split by headings
    sections = re.split(r"(?=\n#{1,6}\s)", "\n" + body)
    chunks = []
    chunk_index = 0

    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue
        
        # Heading extraction
        heading = ""
        heading_match = re.match(r"^(#{1,6})\s+(.+)", sec)
        if heading_match:
            heading = heading_match.group(2).strip()

        # Split section body if longer than chunk_size
        words = sec.split()
        if len(words) <= chunk_size:
            text_block = sec
            chunks.append({
                "chunk_id": f"{doc_hash}_{chunk_index}",
                "document_id": doc_hash,
                "source_path": note_path,
                "file_name": file_name,
                "title": title,
                "heading": heading,
                "tags": tags,
                "content": text_block,
                "content_hash": compute_hash(text_block)
            })
            chunk_index += 1
        else:
            start = 0
            while start < len(words):
                end = start + chunk_size
                text_block = " ".join(words[start:end])
                chunks.append({
                    "chunk_id": f"{doc_hash}_{chunk_index}",
                    "document_id": doc_hash,
                    "source_path": note_path,
                    "file_name": file_name,
                    "title": title,
                    "heading": heading,
                    "tags": tags,
                    "content": text_block,
                    "content_hash": compute_hash(text_block)
                })
                chunk_index += 1
                start += (chunk_size - chunk_overlap)

    return chunks
