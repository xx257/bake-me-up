"""Dense retrieval over the Qdrant recipe corpus (Task 6 baseline).

One variable at a time: this is dense-only. Hybrid (dense + BM25) + rerank is a later
spike (see docs/03-data.md / docs/evaluation.md).
"""

from __future__ import annotations

from langchain_core.documents import Document
from langsmith import traceable

from .config import get_vectorstore


def retrieve(query: str, recipe_id: str | None = None, k: int = 4) -> list[Document]:
    """Top-k dense matches, optionally filtered to the active recipe.

    langchain-qdrant stores the chunk metadata dict under the `metadata` payload key,
    so we filter on `metadata.recipe_id`.
    """
    store = get_vectorstore()
    qdrant_filter = None
    if recipe_id:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        qdrant_filter = Filter(
            must=[FieldCondition(key="metadata.recipe_id", match=MatchValue(value=recipe_id))]
        )
    return store.similarity_search(query, k=k, filter=qdrant_filter)


@traceable(run_type="retriever", name="retrieve_profiles")
def retrieve_profiles(query: str, k: int = 4, score_floor: float = 0.0) -> list[dict]:
    """Planning Mode: semantic search over recipe profiles. Returns payloads (catalog
    entries minus body) whose cosine score clears `score_floor` — so genuinely off-topic
    queries return nothing rather than the least-bad recipe. Each payload is annotated with
    its cosine similarity under `_score` (visible in the retriever trace + available to the
    ranker).

    Wrapped in `@traceable` so the vector search shows up as a retriever span under the
    `plan` node in LangSmith (the raw Qdrant client call isn't auto-instrumented)."""
    import os

    from .config import get_embeddings, get_qdrant_client

    collection = os.environ.get("QDRANT_PROFILES_COLLECTION", "bake_me_up_profiles")
    vector = get_embeddings().embed_query(query)
    hits = get_qdrant_client().query_points(
        collection_name=collection, query=vector, limit=k
    ).points
    return [
        {**h.payload, "_score": round(h.score, 4)}
        for h in hits
        if h.score >= score_floor
    ]


@traceable(run_type="retriever", name="retrieve_recipes")
def retrieve_recipes(
    query: str,
    *,
    collection: str,
    k: int = 3,
    scope_recipe_id: str | None = None,
) -> dict:
    """Shared chunk retriever (parent-child style) for coaching + discovery.

    Dense child search over `collection` (optionally scoped to one recipe), mapped UP to
    recipes: returns deduped recipe ids (best-first), the matched evidence chunks, and the
    top cosine score (a seam for the later Tavily gate). The caller loads the FULL recipe
    for grounding — the children only decide relevance."""
    from qdrant_client.models import FieldCondition, Filter, MatchValue

    from .config import get_embeddings, get_qdrant_client

    vector = get_embeddings().embed_query(query)
    qfilter = None
    if scope_recipe_id:
        qfilter = Filter(
            must=[FieldCondition(key="metadata.recipe_id", match=MatchValue(value=scope_recipe_id))]
        )
    hits = get_qdrant_client().query_points(
        collection_name=collection, query=vector, limit=k, query_filter=qfilter, with_payload=True
    ).points

    recipe_ids: list[str] = []
    evidence: list[dict] = []
    for h in hits:
        pl = h.payload or {}
        md = pl.get("metadata", {}) or {}
        rid = md.get("recipe_id")
        if rid and rid not in recipe_ids:
            recipe_ids.append(rid)
        evidence.append(
            {
                "recipe_id": rid,
                "section": md.get("section"),
                "text": pl.get("page_content") or pl.get("text") or "",
                "score": round(h.score, 4),
            }
        )
    return {
        "recipe_ids": recipe_ids,
        "evidence": evidence,
        "top_score": round(hits[0].score, 4) if hits else 0.0,
    }


def format_context(docs: list[Document]) -> str:
    """Render retrieved chunks into a grounding block with recipe attribution."""
    blocks = []
    for d in docs:
        title = d.metadata.get("title", "Unknown recipe")
        section = d.metadata.get("section", "")
        blocks.append(f"[{title} · {section}]\n{d.page_content}")
    return "\n\n---\n\n".join(blocks)
