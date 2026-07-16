# Bake Me Up — backend (LangGraph)

Python LangGraph agent, deployed on **LangGraph Platform** (via paid LangSmith).

## Local dev

`langgraph.json` lives at the **repo root** (LangGraph Platform expects it there), so run
the dev server from the repo root:

```bash
cp backend/.env.example backend/.env      # fill in keys
uv sync --project backend --dev           # install deps into backend/.venv
uv run --project backend langgraph dev    # local in-memory dev server + Studio URL
```

The graph (`agent/graph.py:graph`) is a context-gated **router** → three lanes:
- **discover** — an agentic node that binds **two tools** and calls **exactly one**:
  `search_collection` (**parent-child** over fixed-150 recipe chunks in Qdrant → dedupe by `recipe_id` → full recipes → rank & explain) for finding/comparing/
  recommending a recipe, or `search_baking_web` (Tavily) for a **standalone baking-knowledge**
  question the collection doesn't cover. A missing/ambiguous choice retries once, then returns a
  graceful error — never silently recommends. Tavily is knowledge-only, never used to fetch recipes;
- **coach** — a recipe is active: load the **full recipe** into context and answer grounded in it
  (no per-question retrieval), with Tavily as a fallback for what the recipe can't answer;
- **redirect** — off-topic guard: declines and steers back to baking, no tools.

All chat LLM calls go through the **Vercel AI Gateway**; per-session **thread** memory (managed
Postgres checkpointer) carries the discovery goal into baking. **Retrieval decision:
Discovery = Retrieval, Coaching = Full Recipe Context** — discovery uses **parent-child** retrieval
(`retrieve_recipes` in `agent/retrieval.py`: fixed-150 child chunks → dedupe by `recipe_id` → full
recipes); the eval (`backend/eval/`) imports the same primitives, so it evaluates the shipped retriever.

### Ingest the corpus

```bash
uv run --project backend python -m agent.ingest parse   # offline parser sanity report (no keys)
uv run --project backend python -m agent.ingest fixed   # embed fixed-150 child chunks -> Qdrant
```

## Layout

- `agent/graph.py` — the LangGraph agent: router → discover / coach / redirect; defines `search_collection` and picks one discovery tool per turn.
- `agent/tools.py` — `search_baking_web` (Tavily), a traced first-class tool span with graceful fallback.
- `agent/{config,retrieval,ingest}.py` — lazy clients, dense retrieval, ingestion pipeline.
- `../langgraph.json` — LangGraph Platform / CLI config at the **repo root** (`dependencies: ["./backend"]`, graph id `agent`).
- `pyproject.toml` — deps (managed with `uv`).

See [`../SUBMISSION.md`](../SUBMISSION.md) for the full architecture, data, and evaluation write-up.
