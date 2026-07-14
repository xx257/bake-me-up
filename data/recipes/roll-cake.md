---
id: roll_cake_v1
title: Japanese Roll Cake
est_time_min: 60
aliases: [roll cake, Japanese roll cake, sponge roll]
source:
  name: SFBI 2 Day Japanese Home Baking Course
  type: instructor_recipe
tags: [cake, roll cake, sponge cake, whipped cream, meringue]
difficulty:
  level: intermediate
  skills: [meringue, folding, rolling]

yield:
  units: 1 cake
  cake_base_weight_g: 279
  cream_weight_g: 217

equipment:
  pan:
    one_cake: quarter sheet pan (13 x 9 in)
    two_cakes: half sheet pan (18 x 13 in)
    preparation: line the bottom with paper

scale:
  components:
    cake_base:
      basis: egg_weight
      reference_g: 150
      ingredients:
        - {name: eggs, pct: 100.0}
        - {name: honey, pct: 8.0}
        - {name: sugar 1, aliases: [sugar for yolks], pct: 8.0}
        - {name: sugar 2, aliases: [sugar for meringue], pct: 30.0}
        - {name: cake flour, aliases: [sifted cake flour], pct: 30.0}
        - {name: butter, aliases: [unsalted butter], pct: 10.0}
    cream:
      basis: heavy_cream_weight
      reference_g: 200
      ingredients:
        - {name: heavy cream, aliases: [whipping cream], pct: 100.0}
        - {name: sugar, pct: 8.0}
        - {name: vanilla extract, aliases: [vanilla], pct: 0.5, optional: true}

# Workflow entry point (hero recipe). Step order comes from the per-step
# `#### Workflow` next_step chain below; this names the first step.
entry_step: temper_ingredients
---

# Japanese Roll Cake

A light sponge roll made with separated eggs, a medium-peak meringue, and lightly sweetened whipped cream. This file includes both the cake base and cream filling.

## Ingredients

### Cake Base — 1 Cake

- 150 g eggs
- 12 g honey
- 12 g sugar 1
- 45 g sugar 2
- 45 g cake flour, sifted
- 15 g butter

**Total:** 279 g

### Cream Filling — 1 Cake

- 200 g heavy cream
- 16 g sugar
- 1 g vanilla extract, optional

**Total:** 217 g

## Steps

### Step 1 — Bring Ingredients to Room Temperature

#### Recipe

Leave all ingredients at room temperature.

#### Workflow

```yaml
id: temper_ingredients
completion:
  - ingredients at room temperature
next_step: prepare_pan
```

### Step 2 — Prepare the Pan

#### Recipe

Prepare the baking pan: line with paper at the bottom.

Use a **quarter sheet pan (13 × 9 inches)** for one cake or a **half sheet pan (18 × 13 inches)** for two cakes.

#### Workflow

```yaml
id: prepare_pan
completion:
  - pan lined with paper at bottom
next_step: separate_eggs
```

### Step 3 — Separate the Eggs

#### Recipe

Separate the egg whites and yolks.

#### Workflow

```yaml
id: separate_eggs
completion:
  - whites and yolks separated cleanly
next_step: yolk_mixture
```

### Step 4 — Make the Yolk Mixture

#### Recipe

Combine the egg yolks, honey, and sugar 1 together, and whisk by hand until lightened in color.

#### Workflow

```yaml
id: yolk_mixture
completion:
  - mixture lightened in color
next_step: meringue
```

### Step 5 — Make the Meringue

#### Recipe

Whip the egg whites and sugar 2 to **medium peak**.

#### Workflow

```yaml
id: meringue
completion:
  - meringue at medium peak
next_step: fold_meringue
```

### Step 6 — Fold the Meringue

#### Recipe

Fold the meringue into the yolk mixture in stages.

#### Workflow

```yaml
id: fold_meringue
completion:
  - meringue incorporated in stages
next_step: fold_flour
```

### Step 7 — Fold in the Flour

#### Recipe

Fold in the flour.

#### Workflow

```yaml
id: fold_flour
completion:
  - sifted flour fully incorporated without deflating batter
next_step: add_butter
```

### Step 8 — Add the Butter

#### Recipe

Melt the butter. Create a liaison with a small portion of the batter and fold it back into the remaining batter.

#### Workflow

```yaml
id: add_butter
completion:
  - butter tempered with a small portion of batter
  - butter mixture evenly folded into remaining batter
next_step: pan_batter
```

### Step 9 — Fill the Pan

#### Recipe

Pour the batter into the prepared pan and level the top.

#### Workflow

```yaml
id: pan_batter
completion:
  - batter evenly spread
  - top level
next_step: bake
```

### Step 10 — Bake

#### Recipe

Bake at **170°C (350°F)** for **11–13 minutes**.

#### Workflow

```yaml
id: bake
duration:
  passive_min:
    min: 11
    max: 13
oven:
  temperature_c: 170
  temperature_f: 350
next_step: make_cream
```

### Step 11 — Make the Cream

#### Recipe

Whip the heavy cream, sugar, and vanilla extract (if used) to a **medium-stiff peak**.

Use immediately.

#### Workflow

```yaml
id: make_cream
completion:
  - cream at medium-stiff peak
next_step: assemble
```

### Step 12 — Fill and Roll

#### Recipe

Spread the cream over the cooled cake base and roll the cake.

If adding a flavor to the cream, add it halfway through whipping. Keep the cream slightly soft, then finish whisking by hand.

If using fruit, lay the fruit in the middle before rolling.

#### Workflow

```yaml
id: assemble
completion:
  - cream spread over cake
  - optional fruit placed in center
  - cake rolled without cracking
next_step: null
```

## Instructor Tips

- A handwritten note recommends cutting the cake with a knife and cutting the paper separately rather than pulling it away forcefully.
- Add cream flavoring halfway through whipping.
- Keep the cream a little soft and finish whisking by hand.
- Place fruit in the middle before rolling.

## Troubleshooting

### Why did my cake lose volume?

The batter can deflate if the meringue is overmixed during folding. Fold in stages and stop once the mixture is even.

### What does medium peak mean?

The meringue should form a peak that holds its shape but bends slightly at the tip.

### Why make a liaison with the melted butter?

Mixing the melted butter first with a small amount of batter makes it easier to fold into the full batch without sinking or deflating the foam.

### How stiff should the cream be?

Whip to medium-stiff peak for filling. The cream should hold its shape but remain spreadable so the cake can roll without squeezing out all the filling.

## Recipe Summary

- Pan: quarter sheet pan (13 × 9 in) for 1 cake
- Cake base: 279 g
- Cream filling: 217 g
- Meringue: medium peak
- Cream: medium-stiff peak
- Bake: 170°C (350°F) for 11–13 minutes
- Optional: add flavor halfway through whipping or place fruit in the center
