# Evaluation (Tasks 4, 5, 6)

## Philosophy — evaluate retrieval where it actually matters

Bake Me Up's primary experience is **select a recipe → full recipe in context → Coach Mode**.
Coaching does **not** use retrieval: one recipe fits comfortably in the context window, so the
coach reasons over the whole thing. Retrieval matters *before* a recipe is known —
**discovery**, **recipe identification**, and **grounded knowledge lookup**. The evaluation
therefore targets identification + lookup, not active coaching.

All eval code is isolated under `backend/eval/` and never runs in production. Reproduce with:

```bash
uv run --project backend --group eval python backend/eval/build_collections.py   # (re)build eval collections
uv run --project backend --group eval python backend/eval/run_eval.py            # retrieval subset (Task 6)
uv run --project backend --group eval python backend/eval/run_behavior.py        # behavior subset (Task 5)
```

---

## Task 4 — End-to-end Agentic RAG prototype (built)

The full app is live: a Next.js frontend on Vercel (<https://bake-me-up.vercel.app>) →
`/api/chat` proxy → a Python **LangGraph** agent on LangGraph Platform → Qdrant (vectors) +
OpenAI via the Vercel AI Gateway (chat) + Tavily (web fallback), with LangSmith tracing.
The agent routes each turn to one of three lanes — **discover** (intent → profile retrieval →
rank), **coach** (full-recipe grounded Q&A), **redirect** (off-topic guard) — with
`search_collection` and `search_baking_web` as its tools.

---

## Task 5 — Test dataset + evaluation harness

**Dataset** (`backend/eval/testset.jsonl`, 14 hand-written cases grounded in the 6-recipe
corpus), split into two subsets scored **separately**:

- **retrieval subset (10)** — deliberately balanced beyond keyword matching:
  **identification (4)** (yudane / water bath / coconut / medium-peak meringue),
  **concept (2)** (“softest bread texture”, “most time-consuming” — no literal keyword),
  **grounded lookup (1)** (when butter is added), and **cross-section reasoning (3)** (full proof
  timeline; all of Anpan’s resting/proofing stages; every temperature checkpoint in the cheesecake
  — answers that span multiple recipe sections). Each row carries `expected_recipe_ids` (a **list**
  — some questions have several valid sources) and a reference answer. This mix is what lets the
  experiment test *“does full-recipe context help once the recipe is found?”*, not just *“is the
  right recipe found?”*
- **behavior subset (4)** — routing/tool behavior, run through the **production graph** (below).

**Harness** — RAGAS for RAG metrics, plus a locked correctness judge:

- `recipe_id_hit@3` (**primary**) — did any `expected_recipe_id` appear in the retrieved
  recipe ids? Deterministic, no LLM.
- `answer_correctness` — LLM judge vs the reference answer, **score 1–5**; we report **mean**
  and **pass rate at ≥4**. The judge prompt and model are **frozen and identical for every
  configuration**.
- `faithfulness`, `answer_relevancy` — RAGAS (`ragas==0.2.15`).
- `average_context_tokens` and `latency` — the parent-child tradeoff.

---

## Task 6 — Advanced retriever: parent-child

**Why parent-child.** It is already the product's own pattern — retrieve small child chunks to
*identify* the source recipe, then hand the model the **full recipe** to *answer* from. Child
chunks are precise for source identification; the full parent gives the generator complete,
non-fragmented context. This should improve answer correctness/completeness without changing
which recipe is found.

**Design — two physical collections, three configs.** Rebuilt from the current 6-recipe corpus:
`bake_me_up_recipes_eval_150` (150-token children) and `…_eval_250` (250-token children).

| config | search collection | answer context |
|---|---|---|
| **fixed-150** (baseline) | `eval_150` | raw child chunks |
| **parent-child-150** | **same `eval_150`** | dedup full recipe bodies (≤3) |
| **parent-child-250** | `eval_250` | dedup full recipe bodies (≤3) |

fixed-150 and parent-child-150 **search the same collection**, so their child hits are identical
*by construction* — we retrieve once per question and share the hits, and assert row-by-row
identity. Only the generation context differs. parent-child-150 → 250 isolates the child-size
variable.

### Results (retrieval subset, n = 10)

| config | recipe_id_hit@3 | correctness (mean / pass@≥4) | faithfulness | answer_relevancy | avg_context_tokens | median latency |
|---|---|---|---|---|---|---|
| **fixed-150** | 0.90 | 3.8 / 0.70 | 0.84 | 0.61 | **418** | 1.6 s |
| **parent-child-150** | 0.90 | **4.4 / 0.80** | 0.88 | **0.74** | 1294 | 1.6 s |
| **parent-child-250** | **1.00** | **4.7 / 0.90** | 0.92 | 0.69 | 1760 | 1.4 s |

Row-by-row identity check (fixed-150 vs parent-child-150 child hits): **IDENTICAL ✅**.

### Pre-registered expectations vs. outcomes

**Comparison A — fixed-150 vs parent-child-150** (identical child hits, only the answer context
differs):
- `recipe_id_hit@3` **identical (0.90)** ✅ by construction — this comparison is purely about
  *generation context*.
- Full-recipe context **clearly improves answer quality**: correctness **3.8 → 4.4**, pass@≥4
  **0.70 → 0.80**, answer_relevancy **0.61 → 0.74**. The cross-section questions (proof timeline,
  temperature checkpoints) are where fragments fall short and the full recipe wins.
- Sharpest single case — *“when is the butter added?”*: fixed-150 answered it **wrong** from an
  out-of-context 150-token fragment (correctness **1**); parent-child got it right (**5**).

**Honest limits surfaced:**
- hit@3 is **0.90, not 1.0** — the concept query *“which recipe is most time-consuming?”* retrieved
  cake/mochi chunks instead of the breads, so **both** fixed-150 and parent-child-150 then answered
  it wrong (correctness 1). **When retrieval misses, parent-child can’t rescue it** — retrieval and
  generation are independent stages.

**Comparison B — parent-child-150 vs parent-child-250** (child-size variable): child size *did*
matter here — 250-token children caught the “most time-consuming” query (`hit@3` **0.90 → 1.00**)
and lifted correctness **4.4 → 4.7**, **but** cost more tokens (1294 → 1760) and slightly *diluted*
answer_relevancy (0.74 → 0.69). A real, nuanced tradeoff — not a free win.

**Cost:** context tokens **418 → 1294 → 1760**; median latency stays ~1.4–1.6 s across configs
(comparable — the token count, not wall-clock, is the reliable cost signal).

**Takeaway (honest):** with a keyword-light, cross-section-heavy test set, parent-child’s value
shows clearly — **+0.6 correctness and +0.13 answer_relevancy over the baseline for the *same*
retrieval** — because full-recipe context answers multi-section questions that fragments can’t. It
**cannot** fix a *retrieval* miss (both configs fail the one concept query that retrieves the wrong
recipe). Larger 250-token children recover that miss and nudge correctness up, but at ~35% more
tokens and slightly diluted relevancy. So **parent-child-150 is the balanced choice**; 250 is the
option when identification recall matters more than token cost.

---

## Behavior subset — routing through the production graph (Task 5)

Each case runs through the real `agent.graph.graph` with explicit thread state (read-only; the
graph is never modified). **3 / 4 routed as designed:**

| case | expectation | outcome |
|---|---|---|
| collection request (“something fluffy, not too sweet”) | discover → `search_collection` | ✅ |
| standalone knowledge (“why does yudane make bread softer?”) | web fallback | ✅ `search_baking_web` |
| off-topic (“what’s the weather?”) | redirect, no answer | ✅ |
| pinned-recipe gap (“sodium per slice?”, recipe pinned) | recipe-first + Tavily fallback | ⚠️ answered from the recipe’s 6 g salt + parametric knowledge; **did not** invoke Tavily |

The pinned-recipe **fallback is available but model-discretionary**: for the nutrition question
the model computed an answer from the recipe’s salt amount plus general knowledge instead of
searching. Surfaced honestly (not patched) — it flags where the web-fallback trigger could be
tightened, and connects to the planned web-recipe-discovery direction.

---

## Trace review (LangSmith)

A representative discovery turn (`search_collection`) traces as one shallow graph run:

```
user "I want something fluffy and not too sweet"
  └─ route (gpt-4o-mini)            → mode = discover
  └─ discover
       ├─ extract intent            → {texture: fluffy, taste: not sweet}
       ├─ retrieve_profiles (Qdrant)→ 3 candidates + cosine _score  [retriever span]
       └─ rank (gpt-4o)             → 1–2 recommendation cards + "search_collection" tool card
```

The retriever span shows the exact query, candidates, and scores; the `tool` payload is what the
UI renders as the “Searched your collection” card. Production traces land in the LangSmith
project `bake-me-up-v0`; local eval runs in `bake-me-up-dev`.

---

## Deterministic tools — out of scope (first pass)

`scale()` / `timeline()` are future tools (rows 7–9 of `01-problem.md §1.4`); they are not part
of the knowledge-and-coaching flow evaluated here and would be checked with plain unit tests
(ratio-correct amounts; schedule ordering), not RAGAS.
