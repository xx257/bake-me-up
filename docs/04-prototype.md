# Task 4 — End-to-End Agentic RAG Prototype

**Deliverables:** (1) build an end-to-end prototype on a production-grade stack; (2) deploy it to a
public endpoint.

## 4.1 What's built

A working end-to-end **agentic RAG** baking companion — not a demo stub, the real journey:

**Discover → Understand → Execute → Troubleshoot.**

1. **Kitchen (Discover).** A natural-language request ("something fluffy and not too sweet",
   "which recipe uses yudane?") hits the LangGraph agent. The `discover` node binds **two tools** and
   the model calls **exactly one**: `search_collection` (dense retrieval over recipe **profiles** in
   Qdrant → rank → recommendation cards) for finding a recipe, or `search_baking_web` (Tavily) for a
   standalone baking-knowledge question the collection can't answer. Both surface as **visible tool
   cards** ("Searched your collection" / "Searched the web").
2. **Recipe page (Understand).** The chosen recipe renders with its structured knowledge — steps,
   instructor tips, troubleshooting, workflow — and an "Ask Coach" entry point.
3. **Coach Mode (Execute).** A full-screen, step-by-step flow. The `coach` node loads the **full
   recipe** into context (no per-question RAG) and grounds every answer in *Active Recipe + Workflow
   State + Conversation*; **Tavily is a fallback** only for what the recipe genuinely can't cover.
   Workflow control ("what's next?") is deterministic from the step graph. Conversation is **per
   step** in the UI while the **shared LangGraph thread carries the full session** so the coach
   remembers across steps.
4. **Off-topic** turns are declined by the `redirect` lane.

The graph is `route → { discover · coach · redirect }` — three lanes, no separate classifier node
(the discovery node's own tool choice is the decision). See [`02-solution.md`](02-solution.md) for
the architecture and workflow diagrams.

## 4.2 Production-grade stack

| Layer | Choice |
|-------|--------|
| Frontend | **Next.js (App Router) on Vercel** — responsive web app (phone + laptop) |
| Agent | **Python LangGraph** on **LangGraph Platform** (managed, via LangSmith), graph id `agent` |
| LLM | chat + mini models behind the **Vercel AI Gateway** (OpenAI-compatible) |
| Tools | `search_collection` (Qdrant profiles) + `search_baking_web` (**Tavily**) |
| Embeddings | OpenAI `text-embedding-3-small` (direct) |
| Vector DB | **Qdrant Cloud** — recipe profiles |
| Memory | **LangGraph checkpointer** (managed Postgres), per-session thread |
| Monitoring | **LangSmith** — traces routing, both discovery tools, and Tavily calls |

## 4.3 Meets the Task 2 requirements

- **Runs in a browser on phone and laptop** — a responsive Next.js web app; no install.
- **LLM gateway** — every chat call routes through the **Vercel AI Gateway** (the backend's chat
  client `base_url`).
- **Memory component** — a per-session **LangGraph thread** (Postgres checkpointer) carries context
  from discovery → understanding → baking; verified: the coach recalls details stated on an earlier
  step later in the session.

## 4.4 Deployment (public endpoint)

- **Live app:** **https://bake-me-up.vercel.app**
- **Frontend → Vercel.** `git push` to `main` triggers Vercel's GitHub integration to build and
  deploy the Next.js app.
- **Backend → LangGraph Platform.** The `agent` graph (repo-root `langgraph.json`,
  `dependencies: ["./backend"]`) is deployed as a managed LangGraph Platform service with the
  Postgres checkpointer.
- **Wiring.** The browser never talks to the model directly: a Next.js server route
  (`frontend/app/api/chat/route.ts`) proxies to the LangGraph deployment, holding the API key
  server-side and running each turn on the per-session `threadId`.

## 4.5 Run it locally

```bash
# backend (LangGraph dev server + Studio)
cd bake_me_up && backend/.venv/bin/langgraph dev        # http://127.0.0.1:2024

# frontend (point it at local or the deployed backend via LANGGRAPH_API_URL)
cd frontend && npm run dev                              # http://localhost:3000
```

Recipes are compiled to a committed `catalog.json` (ships with the deploy) and embedded into Qdrant
via `backend/agent/ingest.py` / `build_catalog.py`.
