# Evaluation harness (Tasks 5 / 6)

Isolated eval code — **not** part of the deployed agent. See [`SUBMISSION.md`](../../SUBMISSION.md)
(Tasks 5 & 6) for the full write-up and results; raw outputs live in `results/`.

## Layout
- `testset.jsonl` — 14 hand-written cases (10 retrieval + 4 behavior), grounded in the corpus.
- `build_collections.py` — builds the two eval collections (`eval_150`, `eval_250`) from
  `data/recipes` via `agent.ingest`.
- `harness.py` — shared primitives: `retrieve_children` (the one retriever both configs share),
  `generate` (context assembly + answer), and the locked 1–5 correctness judge.
- `run_eval.py` — Task 6 retrieval comparison (3 configs) → `results/retrieval_{results.json,table.md}`.
- `run_behavior.py` — Task 5 behavior subset through the production graph → `results/behavior_results.json`.

## Run (needs `--group eval`; keys from `backend/.env`)
```bash
uv run --project backend --group eval python backend/eval/build_collections.py
uv run --project backend --group eval python backend/eval/run_eval.py
uv run --project backend --group eval python backend/eval/run_behavior.py
```

Deps pinned for compatibility: `ragas>=0.2.10,<0.3`, `langchain-community>=0.3.0,<0.4`
(newer versions drop `chat_models.vertexai`, which ragas 0.2.x imports at load).
