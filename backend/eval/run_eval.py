"""Task 6 retrieval evaluation: fixed-150 vs parent-child-150 vs parent-child-250.

Two physical collections, three configs (fixed-150 and parent-child-150 share eval_150, so
their child retrieval is identical by construction). Metrics: recipe_id_hit@3 (primary),
answer_correctness (locked 1-5 judge), faithfulness + answer_relevancy (RAGAS),
average_context_tokens, latency. Row-level + aggregate results written to results/.

Run:  uv run --project backend --group eval python backend/eval/run_eval.py
"""

from __future__ import annotations

import json
import statistics as stats
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_BACKEND = _HERE.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from harness import generate, judge_correctness, retrieve_timed  # noqa: E402

# (config name, collection, mode). fixed-150 & parent-child-150 share eval_150 → we retrieve
# eval_150's children ONCE per question and hand the SAME hits to both (exact identity).
CONFIGS = [
    ("fixed-150", "bake_me_up_recipes_eval_150", "baseline"),
    ("parent-child-150", "bake_me_up_recipes_eval_150", "parent_child"),
    ("parent-child-250", "bake_me_up_recipes_eval_250", "parent_child"),
]
COLLECTIONS = sorted({c[1] for c in CONFIGS})
K = 3
RESULTS_DIR = _HERE / "results"


def load_rows(subset: str) -> list[dict]:
    rows = [json.loads(li) for li in (_HERE / "testset.jsonl").read_text().splitlines() if li.strip()]
    return [r for r in rows if r["subset"] == subset]


def _row_result(r: dict, res: dict) -> dict:
    hit = bool(set(r["expected_recipe_ids"]) & set(res["retrieved_recipe_ids"]))
    verdict = judge_correctness(r["question"], res["answer"], r["reference_answer"])
    return {
        "id": r["id"], "question": r["question"], "category": r["category"],
        "expected_recipe_ids": r["expected_recipe_ids"],
        "retrieved_recipe_ids": res["retrieved_recipe_ids"],
        "child_hits": [{"recipe_id": c["recipe_id"], "score": c["score"]} for c in res["children"]],
        "recipe_id_hit": hit,
        "answer": res["answer"], "reference_answer": r["reference_answer"],
        "correctness": verdict["score"], "correctness_reason": verdict["reason"],
        "context_tokens": res["context_tokens"],
        "retrieval_ms": res["retrieval_ms"], "generation_ms": res["generation_ms"],
        "total_ms": res["total_ms"], "contexts": res["contexts"],
    }


def run_all(rows: list[dict]) -> dict[str, list[dict]]:
    """Per question: retrieve each collection's children ONCE, then generate every config that
    uses it from the shared hits. Guarantees fixed-150 & parent-child-150 see identical children."""
    out: dict[str, list[dict]] = {name: [] for name, _, _ in CONFIGS}
    for r in rows:
        shared = {coll: retrieve_timed(r["question"], coll, k=K) for coll in COLLECTIONS}
        for name, coll, mode in CONFIGS:
            children, retrieval_ms = shared[coll]
            res = generate(r["question"], children, mode, retrieval_ms)
            rr = _row_result(r, res)
            out[name].append(rr)
            print(f"  [{name}] {r['id']}: hit={rr['recipe_id_hit']} correctness={rr['correctness']} "
                  f"tokens={rr['context_tokens']} total_ms={rr['total_ms']}")
    return out


def add_ragas(rows_by_config: dict[str, list[dict]]) -> None:
    """Attach RAGAS faithfulness + answer_relevancy per row (best-effort)."""
    try:
        from ragas import EvaluationDataset, SingleTurnSample, evaluate
        from ragas.embeddings import LangchainEmbeddingsWrapper
        from ragas.llms import LangchainLLMWrapper
        from ragas.metrics import Faithfulness, ResponseRelevancy

        from agent.config import get_chat_llm, get_embeddings
        llm = LangchainLLMWrapper(get_chat_llm())
        emb = LangchainEmbeddingsWrapper(get_embeddings())
        metrics = [Faithfulness(llm=llm), ResponseRelevancy(llm=llm, embeddings=emb)]

        for name, rows in rows_by_config.items():
            ds = EvaluationDataset(samples=[
                SingleTurnSample(user_input=r["question"], response=r["answer"],
                                 retrieved_contexts=r["contexts"] or [""])
                for r in rows
            ])
            df = evaluate(ds, metrics=metrics).to_pandas()
            for r, (_, row) in zip(rows, df.iterrows()):
                r["faithfulness"] = _num(row.get("faithfulness"))
                r["answer_relevancy"] = _num(row.get("answer_relevancy"))
            print(f"  [ragas] {name}: done")
    except Exception as e:  # noqa: BLE001
        print(f"  [ragas] SKIPPED ({type(e).__name__}: {e}) — hit@3 + correctness still valid")
        for rows in rows_by_config.values():
            for r in rows:
                r.setdefault("faithfulness", None)
                r.setdefault("answer_relevancy", None)


