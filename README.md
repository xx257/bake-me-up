# Bake Me Up 🍞

An AI-powered baking companion. The journey is **Choose → Learn → Bake Together**: it starts
from *what you want to bake*, recommends a recipe from the library for your goal, lets you
understand it on a calm recipe reference, then enters **Baking Together** — a full-screen
mode where a calm instructor guides you step-by-step, grounded in that recipe and falling
back to general baking knowledge when the library doesn't cover it.

> AI Makerspace Certification Challenge v1.0 project.
>
> **Live:** [bake-me-up.vercel.app](https://bake-me-up.vercel.app)

## Problem

Home bakers who receive recipes from an instructor, family member, or friend often
fail to reproduce them because the shared instructions omit the tacit, experience-based
knowledge needed to execute each step correctly. See [`docs/01-problem.md`](docs/01-problem.md).

## Experience (V0.1)

Two surfaces with different jobs — the coach's role differs on each:

- **Recipe Page = Knowledge → "Coach Available."** A recipe-first reference (hero, ingredients,
  timeline, steps). The recipe is the hero; the coach is secondary and **on-demand** — a quiet
  Ask-Coach entry that opens a lightweight chat overlay, not a persistent sidebar.
- **Baking Together = Experience → "Coach Active."** The signature full-screen mode — the coach
  is the hero. Context greeting → current step → *Ready when* / tip → **I'm Ready** → a
  persistent "Ask me anything" chat. Optimized for **confidence, not completion** (no progress
  bar, no counter, no "mark complete").

**One agent, one thread:** a single LangGraph `agent` serves the Kitchen planner, the on-demand
recipe coach, and Baking Together — all sharing one `threadId`, so the coach never re-asks what
was planned. (Session memory is in-memory for V0.1: continuous across navigation, reset on a
page refresh.)

## Architecture

- **Frontend:** Next.js on Vercel — Kitchen (AI planner) → Recipe Recommendation → Recipe Page (*Coach Available*) → Baking Together (*Coach Active*). Newsreader display serif, Geist body.
- **Agent:** Python LangGraph on **LangGraph Platform** (via LangSmith). Router → **plan** (extract intent → retrieve recipe profiles from Qdrant → rank & explain) / **bake** (full recipe loaded into the coach's context) / **general** (fallback). Per-session **thread** memory (managed Postgres) carries the goal from planning into baking.
- **LLM:** OpenAI (gpt-4o / gpt-4o-mini) behind the **Vercel AI Gateway**
- **Retrieval (V0.1 decision — Planning = Retrieval, Coaching = Full Recipe Context):** Qdrant Cloud + OpenAI embeddings power recommendation **profiles** for planning; the coach loads the full recipe into context (no per-question RAG — each session is one recipe and the corpus is small). Recipe-level `retrieve(recipe_id=…)` exists but stays unwired until the corpus grows.
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
- [x] **Agentic v1** — Kitchen planning + recipe recommendations, router (plan / bake / general), thread memory
- [x] **V0.1** — Two distinct surfaces: Recipe Page (Knowledge, *Coach Available*) + **Baking Together** (Experience, *Coach Active*, calm instructor); Newsreader headings; one agent / one thread across the journey
- [ ] **Next** — Tavily fallback, `scale()` / `timeline()`, no-RAG workflow engine, recipe-level coaching retrieval (corpus permitting), eval (RAGAS + recommendation + LLM-judge), Loom + write-up
