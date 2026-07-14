"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import type { Step } from "@/lib/recipes";
import { formatMinutes } from "@/lib/format";

export default function GuidedBaking({
  steps,
  index,
  onIndex,
  onExit,
}: {
  steps: Step[];
  index: number;
  onIndex: (i: number) => void;
  onExit: () => void;
}) {
  const step = steps[index];
  const total = steps.length;
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const remaining = steps.slice(index).reduce((s, x) => s + x.minutes, 0);
  const pct = Math.round(((index + 1) / total) * 100);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-accent">
          Guided Baking
        </div>
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1 text-xs text-muted transition hover:text-accent"
        >
          <X className="h-3.5 w-3.5" /> Exit
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="font-medium">
          Step {index + 1} <span className="text-muted">/ {total}</span>
        </span>
        {remaining > 0 && (
          <span className="text-muted">~{formatMinutes(remaining)} left</span>
        )}
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <h2 className="mt-5 text-xl font-semibold">{step.title}</h2>
      <div className="prose prose-stone mt-2 max-w-none dark:prose-invert prose-p:leading-relaxed">
        <Markdown remarkPlugins={[remarkGfm]}>{step.body}</Markdown>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => onIndex(index - 1)}
          disabled={isFirst}
          className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm transition hover:border-accent hover:text-accent disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </button>
        {isLast ? (
          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-95"
          >
            <Check className="h-4 w-4" /> Finish
          </button>
        ) : (
          <button
            onClick={() => onIndex(index + 1)}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-95"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
