"""Dense retrieval over the Qdrant recipe *profiles* (Planning Mode / discovery).

Coaching uses the full recipe in context (no per-question retrieval), so this module only
covers the discovery lane. The chunk-level retrieval experiment (fixed vs parent-child) lives
in `backend/eval/`.
"""

from __future__ import annotations

from langsmith import traceable


@traceable(run_type="retriever", name="retrieve_profiles")
def retrieve_profiles(query: str, k: int = 4, score_floor: float = 0.0) -> list[dict]:
    """Planning Mode: semantic search over recipe profiles. Returns payloads (catalog
    entries minus body) whose cosine score clears `score_floor` — so genuinely off-topic
    queries return nothing rather than the least-bad recipe. Each payload is annotated with
    its cosine similarity under `_score` (visible in the retriever trace + available to the
    ranker).

    Wrapped in `@traceable` so the vector search shows up as a retriever span under the
    `discover` node in LangSmith (the raw Qdrant client call isn't auto-instrumented)."""
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
