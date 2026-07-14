---
# Machine-readable fields for tools and routing.
# The Markdown body below remains the human-readable/RAG source.

id: shokupan_yudane
title: Japanese Milk Bread (Shokupan)
aliases:
  - shokupan
  - Japanese milk bread
  - milk bread
  - Hokkaido milk bread

source:
  name: SFBI Japanese Home Baking Course
  type: instructor_recipe

tags:
  - bread
  - milk bread
  - shokupan
  - yudane
  - enriched dough

difficulty:
  level: intermediate
  skills:
    - yudane
    - dough temperature control
    - proofing
    - shaping

yield:
  units: 1 loaf
  pieces_per_loaf: 2
  piece_weight_g: 325
  total_dough_g: 660

equipment:
  pan:
    type: Pullman
    dimensions_mm:
      width: 120
      length: 180
      height: 120
    lid: true

  oven:
    developed_for: convection
    convection:
      temperature_c: 190
      temperature_f: 375
      bake_time_min:
        min: 30
        max: 35

    conventional:
      temperature_c: 205
      temperature_f: 400
      adjustment:
        increase_c: 15
        increase_f: 25
      note: >
        This recipe was developed for a convection oven.
        For a conventional oven, increase the temperature by
        approximately 15°C (25°F).

scale:
  components:
    dough:
      basis: flour_weight
      reference_g: 290
      ingredients:
        - {name: low protein bread flour, aliases: [bread flour, Japanese bread flour, flour], pct: 100.0}
        - {name: instant dry yeast, aliases: [instant yeast, dry yeast, yeast], pct: 1.36}
        - {name: sugar, aliases: [granulated sugar], pct: 8.64}
        - {name: salt, pct: 2.0}
        - {name: butter, aliases: [unsalted butter], pct: 6.5}
        - {name: milk, aliases: [whole milk], pct: 73.0}
        - {name: prepared yudane, aliases: [yudane, milk roux], pct: 36.36, derived_from: yudane}
      nested_formulas:
        yudane:
          basis: yudane_flour_weight
          reference_g: 26
          ingredients:
            - {name: low protein bread flour, pct: 100.0}
            - {name: milk, pct: 300.0}

# Workflow entry point. The ordered step graph is defined by the per-step
# "#### Workflow" blocks in the body (next_step chain); this names the first step
# so the workflow engine has a defined start without relying on document order.
entry_step: make_yudane
---

# Japanese Milk Bread (Shokupan)

A soft Japanese milk bread made using the yudane method. This recipe was adapted from the SFBI Japanese Home Baking Course and keeps the original class wording and instructor guidance as closely as possible.

## Ingredients

### Yudane

- 26 g low protein bread flour
- 79 g milk

### Final Dough

- 290 g low protein bread flour
- 4 g instant dry yeast
- 25 g sugar
- 6 g salt
- 19 g butter
- 211 g milk
- 105 g prepared yudane

## Steps

### Step 1 — Prepare the Yudane

#### Recipe

Warm the milk, then combine it with the flour. Cook over medium heat while stirring continuously until the mixture reaches **80°C (175°F)** and develops a texture similar to **soft mochi**.

Allow the yudane to cool completely before using.

#### Workflow

```yaml
id: make_yudane
duration:
  active_min: 8
  passive_until: completely cool
completion:
  - temperature_c: 80
  - texture: soft mochi-like paste
next_step: mix_initial_dough
```

---

### Step 2 — Mix the Initial Dough

#### Recipe

Hold back the butter and yudane. Mix the remaining ingredients using a dough hook.

Mix for **4 minutes on low speed**, then **4 minutes on medium speed**, until the dough becomes smooth and begins developing gluten.

#### Workflow

```yaml
id: mix_initial_dough
duration:
  active_min: 8
completion:
  - texture: smooth with visible gluten development
next_step: add_yudane
```

---

### Step 3 — Add the Yudane

#### Recipe

Add the cooled yudane and continue mixing on low speed for about **2 minutes**, until it is evenly incorporated.

#### Workflow

```yaml
id: add_yudane
duration:
  active_min: 2
completion:
  - yudane evenly incorporated
next_step: add_butter
```

---

### Step 4 — Add the Butter

#### Recipe

Add the butter and continue mixing on medium speed for **6–8 minutes**.

Check the dough temperature. The target is **28–29°C (82–84°F)**.

The dough should feel smooth, elastic, and extensible.

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
  - texture: smooth, elastic, and extensible
