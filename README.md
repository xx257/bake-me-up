# Bake Me Up 🍞

A **recipe knowledge & execution platform**. Bake Me Up turns a collected recipe — *and the
knowledge around it* (notes, tips, troubleshooting, workflow) — into a guided baking
experience. The journey is **Preserve → Discover → Understand → Execute → Troubleshoot →
Replicate**, with an AI companion (Kiwi) beside you: find the right recipe, understand it,
bake it step-by-step, recover from mistakes, and pass it on so others can recreate it too.

> AI Makerspace Certification Challenge v1.0 project.
>
> **📄 Submission write-up (all 7 tasks in one doc):** [`SUBMISSION.md`](SUBMISSION.md)
> · **Live:** [bake-me-up.vercel.app](https://bake-me-up.vercel.app) · **Demo:** [Part 1](https://www.loom.com/share/ed627f9e859644ec8e0dd28c7af5895d) · [Part 2](https://www.loom.com/share/68a04162924943958895838c100113bc)

## Problem

People collect recipes from many places — family, friends, baking classes, cookbooks,
blogs, personal experimentation — and usually preserve the *recipe*, but lose the
**knowledge required to recreate it**: why a step is written that way, what the dough should
look like, which mistake caused last time's failure, what "medium-soft peak" means. Most
recipe systems store instructions; very few preserve the experience needed to succeed. See
[`SUBMISSION.md`](SUBMISSION.md).

## Experience

Coaching is the heart of the product; retrieval and recommendation are supporting.

- **Discover / Understand** — describe what you want ("something fluffy", "which recipe uses
  yudane", "what can I make with cream cheese") and Bake Me Up finds the recipe, then lets
  you understand it on a calm recipe reference before you start.
- **Coach Mode (Execute)** — a full-screen calm instructor: it knows the **active recipe**,
  the **current step**, the **workflow**, and the **conversation**. Context greeting →
  current step → *Ready when* / tip → **I'm Ready** → a **per-step** Q&A (each step has its own
  conversation; the shared session thread keeps **full history** so the coach still remembers
  earlier steps). Optimized for **confidence, not completion**.
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
  **discovery** (`search_collection` — **parent-child** over fixed-150 recipe chunks: retrieve
  children → dedupe by `recipe_id` → full recipes) when the recipe is *unknown*.
  When the recipe is *known*, the coach loads the full recipe into context — no per-question
  RAG (a recipe fits the window). Workflow control is deterministic.
- **External:** Tavily web search — a **baking-knowledge** tool: a discovery tool for
  standalone questions (never to fetch recipes) and a coach fallback; shown as a visible card.
- **Monitoring:** LangSmith · **Eval:** RAGAS + discovery quality + LLM-judge.

Full write-up: [`SUBMISSION.md`](SUBMISSION.md).

## Run locally

```bash
# backend — LangGraph dev server + Studio  (needs backend/.env: model gateway, Qdrant, Tavily, LangSmith)
backend/.venv/bin/langgraph dev                                   # http://127.0.0.1:2024

# frontend — Next.js  (defaults to the deployed backend via .env.local;
# override to point at the local one:)
LANGGRAPH_API_URL=http://127.0.0.1:2024 npm --prefix frontend run dev   # http://localhost:3000
```

Deploy: push to `main` → Vercel auto-deploys the frontend; the LangGraph Platform backend is a
managed deploy of the `agent` graph (repo-root `langgraph.json`).

## Repo layout

- `backend/agent/` — the LangGraph agent: `graph.py` (route → discover / coach / redirect),
  `tools.py` (`search_baking_web`), `retrieval.py`, `catalog.py` / `ingest.py`
- `backend/eval/` — Task 5/6 evaluation harness (isolated; never runs in production)
- `frontend/` — Next.js app (Kitchen · Recipe page · Coach Mode) + `app/api/chat` proxy
- `data/recipes/` — the 6-recipe corpus · `SUBMISSION.md` — the full write-up (all 7 tasks)

## Submission

**[`SUBMISSION.md`](SUBMISSION.md)** — the complete written document: every deliverable
(Tasks 1–7 + Final Submission) in one place, with the diagrams, tables, and eval results inline.
