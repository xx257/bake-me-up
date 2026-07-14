---
# ── Machine fields (tools/routing read these; NOT embedded for RAG) ──
title: <Recipe Name>
source: <instructor / family / your own>
tags: [<bread>, <milk bread>, <cookies>, ...]
aliases: [<other names people search for this by>]   # helps routing match the recipe

yield:
  units: <e.g. 1 loaf (2 x 325 g pieces) / 24 cookies>
  total_dough_g: <optional; the mass you MIX — note this differs from pieces × piece_weight>

# Optional: only if the recipe is oven-baked and temp/adjustment matter.
equipment:
  oven:
    developed_for: <convection | conventional>
    convection:   {temperature_c: 190, temperature_f: 375}
    conventional: {temperature_c: 205, temperature_f: 400}

# scale() — baker's percentages under a named-component map (ONE shape for every recipe,
# whether it has a single formula or several). Each component names its 100% basis and
# anchors it with reference_g (grams of that basis ingredient), so any target size is exact.
# pct = baker % of that component's basis (the basis ingredient itself = 100).
# Most recipes have a single component (e.g. `dough`); multi-part recipes list one
# component each (e.g. `cake_base` + `cream`), every one with its own basis/reference_g.
scale:
  components:
    dough:                       # component name: dough / cake_base / cream / batter ...
      basis: flour_weight        # what 100% refers to: flour_weight / egg_weight / ...
      reference_g: <e.g. 290>    # grams of the 100% basis ingredient
      ingredients:
        - {name: bread flour, aliases: [flour, Japanese bread flour], pct: 100}
        - {name: yeast, aliases: [instant dry yeast], pct: 1.36}
        - {name: sugar, pct: 8.64}
        - {name: salt, pct: 2.0}
        - {name: butter, pct: 6.5}
        - {name: milk, pct: 73}
      # nested_formulas:         # optional preferment scaled from its own ratio (e.g. yudane)
      #   yudane: {basis: yudane_flour_weight, reference_g: 26,
      #            ingredients: [{name: flour, pct: 100}, {name: milk, pct: 300}]}
  # assembly:                    # optional per-piece ratios for filled/portioned items
  #   dough_per_piece_g: 50
  #   filling_per_piece_g: 50

# entry_step — HERO recipes only. Names the first step id so the workflow engine has a
# defined start. The rest of the step order comes from the per-step `next_step` chain.
# Omit for LITE recipes (no #### Workflow blocks).
entry_step: <first_step_id>
---

<!--
  RECIPE TEMPLATE — hybrid format (prose body for RAG + YAML for deterministic tools).
  Copy this file, rename to a short slug (e.g. matcha-milk-bread.md), fill it in.

  TWO TIERS — pick one per recipe:
    • LITE (most recipes): frontmatter (scale + yield) + prose body only.
      DELETE every "#### Workflow" block and the frontmatter `entry_step`.
      Gives you RAG Q&A + scale(); no step-by-step guided workflow.
    • HERO (1–2 recipes for the guided-baking demo): keep the "#### Workflow" blocks.
      Each step's block (id → next_step chain + completion) drives the deterministic
      "what's next?" workflow engine and timeline() — WITHOUT RAG.

  INGESTION (Day 2): embeds ONLY the prose (Ingredients, each step's "#### Recipe",
  Instructor Tips, Troubleshooting, Recipe Summary). It SKIPS the frontmatter and the
  "#### Workflow" YAML blocks (those are parsed into the step graph, not embedded).
  TEMPLATE.md and README.md are not ingested at all.

  AUTHORING: keep the ## headings — chunking splits on them. Put temps and doneness cues
  INLINE in the "#### Recipe" prose (don't hide them only in metadata) so RAG can retrieve
  them. Delete these comments in real recipes if you like.
-->

# <Recipe Name>

<One-line summary: yield, source, and what makes it special.>

## Ingredients

<!-- Human-readable, metric weights. This is what RAG retrieves for "how much X?" -->
### <Yudane / preferment, if any>
- <26 g bread flour>
- <79 g milk>

### <Final Dough>
- <290 g bread flour>
- <4 g instant dry yeast>
- ...

## Steps

### Step 1 — <Short title>

#### Recipe

<Natural-language instruction. Put doneness cues and temps INLINE so questions like
"what temp do I bake at?" retrieve. e.g. "Cook over medium heat to 80°C (175°F) until it
looks like soft mochi, then cool completely.">

#### Workflow
<!-- HERO recipes only — DELETE this whole block for LITE recipes. -->

```yaml
id: <step_1_id>            # must match entry_step for the first step
duration:
  active_min: <hands-on minutes>
  passive_min: <hands-off minutes>        # or: passive_until: completely cool
completion:                                # doneness criteria surfaced by the engine
  - temperature_c: <target>
  - texture: <what "done" looks like>
next_step: <step_2_id>     # the next step's id; use `null` on the final step
```

---

### Step 2 — <Short title>

#### Recipe

<...>

#### Workflow

```yaml
id: <step_2_id>
duration: {active_min: <n>}
completion:
  - <criterion>
next_step: <step_3_id>
```

<!-- ...repeat per step; the last step's Workflow block ends with `next_step: null`. -->

## Instructor Tips

<!-- The tacit, experience-based knowledge — the whole point of the product. -->
- <Watch the dough, not the timer — dough temperature matters more than mix time.>
- <High-hydration enriched dough is meant to be tacky; resist adding flour.>

## Troubleshooting

<!-- Q + a REAL answer + related-topic tags. This is prime RAG material. -->
### <Why is my dough sticky?>

<A full answer, not just a pointer.>

**Related topics:** <hydration, gluten development, dough temperature>

## Recipe Summary

<!-- Quick at-a-glance recap; also good RAG fodder for summary-style questions. -->
- Yield: <...>
- Target dough temperature: <...>
- Bake: <...>
- Cool completely before slicing.