def _num(v):
    try:
        f = float(v)
        return round(f, 4) if f == f else None  # NaN guard
    except (TypeError, ValueError):
        return None


def _mean(xs):
    xs = [x for x in xs if isinstance(x, (int, float))]
    return round(stats.mean(xs), 3) if xs else None


def aggregate(rows: list[dict]) -> dict:
    n = len(rows)
    return {
        "n": n,
        "recipe_id_hit@3": round(sum(r["recipe_id_hit"] for r in rows) / n, 3),
        "mean_correctness": _mean([r["correctness"] for r in rows]),
        "pass_rate@4": round(sum(r["correctness"] >= 4 for r in rows) / n, 3),
        "faithfulness": _mean([r["faithfulness"] for r in rows]),
        "answer_relevancy": _mean([r["answer_relevancy"] for r in rows]),
        "avg_context_tokens": round(stats.mean(r["context_tokens"] for r in rows)),
        "avg_retrieval_ms": round(stats.mean(r["retrieval_ms"] for r in rows), 1),
        "avg_generation_ms": round(stats.mean(r["generation_ms"] for r in rows), 1),
        "avg_total_ms": round(stats.mean(r["total_ms"] for r in rows), 1),
    }


def identity_check(fixed: list[dict], pc150: list[dict]) -> dict:
    """fixed-150 and parent-child-150 must return identical child hits + recipe ids per row."""
    mismatches = []
    for a, b in zip(fixed, pc150):
        if a["child_hits"] != b["child_hits"] or a["retrieved_recipe_ids"] != b["retrieved_recipe_ids"]:
            mismatches.append(a["id"])
    return {"identical": not mismatches, "mismatched_ids": mismatches}


def markdown_table(aggs: dict[str, dict]) -> str:
    cols = ["recipe_id_hit@3", "mean_correctness", "pass_rate@4", "faithfulness",
            "answer_relevancy", "avg_context_tokens", "avg_total_ms"]
    head = "| config | " + " | ".join(cols) + " |"
    sep = "|" + "---|" * (len(cols) + 1)
    lines = [head, sep]
    for name, a in aggs.items():
        lines.append("| " + name + " | " + " | ".join(str(a[c]) for c in cols) + " |")
    return "\n".join(lines)


def main() -> None:
    rows = load_rows("retrieval")
    print(f"Retrieval subset: {len(rows)} questions x {len(CONFIGS)} configs\n")
    rows_by_config = run_all(rows)

    print("\nRunning RAGAS (faithfulness + answer_relevancy)...")
    add_ragas(rows_by_config)

    aggs = {name: aggregate(rws) for name, rws in rows_by_config.items()}
    ident = identity_check(rows_by_config["fixed-150"], rows_by_config["parent-child-150"])

    RESULTS_DIR.mkdir(exist_ok=True)
    (RESULTS_DIR / "retrieval_results.json").write_text(json.dumps(
        {"configs": rows_by_config, "aggregates": aggs, "identity_check": ident}, indent=2))
    table = markdown_table(aggs)
    (RESULTS_DIR / "retrieval_table.md").write_text(
        f"# Task 6 — retrieval comparison\n\n{table}\n\n"
        f"Identity check (fixed-150 vs parent-child-150 child hits): "
        f"{'IDENTICAL ✅' if ident['identical'] else 'MISMATCH: ' + str(ident['mismatched_ids'])}\n")

    print("\n" + table)
    print(f"\nIdentity check (fixed-150 == parent-child-150 child hits): "
          f"{'IDENTICAL ✅' if ident['identical'] else 'MISMATCH ' + str(ident['mismatched_ids'])}")
    print(f"\nWrote {RESULTS_DIR}/retrieval_results.json + retrieval_table.md")


if __name__ == "__main__":
    main()
