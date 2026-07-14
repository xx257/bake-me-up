"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatMinutes } from "@/lib/format";

type Msg = { role: "user" | "assistant"; content: string };
type CurrentStep = {
  index: number;
  title: string;
  total: number;
  next?: string;
};

const FALLBACK_SUGGESTIONS = [
  "What ingredients do I need?",
  "How do I know when it's done?",
  "Any tips for beginners?",
];

export default function AssistantPanel({
  recipeId,
  recipeTitle,
  difficulty,
  totalMinutes,
  stepCount,
  suggestions,
  currentStep,
}: {
  recipeId: string;
  recipeTitle: string;
  difficulty?: string;
  totalMinutes: number;
  stepCount: number;
  suggestions: string[];
  currentStep?: CurrentStep;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          recipeId,
          currentStep: currentStep
            ? `Step ${currentStep.index}/${currentStep.total}: ${currentStep.title}` +
              (currentStep.next
                ? `; the next step is "${currentStep.next}"`
                : "; this is the final step")
            : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      toast.error("The assistant couldn't respond. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const base = suggestions.length ? suggestions : FALLBACK_SUGGESTIONS;
  const chips = (currentStep ? ["What's next?", ...base] : base).slice(0, 4);

  return (
    <div className="flex h-[70vh] max-h-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden>🍞</span>
          <div className="text-sm font-medium">Bake Me Up</div>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {currentStep
            ? `Baking · Step ${currentStep.index}/${currentStep.total}: ${currentStep.title}`
            : `Grounded in ${recipeTitle}`}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="text-sm text-muted">
            <p>
              Ask me anything about{" "}
              <span className="font-medium text-foreground">{recipeTitle}</span>.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {difficulty && <span className="capitalize">{difficulty}</span>}
              {stepCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span>{stepCount} steps</span>
                </>
              )}
              {totalMinutes > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span>~{formatMinutes(totalMinutes)}</span>
                </>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1 text-xs transition hover:border-accent hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-sm text-white">
                {m.content}
              </div>
            ) : (
              <div className="prose prose-sm prose-stone max-w-[90%] rounded-2xl rounded-bl-sm bg-background px-3 py-2 dark:prose-invert">
                <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-background px-3 py-2 text-sm text-muted">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {currentStep && messages.length > 0 && (
        <button
          onClick={() => send("What's next?")}
          disabled={loading}
          className="mx-3 mb-1 mt-1 self-start rounded-full border border-border px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-accent disabled:opacity-40"
        >
          What&apos;s next?
        </button>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this recipe…"
          className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none transition focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full bg-accent p-2 text-white transition disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
