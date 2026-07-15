# Bake Me Up 🍞

A **recipe knowledge & execution platform**. Bake Me Up turns a collected recipe — *and the
knowledge around it* (notes, tips, troubleshooting, workflow) — into a guided baking
experience. The journey is **Preserve → Discover → Understand → Execute → Troubleshoot →
Replicate**, with an AI companion (Kiwi) beside you: find the right recipe, understand it,
bake it step-by-step, recover from mistakes, and pass it on so others can recreate it too.

> AI Makerspace Certification Challenge v1.0 project.
>
> **Live:** [bake-me-up.vercel.app](https://bake-me-up.vercel.app)

## Problem

People collect recipes from many places — family, friends, baking classes, cookbooks,
blogs, personal experimentation — and usually preserve the *recipe*, but lose the
**knowledge required to recreate it**: why a step is written that way, what the dough should
look like, which mistake caused last time's failure, what "medium-soft peak" means. Most
recipe systems store instructions; very few preserve the experience needed to succeed. See
[`docs/01-problem.md`](docs/01-problem.md).

## Experience

Coaching is the heart of the product; retrieval and recommendation are supporting.

- **Discover / Understand** — describe what you want ("something fluffy", "which recipe uses
  yudane", "what can I make with cream cheese") and Bake Me Up finds the recipe, then lets
  you understand it on a calm recipe reference before you start.
- **Coach Mode (Execute)** — a full-screen calm instructor: it knows the **active recipe**,
  the **current step**, the **workflow**, and the **conversation**. Context greeting →
  current step → *Ready when* / tip → **I'm Ready** → a persistent "ask me anything" chat.
  Optimized for **confidence, not completion**.
- **Troubleshoot** — recipe-specific recovery ("why did my cheesecake crack?"), with a web
  fallback only when the recipe genuinely can't answer.

**One agent, one thread:** a single LangGraph `agent` spans discovery, understanding, and
coaching, sharing one `threadId` so context never repeats.

## Architecture

- **Frontend:** Next.js on Vercel — Kitchen (Discover) → Recipe Page (Understand) → Coach
  Mode (Execute). Newsreader display serif, Inter body.
- **Agent:** Python LangGraph on **LangGraph Platform** (via LangSmith). Router →
  **discover** (an agentic node that calls **exactly one** tool — `search_collection` for
  finding/recommending recipes, or `search_baking_web` for a standalone baking question) /
  **coach** (active recipe + workflow + conversation, *no retrieval*, Tavily as fallback) /
  **redirect** (off-topic guard, no tools). Per-session **thread** memory (managed Postgres).
- **LLM:** chat + mini models behind the **Vercel AI Gateway**.
- **Retrieval — only when it adds value:** Qdrant Cloud + OpenAI embeddings power
  **discovery** (`search_collection` over recipe **profiles**) when the recipe is *unknown*.
  When the recipe is *known*, the coach loads the full recipe into context — no per-question
  RAG (a recipe fits the window). Workflow control is deterministic.
- **External:** Tavily web search — a **baking-knowledge** tool: a discovery tool for
  standalone questions (never to fetch recipes) and a coach fallback; shown as a visible card.
- **Monitoring:** LangSmith · **Eval:** RAGAS + discovery quality + LLM-judge.

Full write-up: [`docs/02-solution.md`](docs/02-solution.md).

## Docs

- [`docs/01-problem.md`](docs/01-problem.md) — Task 1: problem, audience, scope, eval questions
- [`docs/02-solution.md`](docs/02-solution.md) — Task 2: solution, infra & agent diagrams
- [`docs/03-data.md`](docs/03-data.md) — Task 3: data sources + chunking strategy
- [`docs/evaluation.md`](docs/evaluation.md) — evaluation strategy

## Status

- [x] **Day 1** — Product definition & architecture
- [x] **Day 2** — Vertical slice deployed end-to-end (RAG + memory + chat), both ends live
- [x] **Coaching experience** — Recipe Page (Understand) + full-screen Coach Mode (Execute),
      calm instructor, step-aware; one agent / one thread across the journey
- [x] **Agentic discovery** — `search_collection` + `search_baking_web` as tools; the discover
      node calls exactly one, so a standalone baking question is answered from the web (visible
      "Searched the web" card), while recipe search stays collection-only
- [ ] **In progress** — evaluation (RAGAS + discovery + LLM-judge), Loom + write-up
- [ ] **Planned** — web **recipe discovery**: let Tavily also find recipes off the web and
      **ingest** them into the collection (structure → profile + body → Qdrant), so a "no match"
      can become a saved recipe. Today Tavily is deliberately knowledge-only; this is the next
      step, not current behavior.
