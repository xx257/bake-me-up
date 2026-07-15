"""Agent tools.

`search_baking_web` is the Tavily **fallback** — general baking knowledge the local recipe
collection can't cover. Local-first: the lanes answer from the recipe and only reach for
this when the recipe genuinely doesn't have the answer.
"""

from __future__ import annotations

import os
import time

from langchain_core.tools import tool
from langsmith import get_current_run_tree, traceable


@traceable(run_type="tool", name="tavily_search")
def _tavily_search(query: str) -> dict:
    """The instrumented web call behind `search_baking_web`. A first-class `tool` span (like
    the Qdrant retrievers) so the query, sources, result count, and latency are visible in
    LangSmith. Degrades gracefully: a Tavily failure is captured as span metadata and returns a
    plain fallback so the caller answers from the recipe rather than the run erroring.

    Returns a structured dict so callers can both feed the LLM (`text`) and surface a UI card
    (`sources`, `result_count`):
        {"text": str, "sources": [{"title", "url"}], "result_count": int, "error": str | None}
    """
    from tavily import TavilyClient

    run = get_current_run_tree()
    t0 = time.perf_counter()
    try:
        client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
        res = client.search(query, max_results=3, include_answer=True, search_depth="basic")
    except Exception as e:
        if run is not None:
            run.metadata["error"] = str(e)
        return {
            "text": "Web search is unavailable right now; answering from the recipe only.",
            "sources": [],
            "result_count": 0,
            "error": str(e),
        }

    results = (res.get("results") or [])[:3]
    sources = [{"title": r.get("title", ""), "url": r.get("url", "")} for r in results]
    if run is not None:
        run.metadata.update(
            {
                "result_count": len(results),
                "sources": [s["url"] for s in sources],
                "latency_ms": round((time.perf_counter() - t0) * 1000),
                "had_answer": bool(res.get("answer")),
            }
        )

    parts: list[str] = []
    if res.get("answer"):
        parts.append(res["answer"])
    for r in results:
        snippet = (r.get("content") or "")[:200]
        parts.append(f"- {r.get('title', '')}: {snippet} ({r.get('url', '')})")
    return {
        "text": "\n".join(parts) or "No web results found.",
        "sources": sources,
        "result_count": len(results),
        "error": None,
    }


@tool
def search_baking_web(query: str) -> str:
    """Search the web for general baking knowledge NOT in the recipe — ingredient facts,
    substitutions, technique definitions (e.g. 'protein % of bread flour', 'Dutch vs
    natural cocoa'). Use ONLY when the local recipe can't answer. Returns a short
    web-grounded summary with sources."""
    return _tavily_search(query)["text"]
