# Task 3 — Dealing with the Data

## Data sources

The corpus is deliberately small and *personal-first*: Bake Me Up reads as a companion for
recreating a specific collection's recipes, not a generic recipe search engine. Each recipe
is a **structured knowledge asset**, not just instructions.

- **Recipe Knowledge Base (your own data / RAG):** **6 recipes today**, manually cleaned
  from handwritten / PDF / instructor-handout sources in `data/recipes/`. Beyond ingredients
  and steps, each carries the *surrounding knowledge* — **instructor tips**, **troubleshooting
  Q&A**, per-step notes, and a **workflow** (step graph). This knowledge is the point of the
  product.
- **External knowledge (Agent):** **Tavily Search**, for baking knowledge outside the corpus
  (open-world substitutions, general technique) — a **discovery tool** for standalone baking
  questions and a **coach fallback** for a known recipe. Knowledge-only; never used to fetch
  recipes.
- **Workflow state (deterministic):** the per-step `next_step` chain + completion criteria,
  parsed into a step graph — drives "what's next?" without retrieval.

The corpus overlaps on purpose (milk bread, roll cake, anpan, cheesecake, cookies, mochi
share terms like *meringue*, *yudane*, *water bath*, *cream cheese*) so discovery retrieval
has a realistic job: pick the *right* recipe among *similar* ones.

## How the data is used per mode

Recipes are compiled by `backend/agent/build_catalog.py` into a committed `catalog.json`
(so the data ships with the deploy — the backend never reads `data/recipes/` at runtime),
and embedded into Qdrant by `backend/agent/ingest.py`.

- **Discovery (recipe unknown) → one tool per turn.** The discover node binds two tools and the
  model calls **exactly one**. `search_collection` does **dense retrieval over recipe profiles**
  in Qdrant (compact per-recipe embeddings: taste, texture, occasion, time, summary), ranks them,
  and recommends ("which recipe uses yudane?", "something fluffy"). For a **standalone
  baking-knowledge** question the collection doesn't cover ("why does yudane make bread softer?"),
  the model calls `search_baking_web` (Tavily) instead. Retrieval is used **only** here — where
  the target is unknown.
- **Coaching (recipe known) → full recipe in context.** The complete normalized recipe
  markdown is loaded straight into the coach's context — **no per-question retrieval**. One
  recipe fits the window, and coaching benefits from seeing every step, tip, and
  troubleshooting note together (Tavily remains a fallback for what the recipe can't answer).

## How they interact during usage

The agent prefers the **local Recipe Knowledge Base**. In discovery (no recipe active) the
model picks one tool: `search_collection` for finding/recommending a recipe, or `search_baking_web`
when the turn is a standalone baking question the corpus can't answer (e.g. "can I swap bread
flour for AP flour?"), grounding the reply in web results. In coaching (recipe active) it answers
from the full recipe and falls back to Tavily only for what the recipe doesn't cover. So the
collection owns "which recipe / what does *this* recipe say"; Tavily owns open-world "general
baking knowledge" (never recipe-finding). Workflow control ("what's next?") is deterministic and
uses neither.

## Chunking strategy

> **Scope.** Live discovery ranks over **recipe profiles** (above). The 150-token chunk
> retriever described here is the **Task-6 retrieval-experiment baseline** — built in
> `agent/ingest.py` + `retrieve_recipes`, embedded to Qdrant, but **not wired into the live
> discovery path**. It's the groundwork for chunk-level *recipe-content* retrieval (answering
> knowledge from recipe bodies) and the controlled experiment in `evaluation.md`.

**Fixed-size dense chunking (150 tokens, no overlap).** The cleaned recipe prose is split
into **150-token** chunks (`cl100k_base`, the tokenizer `text-embedding-3-small` uses),
each tagged with its `recipe_id` (a keyword payload index) so retrieved chunks map back to
the recipe. This is the conventional dense baseline for the retrieval experiment.

**Why 150 — measured, not guessed.** We profiled the cleaned content before fixing the
size:

| Unit | min | median | mean | p75 | p90 | max |
|------|-----|--------|------|-----|-----|-----|
| Natural content units (step / tip / troubleshooting Q&A), tokens | 15 | **50** | 51 | 62 | 82 | **138** |

Full cleaned recipes run **~700–1060 tokens** each. Two consequences:

1. **150 is a sound chunk size** — it comfortably exceeds the largest single content unit
   (138), so a chunk never fragments below one semantic unit; it merges ~3 small units,
   which is exactly the naive fixed-size behavior a baseline should have.
2. **Coaching needs no retrieval** — a whole recipe (~800 tokens) fits the model window, so
   the coach loads the full recipe rather than retrieving pieces of it.

**What's embedded vs. parsed (hybrid file format).** Recipes use a hybrid format — YAML
frontmatter for structure/tools + a prose body for RAG (see
[`../data/recipes/TEMPLATE.md`](../data/recipes/TEMPLATE.md)):

- **Prose body is embedded:** `## Ingredients`, each step's `#### Recipe`, `## Instructor
  Tips`, `## Troubleshooting`, `## Recipe Summary` — the knowledge worth retrieving.
- **Frontmatter is parsed, not embedded** (`scale`, `yield`, `equipment`, profile fields) —
  it feeds the catalog and future deterministic tools.
- **Per-step `#### Workflow` YAML is stripped from the embedded text** and parsed into the
  step graph (`id` → `next_step` + `completion`) that drives deterministic "what's next?" —
  embedding raw YAML would only pollute retrieval.
- `TEMPLATE.md` and `README.md` are skipped.

## Retrieval experiment (Task 6)

The baseline (fixed-150 dense) is one point in a **controlled retrieval experiment** —
baseline vs. one advanced variant, holding everything else constant and varying a single
factor at a time. That experiment and its metrics live in
[`evaluation.md`](evaluation.md).
