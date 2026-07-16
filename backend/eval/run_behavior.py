"""Behavior subset: run each case through the PRODUCTION LangGraph agent (read-only).

Verifies routing/tool selection reflects the current system:
  collection request -> discover/search_collection · standalone knowledge -> search_baking_web
  off-topic -> redirect · pinned knowledge gap -> recipe-first + Tavily fallback.
Each case sets explicit thread state (active_recipe / current_recommendation) as needed.
Reported separately from retrieval metrics. Mismatches are surfaced, not patched.

Run:  uv run --project backend --group eval python backend/eval/run_behavior.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_BACKEND = _HERE.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(_BACKEND / ".env")

from agent.graph import graph  # noqa: E402  (production graph — invoked, never modified)

RESULTS_DIR = _HERE / "results"


def load_behavior() -> list[dict]:
    rows = [json.loads(li) for li in (_HERE / "testset.jsonl").read_text().splitlines() if li.strip()]
    return [r for r in rows if r["subset"] == "behavior"]


def observe(row: dict) -> dict:
    """Invoke the production graph with explicit thread state; read routing signals from state."""
    ts = row.get("thread_state", {})
    state = {
        "messages": [{"role": "user", "content": row["question"]}],
        "active_recipe": ts.get("active_recipe"),
        "current_recommendation": ts.get("current_recommendation"),
    }
    final = graph.invoke(state)
    tool = final.get("tool") or None
    web = final.get("web_search") or None
    return {
        "mode": final.get("mode"),
        "tool": tool.get("name") if isinstance(tool, dict) else None,
        "web_search": bool(web),
        "reply": (final["messages"][-1].content if final.get("messages") else "")[:240],
    }


def check(expected: dict, actual: dict) -> bool:
    if expected.get("mode") and expected["mode"] != actual["mode"]:
        return False
    exp_tool = expected.get("tool")
    if exp_tool == "search_collection" and actual["tool"] != "search_collection":
        return False
    if exp_tool == "search_baking_web" and not actual["web_search"]:
        return False
    if exp_tool is None and (actual["tool"] or actual["web_search"]):
        return False
    return True


def main() -> None:
    rows = load_behavior()
    print(f"Behavior subset: {len(rows)} cases through the production graph\n")
    out = []
    for r in rows:
        actual = observe(r)
        passed = check(r["expected"], actual)
        out.append({"id": r["id"], "category": r["category"], "question": r["question"],
                    "expected": r["expected"], "actual": actual, "pass": passed})
        mark = "PASS" if passed else "MISMATCH"
        print(f"  [{mark}] {r['id']} ({r['category']}): expected {r['expected']} | "
              f"actual mode={actual['mode']} tool={actual['tool']} web={actual['web_search']}")

    n_pass = sum(o["pass"] for o in out)
    RESULTS_DIR.mkdir(exist_ok=True)
    (RESULTS_DIR / "behavior_results.json").write_text(
        json.dumps({"cases": out, "pass_rate": round(n_pass / len(out), 3)}, indent=2))
    print(f"\nBehavior: {n_pass}/{len(out)} routed as expected. "
          f"Wrote {RESULTS_DIR}/behavior_results.json")


if __name__ == "__main__":
    main()