next_step: first_proof
```

---

### Step 5 — First Fermentation

#### Recipe

Bulk ferment at **30°C (86°F)** for approximately **45 minutes**.

Watch the dough rather than relying only on the timer.

#### Workflow

```yaml
id: first_proof
duration:
  passive_min: 45
environment:
  temperature_c: 30
completion:
  - dough visibly expanded and ready to divide
next_step: divide_preshape
```

---

### Step 6 — Divide and Preshape

#### Recipe

Divide the dough into **two 325 g pieces**.

Degas gently and preshape each piece into a round.

#### Workflow

```yaml
id: divide_preshape
duration:
  active_min: 10
completion:
  - pieces: 2
  - target_piece_weight_g: 325
  - shape: round preshape
next_step: bench_rest
```

---

### Step 7 — Bench Rest

#### Recipe

Let the dough rest for **15 minutes** at room temperature.

#### Workflow

```yaml
id: bench_rest
duration:
  passive_min: 15
completion:
  - dough relaxed enough for final shaping
next_step: final_shape
```

---

### Step 8 — Final Shape

#### Recipe

Shape each dough piece into a cylinder while removing large air pockets.

Place the shaped pieces into the prepared pan.

#### Workflow

```yaml
id: final_shape
duration:
  active_min: 10
completion:
  - shape: cylinder
  - large air pockets removed
  - pieces placed in pan
next_step: final_proof
```

---

### Step 9 — Final Proof

#### Recipe

Proof for **40–60 minutes**.

The dough is ready when it reaches **approximately 80% of the height of the pan**.

#### Workflow

```yaml
id: final_proof
duration:
  passive_min:
    min: 40
    max: 60
completion:
  - pan_height_percent: 80
next_step: bake
```

---

### Step 10 — Bake

#### Recipe

Bake at **190°C (375°F)** in a **convection oven** for **30–35 minutes** with the lid on.

If using a **conventional oven**, increase the baking temperature by approximately **15°C (25°F)** to **205°C (400°F)**.

#### Workflow

```yaml
id: bake
duration:
  active_min: 2
  passive_min:
    min: 30
    max: 35
equipment:
  convection:
    temperature_c: 190
    temperature_f: 375
  conventional:
    temperature_c: 205
    temperature_f: 400
completion:
  - loaf fully baked
next_step: cool
```

---

### Step 11 — Cool

#### Recipe

Remove the loaf from the pan shortly after baking.

Allow it to cool completely before slicing.

#### Workflow

```yaml
id: cool
duration:
  passive_until: completely cool
completion:
  - loaf completely cool before slicing
next_step: null
```

## Instructor Tips

- Watch the dough, not just the timer.
- Dough temperature is more important than exact mixing time.
- Medium heat provides better control when making the yudane.
- A properly cooked yudane should resemble soft mochi.
- Cool the loaf completely before slicing.

## Troubleshooting

### Why is my dough sticky?

This is a relatively high-hydration enriched dough, so some stickiness is expected. Resist adding extra flour unless the dough is truly unmanageable. Focus instead on gluten development and dough temperature.

**Related topics:** hydration, gluten development, mixing, dough temperature

### How do I know if I have mixed enough?

Use the dough temperature and texture as the main indicators. The dough should reach **28–29°C (82–84°F)** and feel smooth, elastic, and extensible.

**Related topics:** mixing, dough temperature, gluten development

### How do I know when the final proof is finished?

The final proof is complete when the dough reaches approximately **80% of the pan height**. The clock is only a guide.

**Related topics:** proofing, pan height, fermentation

### What should the yudane look like?

The yudane should become a smooth, thick paste with a texture similar to soft mochi. It should reach **80°C (175°F)** before being removed from the heat.

**Related topics:** yudane, texture, temperature

## Equipment Notes

This recipe was developed using a convection oven.

A conventional oven does not circulate hot air as efficiently, so increase the baking temperature by approximately **25°F (15°C)**.

Always use the appearance and doneness of the loaf as the final guide rather than relying only on the timer.

## Recipe Summary

- Yield: 1 loaf
- Dough pieces: 2 × 325 g
- Target dough temperature: 28–29°C (82–84°F)
- First proof: approximately 45 minutes at 30°C (86°F)
- Bench rest: 15 minutes
- Final proof: 40–60 minutes, until 80% of pan height
- Bake: 190°C (375°F) convection or 205°C (400°F) conventional
- Bake time: 30–35 minutes
- Cool completely before slicing
