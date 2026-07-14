# Bake Me Up — frontend (Next.js)

The web app for the **Bake Me Up** baking companion — the **Choose → Learn → Bake Together**
journey on phone + laptop. Next.js (App Router) + React + Tailwind v4 on Vercel.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (also runs prebuild: syncs data/recipes → content/recipes)
```

The chat proxies to the LangGraph backend via `/api/chat`; set the backend URL / key in
`.env.local` (see the backend README).

## The journey (V0.1)

- **Kitchen** (`app/page.tsx` → `components/Kitchen.tsx`) — conversation-first planner; the AI
  is the protagonist, the collection is supporting content.
- **Recipe Page** (`components/RecipeWorkspace.tsx`) — **Knowledge / "Coach Available."** A
  recipe-first, single-column reference (hero, ingredients, timeline, steps). The coach is
  on-demand: a quiet Ask-Coach entry opens a lightweight chat overlay (bottom-sheet on mobile /
  side panel on desktop), **not** a persistent sidebar.
- **Baking Together** (`components/BakingTogether.tsx`) — **Experience / "Coach Active."** A
  full-screen calm instructor: context greeting → current step → *Ready when* / tip →
  **I'm Ready** → a persistent "Ask me anything" coach. Optimized for confidence, not
  completion (no progress bar / counter / mark-complete).

**One agent, one thread.** `components/SessionProvider.tsx` holds a single `threadId` shared by
every chat surface, so the coach never re-asks what was planned. Session memory is in-memory for
V0.1 (continuous across navigation; a page refresh starts a fresh thread).

## Key pieces

- `components/AssistantPanel.tsx` — the chat panel (streams from `/api/chat`); `fill` / `bare`
  props adapt it for the Baking Together and overlay layouts.
- `lib/recipes.ts` — parses recipe markdown (frontmatter + `#### Workflow` YAML) into structured
  data (ingredients, timeline, steps, checkpoints, tips).
- `components/recipe/*` — presentational recipe pieces (hero, meta cards, ingredients, timeline,
  step card, troubleshooting).
- Design: warm cream/oat/dusty-rose palette (`app/globals.css`), **Newsreader** display serif
  for headings, **Geist** for body (both via `next/font`).

## Deploy

Auto-deploys to Vercel on push to `main` → [bake-me-up.vercel.app](https://bake-me-up.vercel.app).
