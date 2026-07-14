"use client";

import { ChefHat, MessageCircle, Scale } from "lucide-react";
import RecipeImage from "@/components/RecipeImage";
import { formatMinutes } from "@/lib/format";
import type { Recipe } from "@/lib/recipes";

export default function RecipeHero({
  recipe,
  canBake,
  onStart,
  onScale,
  onAsk,
}: {
  recipe: Recipe;
  canBake: boolean;
  onStart: () => void;
  onScale: () => void;
  onAsk: () => void;
}) {
  const time = recipe.estTimeMin ?? recipe.totalMinutes;
  const meta = [
    recipe.difficulty?.level,
    time ? formatMinutes(time) : null,
    recipe.yieldUnits,
    recipe.pan,
    recipe.bakeTemp && `${recipe.bakeTemp} bake`,
  ].filter(Boolean) as string[];

  return (
    <header>
      <RecipeImage
        slug={recipe.slug}
        emoji={recipe.category.emoji}
        alt={recipe.title}
        className="h-52 w-full rounded-2xl sm:h-64"
      />
      <h1 className="font-display mt-5 text-3xl tracking-tight sm:text-4xl">
        {recipe.title}
      </h1>
      {recipe.description && (
        <p className="mt-2 text-muted-foreground">{recipe.description}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {meta.map((m, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
            )}
            <span className="capitalize">{m}</span>
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={onStart}
          disabled={!canBake}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-105 disabled:opacity-40"
        >
          <ChefHat className="h-4 w-4" /> Start Baking
        </button>
        <button
          onClick={onScale}
          className="inline-flex items-center gap-2 rounded-full bg-secondary/70 px-4 py-2.5 text-sm transition hover:bg-secondary"
        >
          <Scale className="h-4 w-4" /> Scale Recipe
        </button>
        <button
          onClick={onAsk}
          className="inline-flex items-center gap-2 rounded-full bg-secondary/70 px-4 py-2.5 text-sm transition hover:bg-secondary"
        >
          <MessageCircle className="h-4 w-4" /> Ask Coach
        </button>
      </div>
    </header>
  );
}
