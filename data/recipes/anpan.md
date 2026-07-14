---
id: anpan_kashipan_v1
title: Anpan with Kashipan Sweet Bread Dough
est_time_min: 120
# Recommendation profile (Planning Mode: embedded in Qdrant for retrieval).
profile:
  active_time_min: 70
  taste: [sweet, red bean]
  texture: [soft, fluffy]
  occasion: [snack, afternoon tea, breakfast]
  pairs_with: [green tea, coffee, milk]
aliases: [anpan, red bean bun, Japanese sweet bread]
source:
  name: SFBI 2 Day Japanese Home Baking Course
  type: instructor_recipe
tags: [bread, sweet bread, kashipan, anpan, red bean]

yield:
  units: 24 buns
  piece_dough_g: 50
  filling_per_piece_g: 50
  total_dough_g: 1200

difficulty:
  level: intermediate
  skills: [enriched dough, dough temperature, proofing, filled bun shaping]

scale:
  components:
    dough:
      basis: total_flour_weight
      reference_g: 613
      ingredients:
        - {name: low protein bread flour, aliases: [bread flour, flour], pct: 90.0}
        - {name: cake flour, pct: 10.0}
        - {name: instant dry yeast, aliases: [instant yeast, dry yeast, yeast], pct: 2.0}
        - {name: sugar, aliases: [granulated sugar], pct: 12.0}
        - {name: salt, pct: 1.5}
        - {name: dry milk solids, aliases: [milk powder, dry milk], pct: 3.0}
        - {name: eggs, pct: 15.0}
        - {name: water, pct: 50.0}
        - {name: butter, aliases: [unsalted butter], pct: 12.0}
  assembly:
    dough_per_piece_g: 50
    red_bean_paste_per_piece_g: 50

# Workflow entry point (hero recipe). Step order comes from the per-step
# `#### Workflow` next_step chain below; this names the first step.
entry_step: mix_initial_dough
---

# Anpan with Kashipan Sweet Bread Dough

Anpan made from the course's Kashipan sweet bread dough, filled with red bean paste. The complete base dough is included here so this recipe can be used independently.

## Ingredients

### Kashipan Dough — 1 Batch

- 552 g low protein bread flour
- 61 g cake flour
- 12 g instant dry yeast
- 74 g sugar
- 9 g salt
- 18 g dry milk solids
- 92 g eggs
- 307 g water
- 74 g butter

**Total dough:** approximately 1,200 g

### Anpan Assembly — Per Bun

- 50 g Kashipan dough
- 50 g red bean paste
- Egg wash, as needed

**Instructor note:** The red bean paste is made from sugar, water, and red beans.

## Steps

### Step 1 — Mix the Initial Kashipan Dough

#### Recipe

Hold back the butter.

Mix the remaining ingredients in a mixing bowl with a hook attachment.

Mix on low speed for **4 minutes**, then on medium speed for **6 minutes**. The dough should have a smooth and elastic consistency.

#### Workflow

```yaml
id: mix_initial_dough
duration:
  active_min: 10
completion:
  - texture: smooth and elastic
next_step: add_butter
```

### Step 2 — Add the Butter

#### Recipe

Add the butter and mix on medium speed for **6–8 minutes**.

Check the dough temperature. If the temperature is less than **28°C (82°F)**, mix on high speed for a few minutes until the dough reaches the desired temperature of **28–29°C (82–84°F)**.

#### Workflow

```yaml
id: add_butter
duration:
  active_min:
    min: 6
    max: 8
completion:
  - dough_temperature_c:
      min: 28
      max: 29
  - texture: smooth and elastic
next_step: first_proof
```

### Step 3 — First Fermentation

#### Recipe

Ferment the dough in a warm place at **30°C (86°F)** for **30 minutes**.

#### Workflow

```yaml
id: first_proof
duration:
  passive_min: 30
environment:
  temperature_c: 30
next_step: divide_preshape
```

### Step 4 — Divide and Preshape

#### Recipe

Divide the Kashipan dough into **50 g pieces**, and preshape into rounds.

#### Workflow

```yaml
id: divide_preshape
completion:
  - target_piece_weight_g: 50
  - shape: round preshape
next_step: bench_rest
```

### Step 5 — Bench Rest

#### Recipe

Cover the dough and rest for **20 minutes**.

#### Workflow

```yaml
id: bench_rest
duration:
  passive_min: 20
next_step: prepare_filling
```

### Step 6 — Prepare the Red Bean Filling

#### Recipe

While the dough is resting, divide the red bean paste into **50 g portions** and round.

#### Workflow

```yaml
id: prepare_filling
completion:
  - filling_piece_weight_g: 50
  - shape: round
next_step: fill_shape
```

### Step 7 — Fill and Shape

#### Recipe

For final shaping, flatten the dough to about **3 inches in diameter**, place the red bean paste on top, and enrobe.

Place the shaped bun on a tray and flatten slightly.

#### Workflow

```yaml
id: fill_shape
completion:
  - dough_diameter_in: 3
  - filling fully enclosed
  - bun flattened slightly
next_step: final_proof
```

### Step 8 — Final Proof

#### Recipe

Proof at **35°C (95°F)** for **30 minutes**.

#### Workflow

```yaml
id: final_proof
duration:
  passive_min: 30
environment:
  temperature_c: 35
next_step: egg_wash_bake
```

### Step 9 — Egg Wash and Bake

#### Recipe

Egg wash and bake at **190°C (375°F)** for **10–12 minutes**.

#### Workflow

```yaml
id: egg_wash_bake
duration:
  active_min: 3
  passive_min:
    min: 10
    max: 12
oven:
  temperature_c: 190
  temperature_f: 375
next_step: null
```

## Instructor Tips

- Aim for a final dough temperature of **28–29°C (82–84°F)**.
- Portion both the dough and red bean paste to **50 g each** for even buns.
- Keep the dough covered during the bench rest so the surface does not dry out.

## Recipe Summary

- Base dough: Kashipan sweet bread dough
- Batch dough weight: approximately 1,200 g
- Yield: approximately 24 buns
- Per bun: 50 g dough + 50 g red bean paste
- First fermentation: 30 minutes at 30°C (86°F)
- Bench rest: 20 minutes
- Final proof: 30 minutes at 35°C (95°F)
- Bake: 190°C (375°F) for 10–12 minutes
