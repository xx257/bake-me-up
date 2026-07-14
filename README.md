# Bake Me Up 🍞

An AI-powered baking companion. It starts from *what you want to bake* — recommends a
recipe from the library for your goal, then coaches you through it step-by-step,
answering grounded in that recipe and falling back to general baking knowledge when the
library doesn't cover it.

> AI Makerspace Certification Challenge v1.0 project.
>
> **Live:** [bake-me-up.vercel.app](https://bake-me-up.vercel.app)

## Problem

Home bakers who receive recipes from an instructor, family member, or friend often
fail to reproduce them because the shared instructions omit the tacit, experience-based
knowledge needed to execute each step correctly. See [`docs/01-problem.md`](docs/01-problem.md).

## Architecture

- **Frontend:** Next.js on Vercel — Kitchen (AI planning) → Recipes → Recipe Detail → Guided Baking
- **Agent:** Python LangGraph on **LangGraph Platform** (via LangSmith). Router → **plan** (extract intent → retrieve recipe profiles from Qdrant → rank & explain) / **bake** (full recipe loaded into the coach's context) / **general** (fallback). Per-session **thread** memory (managed Postgres) carries the goal from planning into baking.
- **LLM:** OpenAI (gpt-4o / gpt-4o-mini) behind the **Vercel AI Gateway**
- **Retrieval:** Qdrant Cloud + OpenAI embeddings — recommendation **profiles** for planning; the coach loads the full recipe (no per-question RAG in v2)
- **Next:** Tavily web search, deterministic `scale()` / `timeline()`, no-RAG workflow engine
- **Monitoring:** LangSmith · **Eval:** RAGAS + recommendation + LLM-judge

Full write-up: [`docs/02-solution.md`](docs/02-solution.md).

## Docs

- [`docs/01-problem.md`](docs/01-problem.md) — Task 1: problem, audience, scope, eval questions
- [`docs/02-solution.md`](docs/02-solution.md) — Task 2: solution, infra & agent diagrams
- [`docs/03-data.md`](docs/03-data.md) — Task 3: data sources + chunking strategy
- [`docs/evaluation.md`](docs/evaluation.md) — evaluation strategy

## Status

- [x] **Day 1** — Product definition & architecture
- [x] **Day 2** — Vertical slice deployed end-to-end (RAG + memory + chat), both ends live
- [x] **Agentic v1** — Kitchen planning + recipe recommendations, router (plan / recipe_qa / general), thread memory, Guided Baking
- [ ] **Next** — Tavily fallback, `scale()` / `timeline()`, no-RAG workflow engine, eval (RAGAS + recommendation + LLM-judge), Loom + write-up
