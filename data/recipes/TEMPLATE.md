<!--
  RECIPE TEMPLATE — copy this file, rename to a short slug (e.g. matcha-milk-bread.md),
  and fill it in. One recipe per file. Not ingested itself (the Day 2 pipeline skips
  TEMPLATE.md and README.md).

  Why the structure matters:
  - The "## Ingredients", "## Steps", "## Notes" headings are what structure-aware
    chunking splits on — keep them.
  - Quantities as metric weights (g / ml) when possible → clean input for scale().
  - Step durations and wait/proof times in the (Timing) lines → input for timeline().
  - "## Notes" is where the tacit, experience-based knowledge goes — this is the whole
    point of the product, so be generous here.
  Delete these comments in your real recipes if you like (optional).
-->

# <Recipe Name>

- **Yield:** <e.g. 1 loaf (12 slices) / 24 cookies>
- **Active time:** <e.g. 40 min>
- **Total time:** <e.g. 4 hr including proofing>
- **Source:** <e.g. Grandma's handwritten note / instructor handout / your own>

## Ingredients

<!-- Prefer metric weights. Group with sub-headers if the recipe has components. -->
- <qty + unit> <ingredient>   e.g. 250g bread flour
- ...

## Steps

<!-- Number the steps. Add a "(Timing: ...)" line under any step that takes real time
     or has a hands-off wait — this feeds the timeline tool. -->
1. <step description>
   (Timing: <active min> active)
2. <step with a wait>
   (Timing: <active min> active, then <wait min> hands-off — e.g. proof until doubled)
3. ...

## Notes

<!-- The experience-based knowledge the original recipe usually leaves out. -->
- <what the dough/batter should look or feel like>
- <common mistakes / how to tell when a step is done>
- <substitutions, equipment tips, doneness cues, storage>
