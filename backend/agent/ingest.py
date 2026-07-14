"""Recipe ingestion → Qdrant (dense).

Implements the rule from docs/03-data.md:
  - parse YAML frontmatter for metadata (NOT embedded),
  - structure-aware chunks of the PROSE body only,
  - each step: embed the `#### Recipe` prose, STRIP the `#### Workflow` YAML block,
  - skip TEMPLATE.md and README.md.

The parsing half (`parse_recipe`, `iter_chunks`) is pure-Python and testable with no
API keys:  `uv run python -m agent.ingest parse`
The embed+upload half needs OPENAI_* and QDRANT_* env:  `uv run python -m agent.ingest embed`
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

import yaml

RECIPE_DIR = Path(__file__).resolve().parents[2] / "data" / "recipes"
SKIP_FILES = {"TEMPLATE.md", "README.md"}
EMBED_DIM = 1536  # text-embedding-3-small

# `#### Workflow` heading followed by a ```yaml ... ``` fenced block — stripped before embedding.
_WORKFLOW_RE = re.compile(r"####\s*Workflow\s*```yaml.*?```", re.DOTALL | re.IGNORECASE)
_RECIPE_HEADING_RE = re.compile(r"####\s*Recipe\s*", re.IGNORECASE)
_HR_RE = re.compile(r"\n-{3,}\s*")  # `---` step separators


def split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Return (frontmatter dict, body). Body is everything after the closing `---`."""
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            fm = yaml.safe_load(text[3:end]) or {}
            body = text[end + 4 :].lstrip("\n")
            return fm, body
    return {}, text


def _clean_step(text: str) -> str:
    text = _WORKFLOW_RE.sub("", text)
    text = _RECIPE_HEADING_RE.sub("", text)
    text = _HR_RE.sub("\n", text)
    return text.strip()


def _source_name(meta: dict) -> Any:
    src = meta.get("source")
    return src.get("name") if isinstance(src, dict) else src


def parse_recipe(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Parse one recipe file into (frontmatter, chunks).

    Each chunk = {"text": str, "metadata": {...}}; only prose is included.
    """
    text = path.read_text()
    meta, body = split_frontmatter(text)
    base = {
        "recipe_id": meta.get("id") or path.stem,
        "title": meta.get("title"),
        "source": _source_name(meta),
        "tags": meta.get("tags", []),
        "aliases": meta.get("aliases", []),
    }
    chunks: list[dict[str, Any]] = []

    def add(text: str, **md: Any) -> None:
        text = text.strip()
        if text:
            chunks.append({"text": text, "metadata": {**base, **md}})

    sections = re.split(r"(?m)^(?=## )", body)
    add(sections[0], section="overview")  # H1 title + intro, before the first `## `

    for sec in sections[1:]:
        head, _, content = sec.partition("\n")
        heading = head[3:].strip()
        hl = heading.lower()

        if hl == "steps":
            for st in re.split(r"(?m)^(?=### )", content):
                if not st.lstrip().startswith("###"):
                    continue
                title_line, _, rest = st.strip().partition("\n")
                title = title_line[4:].strip()
                cleaned = _clean_step(rest)
                add(f"### {title}\n\n{cleaned}", section="step", step_title=title)

        elif hl == "troubleshooting":
            for qa in re.split(r"(?m)^(?=### )", content):
                if not qa.lstrip().startswith("###"):
                    continue
                q_line = qa.strip().partition("\n")[0]
                add(qa, section="troubleshooting", question=q_line[4:].strip())

        else:
            add(f"## {heading}\n\n{content}", section=hl)

    return meta, chunks


def iter_chunks(recipe_dir: Path = RECIPE_DIR) -> list[dict[str, Any]]:
    """All embeddable chunks across the corpus (skips TEMPLATE.md / README.md)."""
    out: list[dict[str, Any]] = []
    for path in sorted(recipe_dir.glob("*.md")):
        if path.name in SKIP_FILES:
            continue
        _, chunks = parse_recipe(path)
        out.extend(chunks)
    return out


def embed_and_upload(recipe_dir: Path = RECIPE_DIR) -> int:
    """Embed all chunks and upsert into Qdrant. Needs OPENAI_* and QDRANT_* env."""
    import os

    from dotenv import load_dotenv
    from langchain_openai import OpenAIEmbeddings
    from langchain_qdrant import QdrantVectorStore
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, PayloadSchemaType, VectorParams

    load_dotenv()
    collection = os.environ.get("QDRANT_COLLECTION", "bake_me_up_recipes")

    client = QdrantClient(url=os.environ["QDRANT_URL"], api_key=os.environ["QDRANT_API_KEY"])
    if client.collection_exists(collection):
        client.delete_collection(collection)
    client.create_collection(
        collection,
        vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
    )
    # Payload index so retrieval can filter to the active recipe (Qdrant requires an
    # index on any field used in a filter).
    client.create_payload_index(
        collection_name=collection,
        field_name="metadata.recipe_id",
        field_schema=PayloadSchemaType.KEYWORD,
    )

    # Embeddings go DIRECT to OpenAI (reads OPENAI_API_KEY from env); the Vercel AI
    # Gateway fronts the chat LLM, not embeddings.
    embeddings = OpenAIEmbeddings(
        model=os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small"),
    )
    store = QdrantVectorStore(client=client, collection_name=collection, embedding=embeddings)

    chunks = iter_chunks(recipe_dir)
    store.add_texts(
        texts=[c["text"] for c in chunks],
        metadatas=[c["metadata"] for c in chunks],
    )
    print(f"Uploaded {len(chunks)} chunks to Qdrant collection '{collection}'.")
    return len(chunks)


def _parse_report(recipe_dir: Path = RECIPE_DIR) -> None:
    """Offline sanity check: chunk counts + assert no workflow/frontmatter leakage."""
    total = 0
    for path in sorted(recipe_dir.glob("*.md")):
        if path.name in SKIP_FILES:
            continue
        meta, chunks = parse_recipe(path)
        total += len(chunks)
        sections: dict[str, int] = {}
        for c in chunks:
            sections[c["metadata"]["section"]] = sections.get(c["metadata"]["section"], 0) + 1
            t = c["text"]
            assert "#### Workflow" not in t, f"{path.name}: workflow leaked"
            assert "next_step" not in t, f"{path.name}: next_step leaked"
            assert "```yaml" not in t, f"{path.name}: yaml block leaked"
        tier = "hero" if "#### Workflow" in path.read_text() else "lite"
        print(f"{path.name:30s} [{tier}]  {len(chunks):2d} chunks  {sections}")
    print(f"\nTotal: {total} chunks across the corpus. No workflow/frontmatter leakage. ✅")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "parse"
    if cmd == "parse":
        _parse_report()
    elif cmd == "embed":
        embed_and_upload()
    else:
        sys.exit(f"unknown command: {cmd!r} (use 'parse' or 'embed')")
