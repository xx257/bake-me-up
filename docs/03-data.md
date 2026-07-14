# Task 3 — Dealing with the Data (design decided Day 1, built Day 2)

## Data sources

The corpus stays deliberately small and *personal-first* so the app reads as a
companion for recreating a specific person's recipes — not a generic recipe search
engine.

- **Personal / instructor-style recipes (your own data / RAG):** **5–8** recipes,
  manually cleaned (handwritten/PDF/instructor handouts). This is the heart of the
  corpus. *TODO Day 2: add files to `data/recipes/`.*
- **Public recipes (optional):** **only 2–3**, and only to introduce *retrieval
  ambiguity* (near-duplicate terminology across documents) — not to pad coverage.
- **External API (Agent):** **Tavily Search** for questions the corpus can't answer
  (substitutions, techniques, general baking knowledge).

We don't need a large corpus — just enough *similar* recipes to make retrieval
evaluation meaningful. Candidate set (overlapping terminology on purpose):

- Japanese milk bread
- matcha milk bread
- red bean buns
- brioche
- tangzhong dinner rolls
- butter cookies
- matcha cookies

Shared terms (tangzhong, milk bread, matcha, enriched dough) across documents create a
realistic retrieval test where the retriever must pick the *right* similar recipe.

## Data for the two modes (v2)

Two derived artifacts, both generated from the recipe files by
`backend/agent/build_catalog.py` into a committed `catalog.json` (so they ship with the
deploy — the backend never reads `data/recipes` at runtime):

- **Recommendation profiles (Planning Mode).** A lightweight semantic profile per recipe
  — title, summary, difficulty, total/active time, taste, texture, occasion, pairs-with,
  key ingredients, skills, tags — embedded into a Qdrant **profiles** collection
  (`python -m agent.ingest profiles`). Planning retrieves over these to match a goal to
  recipes, then an LLM ranks + explains the top candidates.
- **Full recipe bodies (Baking Mode).** The complete normalized markdown (prose; workflow
  blocks stripped) is loaded straight into the coach's context — no per-question
  retrieval. One recipe fits the window, and coaching benefits from seeing every step.

The structure-aware **recipe-chunk** embeddings described below are **retained for
evaluation and future recipe-level retrieval**, but are not on the live coaching path in
v2.

## How they interact during usage

The agent first attempts to answer from the **local recipe corpus** via RAG. When the
question falls outside the corpus (e.g. "can I swap bread flour for AP flour?"), the
agent calls **Tavily** and grounds the answer in web results, adding a recipe-specific
caveat where relevant. Retrieval and web search are complementary: RAG owns the
"what does *this* recipe say / mean" questions; Tavily owns the open-world "general
baking knowledge" questions.

## Default chunking strategy

**Structure-aware chunking.** Each recipe is split by section — title/metadata,
ingredients, steps, and notes — rather than by fixed size, and every chunk carries the
recipe title and yield as metadata. Long free-text note blobs fall back to ~500-token
recursive character splitting with overlap.

**Why:** recipes are semi-structured; keeping ingredient lists and step sequences
intact means retrieval returns coherent, actionable context (a whole step or the full
ingredient list) instead of a fragment cut mid-instruction, and the attached metadata
lets the retriever filter to the active recipe.

**Hybrid recipe format — what gets embedded vs parsed.** Recipes use a hybrid file
format (YAML frontmatter for tools/routing + a prose body for RAG; see
[`../data/recipes/TEMPLATE.md`](../data/recipes/TEMPLATE.md) and the worked example
[`../data/recipes/japanese-milk-bread.md`](../data/recipes/japanese-milk-bread.md)).
The ingestion pipeline splits the two halves cleanly:

- **Frontmatter** (`scale`, `yield`, `equipment`, `entry_step`, …) is parsed for the
  deterministic tools (`scale()`, `timeline()`) and routing — **not embedded**.
- **Prose body is embedded:** `## Ingredients`, each step's `#### Recipe`, `## Instructor
  Tips`, `## Troubleshooting`, and `## Recipe Summary`.
- **Per-step `#### Workflow` YAML blocks are stripped out of the embedded text** and
  parsed into the step graph (`id` → `next_step` chain + `completion` criteria) that the
  no-RAG workflow engine walks for "what's next?". Embedding those blocks would pollute
  retrieval with low-value YAML — the same reason the earlier pure-YAML recipe drafts
  were poor RAG fodder.
- `TEMPLATE.md` and `README.md` are skipped entirely.

"Hero" recipes carry the per-step `#### Workflow` blocks (guided workflow + `timeline()`);
"lite" recipes omit them and contribute prose + `scale` only. Either way, only the prose
is embedded, so the retrieval baseline is unaffected by the tier.

**Chunking is held constant across the Task 6 experiment.** Structure-aware chunks are
a deliberate production choice, so we do *not* vary chunking between baseline and
improved runs — that would change two things at once. Instead we hold the chunks fixed
and vary only the *retrieval* method (see [`evaluation.md`](evaluation.md)): dense-only
→ hybrid + reranker → one further single-variable change. One variable at a time keeps
the comparison clean.

## Hybrid retrieval — implementation choice (verify Monday AM)

The advanced retriever needs sparse (BM25-style) retrieval alongside dense. This is an
implementation-risk item — the code doesn't exist yet — so it is a short Monday-morning
spike, not a locked assumption. Chosen approach and fallback:

- **Primary:** Qdrant **native dense + sparse named vectors**, fused server-side with
  **RRF via the Query API** (sparse vectors produced by FastEmbed). Single store, one
  query.
- **Fallback (if native sparse misbehaves):** a separate BM25 retriever + Qdrant dense,
  fused client-side with RRF (e.g. LangChain `EnsembleRetriever`).

Resolve which one before writing retrieval code so hybrid is one concrete, verified
implementation rather than a diagram promise.
