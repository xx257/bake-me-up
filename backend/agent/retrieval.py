"""Dense retrieval over the Qdrant recipe corpus (Task 6 baseline).

One variable at a time: this is dense-only. Hybrid (dense + BM25) + rerank is a later
spike (see docs/03-data.md / docs/evaluation.md).
"""

from __future__ import annotations

from langchain_core.documents import Document

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


def retrieve_profiles(query: str, k: int = 4) -> list[dict]:
    """Planning Mode: semantic search over recipe profiles. Returns payloads (catalog
    entries minus body) for the ranker + UI cards."""
    import os

    from .config import get_embeddings, get_qdrant_client

    collection = os.environ.get("QDRANT_PROFILES_COLLECTION", "bake_me_up_profiles")
    vector = get_embeddings().embed_query(query)
    hits = get_qdrant_client().query_points(
        collection_name=collection, query=vector, limit=k
    ).points
    return [h.payload for h in hits]


def format_context(docs: list[Document]) -> str:
    """Render retrieved chunks into a grounding block with recipe attribution."""
    blocks = []
    for d in docs:
        title = d.metadata.get("title", "Unknown recipe")
        section = d.metadata.get("section", "")
        blocks.append(f"[{title} · {section}]\n{d.page_content}")
    return "\n\n---\n\n".join(blocks)
