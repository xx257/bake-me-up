"""Shared eval primitives: child retrieval, answer generation, token counting, judge.

Reuses production clients (`agent.config`) and recipe bodies (`agent.catalog`) — no new
retrieval framework. `retrieve_children` is the single primitive both configs share, so
fixed-150 and parent-child-150 retrieve identical child hits (only the answer context differs).
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(_BACKEND / ".env")

import tiktoken  # noqa: E402
from langchain_core.messages import HumanMessage, SystemMessage  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from agent.catalog import get_body  # noqa: E402
from agent.config import get_chat_llm, get_embeddings, get_qdrant_client  # noqa: E402

_ENC = tiktoken.get_encoding("cl100k_base")
MAX_PARENTS = 3  # cap parent expansion at 3 distinct recipes


def n_tokens(text: str) -> int:
    return len(_ENC.encode(text))


# ── Child retrieval (the shared primitive) ───────────────────────────────────
def retrieve_children(query: str, collection: str, k: int = 3) -> list[dict]:
    """Dense child search over `collection`. Returns raw child hits, best-first:
    [{recipe_id, text, section, score}]. No mapping-up — that happens per config."""
    vector = get_embeddings().embed_query(query)
    hits = get_qdrant_client().query_points(
        collection_name=collection, query=vector, limit=k, with_payload=True
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
    """Distinct recipe ids in first-child-hit order (stable, best-first)."""
    seen: list[str] = []
    for c in children:
        rid = c["recipe_id"]
        if rid and rid not in seen:
            seen.append(rid)
    return seen


# ── Answer generation ────────────────────────────────────────────────────────
_ANSWER_SYSTEM = (
    "You are a baking assistant answering a question using ONLY the provided context from the "
    "user's recipe collection. Be concise and specific. If the answer is not in the context, "
    "say it is not covered in the recipe rather than guessing."
)


def build_context(children: list[dict], mode: str) -> tuple[str, list[str]]:
    """baseline -> raw child chunks; parent_child -> dedup full recipe bodies (cap 3).
    Returns (joined_context, contexts_list) — contexts_list feeds RAGAS retrieved_contexts."""
    if mode == "baseline":
        contexts = [c["text"] for c in children if c["text"]]
    elif mode == "parent_child":
        rids = dedup_recipe_ids(children)[:MAX_PARENTS]
        contexts = [b for rid in rids if (b := get_body(rid))]
    else:
        raise ValueError(f"unknown mode {mode!r}")
    return "\n\n---\n\n".join(contexts), contexts


def retrieve_timed(question: str, collection: str, k: int = 3) -> tuple[list[dict], float]:
    """retrieve_children with wall-clock ms. Called ONCE per (question, collection) so configs
    sharing a collection (fixed-150 / parent-child-150) reuse identical child hits."""
    t0 = time.perf_counter()
    children = retrieve_children(question, collection, k=k)
    return children, round((time.perf_counter() - t0) * 1000, 1)


def generate(question: str, children: list[dict], mode: str, retrieval_ms: float) -> dict:
    """Assemble context from shared `children` per `mode`, then generate. Retrieval already
    happened (shared) — only generation latency is measured here; total folds in retrieval_ms."""
    context, contexts = build_context(children, mode)
    system = SystemMessage(content=f"{_ANSWER_SYSTEM}\n\n--- CONTEXT ---\n{context}")

    t1 = time.perf_counter()
    reply = get_chat_llm().invoke([system, HumanMessage(content=question)])
    t_generation = round((time.perf_counter() - t1) * 1000, 1)

    return {
        "answer": reply.content,
        "contexts": contexts,
        "children": children,
        "retrieved_recipe_ids": dedup_recipe_ids(children),
        "context_tokens": n_tokens(context),
        "retrieval_ms": retrieval_ms,
        "generation_ms": t_generation,
        "total_ms": round(retrieval_ms + t_generation, 1),
    }


# ── Locked answer-correctness judge (1-5 vs reference) ───────────────────────
class _Verdict(BaseModel):
    score: int = Field(description="1-5: 1=wrong/contradicts, 3=partially correct, 5=fully correct")
    reason: str = Field(description="one short sentence")


# Frozen prompt + model, identical for every config (guardrail).
_JUDGE_SYSTEM = (
    "You are grading a baking assistant's answer against a reference answer. Score 1-5 for "
    "CORRECTNESS ONLY (does it convey the same factual content as the reference?):\n"
    "5 = fully correct, all key facts match the reference.\n"
    "4 = correct, minor omission or extra detail.\n"
    "3 = partially correct (some right, some missing/wrong).\n"
    "2 = mostly wrong.\n"
    "1 = wrong or contradicts the reference.\n"
    "Ignore style, verbosity, and phrasing. Judge only factual agreement with the reference."
)


def judge_correctness(question: str, answer_text: str, reference: str) -> dict:
    judge = get_chat_llm().with_structured_output(_Verdict)
    v = judge.invoke(
        [
            SystemMessage(content=_JUDGE_SYSTEM),
            HumanMessage(
                content=f"Question: {question}\n\nReference answer: {reference}\n\n"
                f"Assistant answer: {answer_text}"
            ),
        ]
    )
    return {"score": v.score, "reason": v.reason}
