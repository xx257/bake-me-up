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
- **plan** — extract intent → retrieve recipe **profiles** from Qdrant → rank & explain (the
  planning RAG lane);
- **bake** — load the **full selected recipe** into the coach's context and answer grounded in
  it (V0.1: full-context, no per-question retrieval);
- **general** — general baking knowledge when the library doesn't cover the ask.

All chat LLM calls go through the **Vercel AI Gateway**; per-session **thread** memory (managed
Postgres checkpointer) carries the planning goal into baking. **V0.1 retrieval decision:
Planning = Retrieval, Coaching = Full Recipe Context** — `retrieve(recipe_id=…)` in
`agent/retrieval.py` is built but unwired until the corpus grows.

### Ingest the corpus

```bash
uv run --project backend python -m agent.ingest parse   # offline chunk report (no keys)
uv run --project backend python -m agent.ingest embed   # embed + upsert into Qdrant
```

## Layout

- `agent/graph.py` — the LangGraph agent: router → plan / bake / general (grows to add Tavily / scale / timeline).
- `agent/{config,retrieval,ingest}.py` — lazy clients, dense retrieval, ingestion pipeline.
- `../langgraph.json` — LangGraph Platform / CLI config at the **repo root** (`dependencies: ["./backend"]`, graph id `agent`).
- `pyproject.toml` — deps (managed with `uv`).

See `../docs/02-solution.md` for the architecture and `../docs/03-data.md` for the
ingestion/chunking rules.
