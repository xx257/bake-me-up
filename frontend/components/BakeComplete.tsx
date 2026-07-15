"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Recipe } from "@/lib/recipes";
import { formatMinutes } from "@/lib/format";
import KiwiMark from "./KiwiMark";

// The calm close of the journey — a warm sign-off, not a scoreboard.
export default function BakeComplete({
  recipe,
  onBack,
  onBakeAgain,
}: {
  recipe: Recipe;
  onBack: () => void;
  onBakeAgain: () => void;
}) {
  const total = recipe.steps.length;
  const time = recipe.estTimeMin ?? recipe.totalMinutes;
  const closing =
    (recipe.steps.at(-1)?.note ?? "").split(/\n{2,}/)[0].trim() ||
    recipe.generalNotes[0] ||
    "Let it rest a little before you dig in.";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <KiwiMark size={26} />
          <span className="text-sm font-medium">Kiwi</span>
        </div>

        <h1 className="font-display mt-6 text-4xl leading-tight tracking-tight text-foreground">
          You finished.
        </h1>

        <div className="mt-3 text-sm text-muted-foreground">
          {recipe.title} · {total} {total === 1 ? "step" : "steps"}
          {time ? ` · ~${formatMinutes(time)}` : ""}
        </div>

        <p className="mt-6 max-w-[42ch] text-[1.05rem] leading-relaxed text-body">{closing}</p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            Back to the recipe
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/60 hover:text-primary"
          >
            Plan another bake <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <button
          onClick={onBakeAgain}
          className="mt-6 text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
        >
          Bake it again
        </button>
      </div>
    </div>
  );
}
