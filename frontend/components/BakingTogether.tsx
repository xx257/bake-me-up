"use client";

import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight, Check, Thermometer } from "lucide-react";
import type { Recipe } from "@/lib/recipes";
import { formatMinutes } from "@/lib/format";
import AssistantPanel from "./AssistantPanel";

// Joining an ongoing baking session — someone beside you. Hierarchy:
// Presence → Context → Current Action → Conversation. The chat is present and inline
// (content-sized), not a huge empty container.
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
  // New step → bring it back into view at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [index]);

  const time = [
    step.activeMin ? `${formatMinutes(step.activeMin)} active` : null,
    step.passiveMin ? `${formatMinutes(step.passiveMin)} passive` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // A warm, grounded one-liner about the current step, derived from its timing.
  const vibe =
    step.activeMin && step.activeMin <= 5
      ? "this one's quick"
      : step.passiveMin && step.passiveMin >= 30
        ? "mostly hands-off"
        : step.activeMin && step.activeMin >= 15
          ? "worth your full attention"
          : "take your time";

  const displayTime = recipe.estTimeMin ?? recipe.totalMinutes;

  return (
    <div ref={scrollRef} className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-2xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        {/* Presence */}
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Recipe
        </button>
        <div className="mt-4 flex items-center gap-2">
          <span aria-hidden className="text-lg">
            🍞
          </span>
          <span className="font-display text-lg tracking-tight">Bake Me Up</span>
        </div>

        {/* Context — warm, per-step framing */}
        <div className="mt-4 space-y-1 text-muted-foreground">
          <p>
            We&apos;re making{" "}
            <span className="text-foreground">{recipe.title}</span> together.
          </p>
          <p>
            You&apos;re on {step.title} — {vibe}.
          </p>
        </div>

        {/* Current Action — the focal step */}
        <div className="mt-8">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Step {index + 1}
          </div>
          <h1 className="font-display mt-1 text-3xl leading-tight tracking-tight">
            {step.title}
          </h1>
          {time && <div className="mt-1.5 text-sm text-muted-foreground">{time}</div>}

          <div className="prose prose-stone mt-4 max-w-none text-[1.02rem] leading-relaxed prose-p:my-2">
            <Markdown remarkPlugins={[remarkGfm]}>{step.body}</Markdown>
          </div>

          {(step.completion.length > 0 || step.tip) && (
            <div className="mt-5 space-y-3">
              {step.completion.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Check className="h-4 w-4 text-primary" /> Ready when
                  </div>
                  <ul className="mt-1.5 space-y-1 text-[0.95rem] text-foreground/80">
                    {step.completion.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        {/temperature|°c/i.test(c) ? (
                          <Thermometer className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <span
                            aria-hidden
                            className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/50"
                          />
                        )}
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {step.tip && (
                <p className="text-[0.95rem] text-muted-foreground">
                  <span aria-hidden className="mr-1">
                    💡
                  </span>
                  {step.tip}
                </p>
              )}
            </div>
          )}

          {/* Move on, gently */}
          <div className="mt-6 flex items-center justify-between">
            {!isFirst ? (
              <button
                onClick={() => onIndex(index - 1)}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={() => (isLast ? onExit() : onIndex(index + 1))}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-105"
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
        </div>

        {/* Conversation — present and inline, the ongoing session */}
        <div className="mt-10 border-t border-border/50 pt-6">
          <AssistantPanel
            flow
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
    </div>
  );
}
