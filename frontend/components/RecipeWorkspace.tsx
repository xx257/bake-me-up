"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Camera, ChefHat, Scale } from "lucide-react";
import type { Recipe } from "@/lib/recipes";
import { formatMinutes } from "@/lib/format";
import GuidedBaking from "./GuidedBaking";
import AssistantPanel from "./AssistantPanel";

export default function RecipeWorkspace({ recipe }: { recipe: Recipe }) {
  const [baking, setBaking] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const hasSteps = recipe.steps.length > 0;
  const currentStep = baking && hasSteps ? recipe.steps[stepIndex] : undefined;

  return (
    <>
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <span>
            {recipe.category.emoji} {recipe.category.label}
          </span>
          {recipe.difficulty?.level && (
            <>
              <span aria-hidden>·</span>
              <span className="capitalize">{recipe.difficulty.level}</span>
            </>
          )}
          {recipe.totalMinutes > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>~{formatMinutes(recipe.totalMinutes)}</span>
            </>
          )}
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{recipe.title}</h1>
        {recipe.source && (
          <p className="mt-1 text-sm text-muted">Source: {recipe.source}</p>
        )}

        {!baking && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setStepIndex(0);
                setBaking(true);
              }}
              disabled={!hasSteps}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-95 disabled:opacity-40"
            >
              <ChefHat className="h-4 w-4" /> Start Baking
            </button>
            <button
              onClick={() => toast("Recipe scaling is coming soon.")}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition hover:border-accent hover:text-accent"
            >
              <Scale className="h-4 w-4" /> Scale Recipe
            </button>
            <button
              onClick={() => toast("Note import is coming soon.")}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition hover:border-accent hover:text-accent"
            >
              <Camera className="h-4 w-4" /> Import Notes
            </button>
          </div>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(340px,380px)]">
        <div>
          {baking && currentStep ? (
            <GuidedBaking
              steps={recipe.steps}
              index={stepIndex}
              onIndex={setStepIndex}
              onExit={() => setBaking(false)}
            />
          ) : (
            <article className="prose prose-stone max-w-none dark:prose-invert prose-headings:font-semibold prose-h2:mt-8 prose-h2:text-xl prose-h3:text-base prose-h4:text-sm prose-h4:text-muted">
              <Markdown remarkPlugins={[remarkGfm]}>{recipe.body}</Markdown>
            </article>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <AssistantPanel
            recipeId={recipe.id}
            recipeTitle={recipe.title}
            difficulty={recipe.difficulty?.level}
            totalMinutes={recipe.totalMinutes}
            stepCount={recipe.steps.length}
            suggestions={recipe.suggestions}
            currentStep={
              currentStep
                ? {
                    index: currentStep.index,
                    title: currentStep.title,
                    total: recipe.steps.length,
                    next:
                      stepIndex < recipe.steps.length - 1
                        ? recipe.steps[stepIndex + 1].title
                        : undefined,
                  }
                : undefined
            }
          />
        </aside>
      </div>
    </>
  );
}
