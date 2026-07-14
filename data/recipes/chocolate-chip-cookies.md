---
# Machine-readable fields for tools and routing.
# The Markdown body below remains the human-readable/RAG source.
# LITE recipe: no per-step #### Workflow blocks, no entry_step (RAG + scale only).

id: chocolate_chip_cookies
title: Chocolate Chip Cookies
est_time_min: 40
# Recommendation profile (Planning Mode: embedded in Qdrant for retrieval).
profile:
  active_time_min: 20
  taste: [sweet, chocolate, buttery]
  texture: [chewy, crisp edges]
  occasion: [snack, dessert, quick, entertaining]
  pairs_with: [milk, coffee]
aliases:
  - chocolate chip cookies
  - choc chip cookies
  - cookies
  - Toll House cookies

source:
  name: adapted from the classic American drop cookie
  type: reference

tags:
  - cookies
  - chocolate chip
  - dessert
  - drop cookies

difficulty:
  level: beginner
  skills:
    - creaming butter and sugar
    - drop cookies

yield:
  units: about 24 cookies
  piece_weight_g: 47
  total_dough_g: 1127

equipment:
  oven:
    developed_for: conventional
    conventional: {temperature_c: 190, temperature_f: 375}
    convection: {temperature_c: 175, temperature_f: 350}

scale:
  components:
    dough:
      basis: flour_weight
      reference_g: 225
      ingredients:
        - {name: all-purpose flour, aliases: [plain flour, flour], pct: 100.0}
        - {name: baking soda, aliases: [bicarbonate of soda], pct: 2.2}
        - {name: salt, aliases: [fine salt], pct: 1.8}
        - {name: butter, aliases: [unsalted butter], pct: 75.6}
        - {name: granulated sugar, aliases: [white sugar, sugar], pct: 66.7}
        - {name: brown sugar, aliases: [light brown sugar, packed brown sugar], pct: 73.3}
        - {name: eggs, pct: 44.4}
        - {name: vanilla extract, aliases: [vanilla], pct: 3.6}
        - {name: chocolate chips, aliases: [semisweet chocolate chips, chocolate], pct: 133.3}
---

# Chocolate Chip Cookies

A classic drop cookie with crisp golden edges and a soft, chewy center. Makes about 24 cookies.

## Ingredients

- 225 g all-purpose flour
- 5 g baking soda
- 4 g fine salt
- 170 g unsalted butter, softened
- 150 g granulated sugar
- 165 g light brown sugar, packed
- 100 g eggs (about 2 large)
- 8 g vanilla extract
- 300 g semisweet chocolate chips

**Total dough:** approximately 1,127 g

## Steps

### Step 1 — Cream the Butter and Sugars

#### Recipe

Beat the softened butter, granulated sugar, and brown sugar on medium speed for **2–3 minutes**, until pale and fluffy. Use butter that is soft but not melted — melted butter makes flatter, denser cookies.

### Step 2 — Add the Eggs and Vanilla

#### Recipe

Beat in the eggs one at a time, then the vanilla, mixing until smooth.

### Step 3 — Combine the Dry Ingredients

#### Recipe

In a separate bowl, whisk the flour, baking soda, and salt. Add to the wet mixture and mix on low speed **just until no dry streaks remain** — do not overmix.

### Step 4 — Fold in the Chocolate

#### Recipe

Fold in the chocolate chips by hand.

### Step 5 — Portion the Dough

#### Recipe

Scoop **~47 g mounds** onto parchment-lined trays, spaced about **5 cm (2 in)** apart. For thicker, chewier cookies, chill the dough for **30 minutes to 24 hours** before baking.

### Step 6 — Bake

#### Recipe

Bake at **190°C (375°F)** for **9–11 minutes**, until the edges are golden but the centers still look slightly underdone. (Convection: about **175°C / 350°F**; check a minute early.)

### Step 7 — Cool

#### Recipe

Let the cookies set on the tray for **5 minutes**, then transfer to a rack. They finish cooking from residual heat.

## Instructor Tips

- Pull the cookies when the centers still look underbaked — carryover heat sets them into a chewy middle.
- Chilling the dough deepens flavor and limits spread.
- Room-temperature (not melted) butter creams properly and gives lift; melted butter spreads flat.
- Weigh the flour — scooping packs in extra flour and makes cakey, dry cookies.

## Troubleshooting

### Why did my cookies spread too thin?

The butter was too warm or melted, or the dough wasn't chilled. Chill the dough for 30+ minutes and bake on a cool tray (not a hot one straight from the last batch).

**Related topics:** spread, butter temperature, chilling

### Why are my cookies dry or cakey?

Usually too much flour (measure by weight, not by scooping) or overbaking. Pull them at 9–11 minutes when the centers still look soft.

**Related topics:** flour, measuring, bake time

### How do I make the centers chewier?

Slightly underbake them and lean on brown sugar — its moisture and molasses keep cookies soft. Chilling the dough also helps.

**Related topics:** texture, brown sugar, bake time

## Recipe Summary

- Yield: about 24 cookies (~47 g each)
- Bake: 190°C (375°F) for 9–11 minutes
- Optional: chill the dough 30 min+ for thicker cookies
- Pull when edges are golden and centers look underdone
- Cool 5 minutes on the tray before moving to a rack
