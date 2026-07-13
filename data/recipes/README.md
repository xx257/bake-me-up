# Recipe corpus

RAG source data lands here (Day 2). Kept small and personal-first.

- **Personal / instructor-style recipes:** 5–8, manually cleaned (the heart of the corpus).
- **Public recipes:** only 2–3, purely to add retrieval ambiguity.

Candidate set (overlapping terminology on purpose): Japanese milk bread, matcha milk
bread, red bean buns, brioche, tangzhong dinner rolls, butter cookies, matcha cookies.

## How to add a recipe

1. Copy [`TEMPLATE.md`](TEMPLATE.md) → a short slug filename (e.g. `matcha-milk-bread.md`).
2. Transcribe your recipe into clean text/Markdown (no photos/scans — OCR is out of scope).
   Keep the `## Ingredients` / `## Steps` / `## Notes` headings.
3. See [`japanese-milk-bread.md`](japanese-milk-bread.md) for a filled-in example.

`TEMPLATE.md` and `README.md` are **not ingested** (the Day 2 pipeline skips them).

Data sources + chunking strategy: see [`../../docs/03-data.md`](../../docs/03-data.md).
