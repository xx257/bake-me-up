# Bake Me Up 🍞

An AI-powered baking companion that turns a shared recipe into an interactive,
step-by-step session. It answers questions grounded in *your* recipe, explains
techniques, searches the web when the recipe doesn't cover it, and generates exact
ingredient scaling and a dependency-aware bake timeline.

> AI Makerspace Certification Challenge v1.0 project.

## Problem

Home bakers who receive recipes from an instructor, family member, or friend often
fail to reproduce them because the shared instructions omit the tacit, experience-based
knowledge needed to execute each step correctly. See [`docs/01-problem.md`](docs/01-problem.md).

## Architecture

- **Frontend:** Next.js on Vercel (runs on phone + laptop in a browser)
- **Agent:** Python LangGraph on **LangGraph Platform** (managed via LangSmith), with a managed Postgres checkpointer for memory
- **LLM:** OpenAI (gpt-4o / gpt-4o-mini) behind the **Vercel AI Gateway**
- **Retrieval:** Qdrant Cloud vector store, OpenAI embeddings; hybrid + rerank
- **Tools:** Tavily web search, deterministic `scale()` and `timeline()`
- **Monitoring:** LangSmith · **Eval:** RAGAS + custom + LLM-judge

Full write-up: [`docs/02-solution.md`](docs/02-solution.md).

## Docs

- [`docs/01-problem.md`](docs/01-problem.md) — Task 1: problem, audience, scope, eval questions
- [`docs/02-solution.md`](docs/02-solution.md) — Task 2: solution, infra & agent diagrams
- [`docs/03-data.md`](docs/03-data.md) — Task 3: data sources + chunking strategy
- [`docs/evaluation.md`](docs/evaluation.md) — evaluation strategy

## Status

- [x] **Day 1** (Sun 7/12) — Product definition & architecture
- [ ] **Day 2** (Mon 7/13) — Vertical slice: deployed RAG + memory + chat, end-to-end
- [ ] **Day 3** (Tue 7/14) — Complete MVP: scaling + timeline tools, baseline eval; feature freeze
- [ ] **Day 4** (Wed 7/15) — Retrieval improvements + polish + docs + Loom
- [ ] **Day 5** (Thu 7/16) — Release & submit *(deadline 7pm ET)*
