"use client";

import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight, Thermometer } from "lucide-react";
import type { Recipe } from "@/lib/recipes";
import { formatMinutes } from "@/lib/format";
import AssistantPanel from "./AssistantPanel";
import KiwiMark from "./KiwiMark";

// Coach Mode: Current Step → Success Criteria → Coach Guidance → Next Action.
export default function BakingTogether({
  recipe,
  index,
  onIndex,
  onExit,
}: {
  recipe: Recipe;
  index: number;
  onIndex: (i: number) => void;
  onExit: () => void;
}) {
  const steps = recipe.steps;
  const step = steps[index];
  const total = steps.length;
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const next = !isLast ? steps[index + 1] : undefined;

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [index]);

  const time = [
    step.activeMin ? `${formatMinutes(step.activeMin)} active` : null,
    step.passiveMin ? `${formatMinutes(step.passiveMin)} passive` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const displayTime = recipe.estTimeMin ?? recipe.totalMinutes;
  const pct = ((index + 1) / total) * 100;

  // Back / I'm Ready — kept attached to the step content (never floating).
  const actions = (
    <div className="flex items-center justify-between gap-3">
      {!isFirst ? (
        <button
          onClick={() => onIndex(index - 1)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      ) : (
        <span />
      )}
      <button
        onClick={() => (isLast ? onExit() : onIndex(index + 1))}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover"
      >
        {isLast ? (
          <>
            Finish <span aria-hidden>🎉</span>
          </>
        ) : (
          <>
            I&apos;m Ready <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );

  return (
    <div ref={scrollRef} className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-[1000px] px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* Top bar: back + quiet brand */}
        <div className="flex items-center justify-between">
          <button
            onClick={onExit}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Recipe
          </button>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <KiwiMark size={18} />
            <span className="font-headline text-[11px] font-semibold uppercase tracking-[0.16em]">
              Bake Me Up
            </span>
          </div>
        </div>

        <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,680px)_300px] lg:gap-10">
          {/* Main — the current step */}
          <div className="max-w-[680px]">
            {/* Recipe context + visible progress */}
            <div className="text-sm text-muted-foreground">{recipe.title}</div>
            <div className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Step {index + 1} of {total}
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            <h1 className="font-display mt-4 text-3xl leading-tight tracking-tight text-foreground">
              {step.title}
            </h1>
            {time && <div className="mt-1.5 text-sm text-muted-foreground">{time}</div>}

            <div className="prose prose-stone mt-4 max-w-none text-[1.05rem] leading-relaxed text-body prose-headings:text-foreground prose-p:my-2.5 prose-p:text-body prose-strong:text-foreground prose-li:text-body">
              <Markdown remarkPlugins={[remarkGfm]}>{step.body}</Markdown>
            </div>

            {/* Success criteria — with the next action attached */}
            {step.completion.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Ready when
                </div>
                <ul className="mt-2 space-y-2 text-body">
                  {step.completion.map((c, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      {/temperature|°c/i.test(c) ? (
                        <Thermometer className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <span
                          aria-hidden
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        />
                      )}
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-border/70 pt-4">{actions}</div>
              </div>
            ) : (
              <div className="mt-6">{actions}</div>
            )}
          </div>

          {/* Coach — Kiwi's note + the chat */}
          <aside className="mt-8 lg:mt-0">
            <div className="flex h-[60vh] flex-col overflow-hidden rounded-2xl border border-border bg-card lg:sticky lg:top-6 lg:h-[calc(100vh-7.5rem)]">
              <div className="shrink-0 border-b border-border p-4">
                <div className="flex items-center gap-2">
                  <KiwiMark size={20} />
                  <span className="text-sm font-medium">Kiwi</span>
                </div>
                {step.tip && (
                  <p className="mt-2 text-sm leading-relaxed text-body">{step.tip}</p>
                )}
              </div>
              <div className="min-h-0 flex-1">
                <AssistantPanel
                  fill
                  bare
                  hideIntro
                  recipeId={recipe.id}
                  recipeTitle={recipe.title}
                  difficulty={recipe.difficulty?.level}
                  estTimeMin={displayTime}
                  stepCount={total}
                  suggestions={recipe.suggestions}
                  currentStep={{
                    index: step.index,
                    title: step.title,
                    total,
                    next: next?.title,
                  }}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
