"""Lazily-constructed clients (LLM, embeddings, vector store).

Everything here is built on first use, not at import time, so `agent.graph` compiles
without any environment/keys (needed for `langgraph dev` startup and deploy import).
"""

from __future__ import annotations

import os
from functools import lru_cache


@lru_cache(maxsize=1)
def get_embeddings():
    """OpenAI embeddings (direct — reads OPENAI_API_KEY)."""
    from langchain_openai import OpenAIEmbeddings

    return OpenAIEmbeddings(model=os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small"))


@lru_cache(maxsize=2)
def get_chat_llm(mini: bool = False):
    """Chat LLM routed through the Vercel AI Gateway (OpenAI-compatible)."""
    from langchain_openai import ChatOpenAI

    model = os.environ["CHAT_MODEL_MINI" if mini else "CHAT_MODEL"]
    return ChatOpenAI(
        model=model,
        base_url=os.environ["AI_GATEWAY_BASE_URL"],
        api_key=os.environ["AI_GATEWAY_API_KEY"],
        temperature=0,
    )


@lru_cache(maxsize=1)
def get_qdrant_client():
    from qdrant_client import QdrantClient

    return QdrantClient(url=os.environ["QDRANT_URL"], api_key=os.environ["QDRANT_API_KEY"])
