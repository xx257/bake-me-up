"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/SessionProvider";

export type CoachMsg = { role: "user" | "assistant"; content: string };

export type CoachStep = {
  index: number;
  title: string;
  total: number;
  next?: string;
};

// The coach chat that powers Baking Together: one grounded conversation per session,
// aware of the current step so "what's next?" resolves to the right step. Shared between
// the suggested-question chips and the conversation section of the single-column flow.
export function useCoachChat(recipeId: string, step: CoachStep) {
  const { threadId, setThreadId } = useSession();
  const [messages, setMessages] = useState<CoachMsg[]>([]);
  const [loading, setLoading] = useState(false);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          threadId,
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
      setMessages((m) => [...m, { role: "assistant", content: d.reply }]);
    } catch {
      toast.error("Kiwi couldn't respond. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return { messages, loading, send };
}
