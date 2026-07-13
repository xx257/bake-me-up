# Evaluation Strategy (Task 5 / Task 6)

Different capabilities need different eval methods — RAGAS does not fit deterministic
tools, so the harness is split three ways.

## 1. RAG / QA — RAGAS

- **Metrics:** context precision, context recall, faithfulness, answer relevancy.
- **Test set:** synthetic + hand-written Q/A grounded in the recipe corpus
  (seeded from `docs/01-problem.md` §1.4).

## 2. Deterministic tools — unit checks

- **`scale()`:** assert ratio-correct amounts and preserved units against known
  input/output pairs.
- **`timeline()`:** assert ordering respects proof/bake dependencies and the schedule
  hits the target finish time.

## 3. Guidance quality — LLM-as-judge

- Judge helpfulness, grounding (answers cite the recipe), and correct refusal on
  out-of-scope / not-in-recipe questions (items 11–12 in §1.4).

## Baseline → improvement (Task 6)

**Chunking is held constant** (structure-aware section chunks — see
[`03-data.md`](03-data.md)). We change **one variable at a time** so each improvement is
attributable.

| Stage | Retriever | What changed |
|-------|-----------|--------------|
| **Baseline** | Structure-aware chunks + **dense-only** retrieval | — |
| **Advanced retrieval (Task 6.1)** | Same chunks + **hybrid (dense + BM25) + reranker** | retrieval method only |
| **Second improvement (Task 6.3)** | One of: active-recipe **metadata filtering**, **parent-recipe expansion**, or **improved system prompt** | one further single variable |

*Why hybrid:* recipe queries mix exact tokens ("tangzhong", "220°C") with semantic
intent ("why is my dough sticky") — hybrid captures both and reranking sharpens the
top-k. (Implementation of sparse retrieval is a Monday-AM spike — see
[`03-data.md`](03-data.md).)

- Report **baseline vs. advanced** in a results table (RAGAS metrics side by side).
- Then report the **second improvement** against the advanced run — harness as hard
  evidence of a meaningfully improved response.
