"use client";

import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, ChevronDown, Thermometer } from "lucide-react";
import type { Step } from "@/lib/recipes";
import { formatMinutes } from "@/lib/format";

export default function StepCard({
  step,
  completed = false,
  guided = false,
  expanded,
  onToggle,
  onComplete,
}: {
  step: Step;
  completed?: boolean;
  guided?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onComplete?: (index: number) => void;
}) {
  // Controlled (parent-driven accordion) when `expanded` is provided; otherwise the
  // card manages its own open state (e.g. the guided BakingTogether flow).
  const controlled = expanded !== undefined;
  const [openInternal, setOpenInternal] = useState(guided || !completed);
  useEffect(() => {
    if (!guided && !controlled) setOpenInternal(!completed);
  }, [completed, guided, controlled]);
  const isOpen = controlled ? expanded : openInternal;
  const toggle = () => {
    if (controlled) onToggle?.();
    else if (!guided) setOpenInternal((o) => !o);
  };

  return (
    <div
      id={`step-${step.index}`}
      data-step={step.index}
      className={`scroll-mt-24 rounded-2xl bg-card shadow-[0_1px_2px_rgba(59,50,42,0.04),0_8px_24px_-14px_rgba(59,50,42,0.16)] transition ${
        completed && !guided ? "opacity-70" : ""
      }`}
    >
      <button
        onClick={toggle}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
            completed ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
          }`}
        >
          {completed ? <Check className="h-4 w-4" /> : step.index}
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-lg">{step.title}</span>
          {step.activeMin > 0 && (
            <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Active {formatMinutes(step.activeMin)}
            </span>
          )}
          {step.passiveMin > 0 && (
            <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Wait {formatMinutes(step.passiveMin)}
            </span>
          )}
        </span>
        {!guided && (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4">
          <div className="prose prose-stone max-w-none prose-p:leading-relaxed">
            <Markdown remarkPlugins={[remarkGfm]}>{step.body}</Markdown>
          </div>

          {(step.completion.length > 0 || step.equipment) && (
            <div className="mt-3 rounded-xl bg-secondary/40 p-3 text-sm">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Done when
              </div>
              <ul className="mt-1.5 space-y-1">
                {step.completion.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {/temperature|°c/i.test(c) ? (
                      <Thermometer className="h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                    )}
                    <span>{c}</span>
                  </li>
                ))}
                {step.equipment && (
                  <li className="flex items-center gap-2">
                    <Thermometer className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{step.equipment}</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {step.tip && (
            <div className="mt-3 flex gap-2 rounded-xl bg-primary/5 p-3 text-sm">
              <span aria-hidden>💡</span>
              <span className="text-foreground/80">{step.tip}</span>
            </div>
          )}

          {onComplete && !guided && (
            <button
              onClick={() => onComplete(step.index)}
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                completed
                  ? "bg-secondary text-muted-foreground"
                  : "bg-primary text-white hover:brightness-105"
              }`}
            >
              <Check className="h-3.5 w-3.5" /> {completed ? "Completed" : "Mark Complete"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
