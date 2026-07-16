"""Build the two eval collections from the current recipe corpus (Task 6).

Two physical collections drive three configs:
  - bake_me_up_recipes_eval_150  (child_size 150)  → fixed-150  AND parent-child-150
  - bake_me_up_recipes_eval_250  (child_size 250)  → parent-child-250

fixed-150 and parent-child-150 search the SAME eval_150 collection, so their child hits
(and retrieved recipe ids) are identical by construction — only the answer context differs.

Reuses agent.ingest.iter_fixed_chunks + _embed_upload (no new ingest framework). Run:
    uv run --project backend --group eval python backend/eval/build_collections.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_BACKEND))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(_BACKEND / ".env")

from agent.ingest import _embed_upload, iter_fixed_chunks  # noqa: E402

COLLECTIONS = {
    "bake_me_up_recipes_eval_150": 150,
    "bake_me_up_recipes_eval_250": 250,
}


def main() -> None:
    for collection, size in COLLECTIONS.items():
        chunks = iter_fixed_chunks(size=size, overlap=0)
        n = _embed_upload(chunks, collection)
        recipes = sorted({c["metadata"]["recipe_id"] for c in chunks})
        print(f"  {collection}: {n} chunks across {len(recipes)} recipes -> {recipes}")


if __name__ == "__main__":
    main()
