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

The graph (`agent/graph.py:graph`) is the Day-2 vertical slice: retrieve (dense Qdrant)
→ generate a recipe-grounded answer via the chat LLM behind the Vercel AI Gateway.

### Ingest the corpus

```bash
uv run --project backend python -m agent.ingest parse   # offline chunk report (no keys)
uv run --project backend python -m agent.ingest embed   # embed + upsert into Qdrant
```

## Layout

- `agent/graph.py` — the LangGraph agent (grows into router → RAG / workflow / Tavily / scale / timeline).
- `agent/{config,retrieval,ingest}.py` — lazy clients, dense retrieval, ingestion pipeline.
- `../langgraph.json` — LangGraph Platform / CLI config at the **repo root** (`dependencies: ["./backend"]`, graph id `agent`).
- `pyproject.toml` — deps (managed with `uv`).

See `../docs/02-solution.md` for the architecture and `../docs/03-data.md` for the
ingestion/chunking rules.
