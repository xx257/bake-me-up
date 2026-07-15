"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/SessionProvider";

import type { WebSearchCall } from "@/components/WebSearchCard";

export type CoachMsg = {
  role: "user" | "assistant";
  content: string;
  // Web-search cards for this assistant turn (Tavily fallback), when the recipe couldn't answer.
  webSearch?: WebSearchCall[] | null;
};

export type CoachStep = {
  index: number;
  title: string;
  total: number;
  next?: string;
};

// The coach chat that powers Baking Together. The conversation is displayed PER STEP —
// each step has its own bucket, so advancing ("I'm Ready") shows a fresh conversation and
// returning to a step restores its Q&A. Memory is NOT per-step: every turn rides one shared
// LangGraph thread (via `threadId`), so the coach keeps FULL session history regardless of
// which step's bucket is on screen.
export function useCoachChat(recipeId: string, step: CoachStep) {
  const { threadId, setThreadId } = useSession();
  const [byStep, setByStep] = useState<Record<number, CoachMsg[]>>({});
  const [loadingStep, setLoadingStep] = useState<number | null>(null);

  // Only the current step's messages are visible; the spinner shows only on the step that asked.
  const messages = byStep[step.index] ?? [];
  const loading = loadingStep === step.index;

  const push = (s: number, msg: CoachMsg) =>
    setByStep((m) => ({ ...m, [s]: [...(m[s] ?? []), msg] }));

  async function send(text: string) {
    const q = text.trim();
    if (!q || loadingStep !== null) return; // one request at a time (shared thread)
    const s = step.index; // bucket + spinner belong to the step this was asked from
    push(s, { role: "user", content: q });
    setLoadingStep(s);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          threadId, // shared across steps → backend thread carries the whole session
          activeRecipe: recipeId,
          currentStep:
            `You are currently on Step ${step.index} of ${step.total}: ${step.title}` +
            (step.next
              ? `. The next step is "${step.next}" (they have NOT advanced yet)`
              : ". This is the final step"),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      if (d.threadId) setThreadId(d.threadId);
      push(s, { role: "assistant", content: d.reply, webSearch: d.webSearch ?? null });
    } catch {
      toast.error("Kiwi couldn't respond. Please try again.");
    } finally {
      setLoadingStep(null);
    }
  }

  return { messages, loading, send };
}
