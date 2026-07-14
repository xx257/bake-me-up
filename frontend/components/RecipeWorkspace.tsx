"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChefHat, MessageCircle, X } from "lucide-react";
import type { Recipe } from "@/lib/recipes";
import RecipeHero from "./recipe/RecipeHero";
import MetaCards from "./recipe/MetaCards";
import IngredientGroups from "./recipe/IngredientGroups";
import RecipeTimeline from "./recipe/RecipeTimeline";
import StepCard from "./recipe/StepCard";
import GeneralNotes from "./recipe/GeneralNotes";
import Troubleshooting from "./recipe/Troubleshooting";
import BakingTogether from "./BakingTogether";
import AssistantPanel from "./AssistantPanel";

export default function RecipeWorkspace({ recipe }: { recipe: Recipe }) {
  const [mode, setMode] = useState<"read" | "bake">("read");
  const [stepIndex, setStepIndex] = useState(0);
  const [coachOpen, setCoachOpen] = useState(false);
  const [autoAsk, setAutoAsk] = useState<string | undefined>();

  const hasSteps = recipe.steps.length > 0;

  // Lock the page behind the full-screen bake overlay or the coach sheet.
  useEffect(() => {
    const lock = mode === "bake" || coachOpen;
    document.body.style.overflow = lock ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mode, coachOpen]);

  const startBaking = () => {
    setStepIndex(0);
    setMode("bake");
  };
  const scaleRecipe = () => toast("Recipe scaling is coming soon.");
  const openCoach = () => setCoachOpen(true);
  const askCoach = (q: string) => {
    setAutoAsk(q);
    setCoachOpen(true);
  };
  const closeCoach = () => {
    setCoachOpen(false);
    setAutoAsk(undefined);
  };

  // Coach Active — the signature full-screen experience.
  if (mode === "bake") {
    return (
      <BakingTogether
        recipe={recipe}
        index={stepIndex}
        onIndex={setStepIndex}
        onExit={() => setMode("read")}
      />
    );
  }

  // Coach Available — recipe-first reference; the coach is one quiet tap away.
  return (
    <>
      <div className="mx-auto max-w-[760px] space-y-10 pb-28 lg:pb-10">
        <RecipeHero
          recipe={recipe}
          canBake={hasSteps}
          onStart={startBaking}
          onScale={scaleRecipe}
          onAsk={openCoach}
        />
        <MetaCards cards={recipe.metaCards} />
        {recipe.ingredientGroups.length > 0 && (
          <section>
            <h2 className="font-display mb-4 text-xl tracking-tight">Ingredients</h2>
            <IngredientGroups groups={recipe.ingredientGroups} />
          </section>
        )}
        {recipe.timeline.length > 1 && (
          <section>
            <h2 className="font-display mb-4 text-xl tracking-tight">Timeline</h2>
            <RecipeTimeline steps={recipe.timeline} />
          </section>
        )}
        {hasSteps && (
          <section>
            <h2 className="font-display mb-4 text-xl tracking-tight">Steps</h2>
            <div className="space-y-3">
              {recipe.steps.map((s) => (
                <StepCard key={s.index} step={s} />
              ))}
            </div>
          </section>
        )}
        <GeneralNotes notes={recipe.generalNotes} />
        <Troubleshooting items={recipe.troubleshooting} onAsk={askCoach} />
      </div>

      {/* Desktop: a quiet floating Ask-Coach pill — available, never dominating. */}
      {!coachOpen && (
        <button
          onClick={openCoach}
          className="fixed bottom-6 right-6 z-30 hidden items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm shadow-[0_1px_2px_rgba(59,50,42,0.06),0_12px_32px_-14px_rgba(59,50,42,0.28)] transition hover:-translate-y-0.5 lg:inline-flex"
        >
          <MessageCircle className="h-4 w-4 text-primary" /> Ask Coach
        </button>
      )}

      {/* Mobile: a slim sticky bar so Start Baking + coach stay reachable while scrolling. */}
      {!coachOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-border/50 bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={startBaking}
            disabled={!hasSteps}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:opacity-40"
          >
            <ChefHat className="h-4 w-4" /> Start Baking
          </button>
          <button
            onClick={openCoach}
            aria-label="Ask Coach"
            className="inline-flex items-center justify-center rounded-full bg-secondary/70 p-2.5 text-foreground/70 transition hover:bg-secondary"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* On-demand coach: bottom-sheet on mobile, side panel on desktop. */}
      {coachOpen && (
        <>
          <div
            onClick={closeCoach}
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px]"
          />
          <div className="fixed inset-x-0 bottom-0 z-50 flex h-[82vh] flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[400px] sm:rounded-none sm:border-l sm:border-border/60">
            <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span aria-hidden>🍞</span> Ask the coach
              </div>
              <button
                onClick={closeCoach}
                aria-label="Close"
                className="rounded-full p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <AssistantPanel
                fill
                bare
                recipeId={recipe.id}
                recipeTitle={recipe.title}
                difficulty={recipe.difficulty?.level}
                estTimeMin={recipe.estTimeMin ?? recipe.totalMinutes}
                stepCount={recipe.steps.length}
                suggestions={recipe.suggestions}
                autoAsk={autoAsk}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
