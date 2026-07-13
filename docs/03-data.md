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
