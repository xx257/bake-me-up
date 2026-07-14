# Recipe corpus

RAG source data lands here (Day 2). Kept small and personal-first.

- **Personal / instructor-style recipes:** 5–8, manually cleaned (the heart of the corpus).
- **Public recipes:** only 2–3, purely to add retrieval ambiguity.

Candidate set (overlapping terminology on purpose): Japanese milk bread, matcha milk
bread, red bean buns, brioche, tangzhong dinner rolls, butter cookies, matcha cookies.

## Format (hybrid: prose for RAG + YAML for tools)

Each recipe is one Markdown file: **YAML frontmatter** (read by `scale()`/`timeline()`
and routing) plus a **prose body** (`## Ingredients` → `## Steps` → `## Instructor Tips`
→ `## Troubleshooting` → `## Recipe Summary`) that RAG retrieves.

Two tiers:

- **Lite** (most recipes) — frontmatter (`scale` + `yield`) + prose body. Gives RAG Q&A
  and scaling.
- **Hero** (1–2, for the guided-baking demo) — additionally, each step carries a
  `#### Workflow` YAML block (`id` → `next_step` chain + `completion` criteria). These
  drive the **deterministic "what's next?" workflow engine and `timeline()` — without
  RAG**. The `#### Workflow` blocks are parsed into the step graph, **not embedded**.

## How to add a recipe

1. Copy [`TEMPLATE.md`](TEMPLATE.md) → a short slug filename (e.g. `matcha-milk-bread.md`).
2. Transcribe your recipe into clean text/Markdown (no photos/scans — OCR is out of scope).
   Keep the `##` headings — chunking splits on them. Put temps/doneness cues inline in the
   `#### Recipe` prose.
3. For a **lite** recipe, delete every `#### Workflow` block and the frontmatter
   `entry_step`. For a **hero** recipe, keep them.
4. See [`japanese-milk-bread.md`](japanese-milk-bread.md) for a filled-in hero example.

`TEMPLATE.md` and `README.md` are **not ingested** (the Day 2 pipeline skips them), and
neither are the frontmatter or the `#### Workflow` blocks — only the prose body is
embedded.

Data sources + chunking strategy: see [`../../docs/03-data.md`](../../docs/03-data.md).
