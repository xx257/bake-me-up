"""Discovery retrieval — parent-child over fixed-150 child chunks.

Production retrieval for the `discover` lane:
  retrieve child chunks (fixed-150) → **dedupe by parent `recipe_id`** → load the full parent
  recipes. Coaching uses the full recipe in context (no per-question retrieval), so this module
  only serves discovery. The eval harness (`backend/eval/`) imports `retrieve_children` /
  `dedup_recipe_ids` from here, so it evaluates the *shipped* retriever.

Baseline (documented history) = fixed-150 dense chunks answered from raw children. Production =
parent-child at child size 150 (this module). Task 6 also evaluates child size 250.
"""

from __future__ import annotations

import os

from langsmith import traceable

from .catalog import get_entry

# Fixed-150 child-chunk collection (built by `python -m agent.ingest fixed`).
DEFAULT_COLLECTION = "bake_me_up_recipes_fixed_150_0"


def _collection() -> str:
    return os.environ.get("QDRANT_RECIPES_COLLECTION", DEFAULT_COLLECTION)


def retrieve_children(query: str, collection: str | None = None, k: int = 3) -> list[dict]:
    """Dense child search over `collection`. Returns raw child hits, best-first:
    `[{recipe_id, text, section, score}]`. The `recipe_id` payload is the **parent link** used to
    map children back to their recipe. No mapping-up here — the caller decides."""
    from .config import get_embeddings, get_qdrant_client

    vector = get_embeddings().embed_query(query)
    hits = get_qdrant_client().query_points(
        collection_name=collection or _collection(), query=vector, limit=k, with_payload=True
    ).points
    out: list[dict] = []
    for h in hits:
        pl = h.payload or {}
        md = pl.get("metadata", {}) or {}
        out.append(
            {
                "recipe_id": md.get("recipe_id"),
                "text": pl.get("page_content") or pl.get("text") or "",
                "section": md.get("section"),
                "score": round(h.score, 4),
            }
        )
    return out


def dedup_recipe_ids(children: list[dict]) -> list[str]:
    """Distinct parent recipe ids in first-child-hit order (stable, best-first)."""
    seen: list[str] = []
    for c in children:
        rid = c["recipe_id"]
        if rid and rid not in seen:
            seen.append(rid)
    return seen


@traceable(run_type="retriever", name="retrieve_recipes")
def retrieve_recipes(query: str, top_k: int = 3, score_floor: float = 0.0) -> list[dict]:
    """Parent-child discovery retrieval: retrieve top-`top_k` child chunks → dedupe by parent
    `recipe_id` (best-first) → load the **full parent recipes** (catalog entries incl. `body`).

    Each returned recipe carries `_score` = its best child cosine score (visible in the retriever
    trace + used by the collection card). A recipe is kept only if its best child clears
    `score_floor`, so genuinely off-topic queries return nothing rather than the least-bad recipe.

    We retrieve a *wider* child set than `top_k` (many children map to the same recipe) so the top
    `top_k` distinct recipes have real coverage, then dedupe to parents. The eval measures `hit@3`
    over the top-3 children directly — same `retrieve_children`/`dedup_recipe_ids` primitive."""
    children = retrieve_children(query, k=max(12, top_k * 4))
    best: dict[str, float] = {}
    for c in children:
        rid = c["recipe_id"]
        if rid:
            best[rid] = max(best.get(rid, 0.0), c["score"])

    recipes: list[dict] = []
    for rid in dedup_recipe_ids(children):
        score = best.get(rid, 0.0)
        if score >= score_floor and (entry := get_entry(rid)):
            recipes.append({**entry, "_score": round(score, 4)})
    return recipes[:top_k]
