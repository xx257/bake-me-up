"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/SessionProvider";
import { formatMinutes } from "@/lib/format";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import ReasoningStages from "@/components/ReasoningStages";

type Msg = { role: "user" | "assistant"; content: string };
type CurrentStep = {
  index: number;
  title: string;
  total: number;
  next?: string;
  completed?: number;
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
  estTimeMin,
  stepCount,
  suggestions,
  currentStep,
  autoAsk,
  fill = false,
  bare = false,
  flow = false,
}: {
  recipeId: string;
  recipeTitle: string;
  difficulty?: string;
  estTimeMin?: number;
  stepCount: number;
  suggestions: string[];
  currentStep?: CurrentStep;
  autoAsk?: string;
  fill?: boolean;
  bare?: boolean;
  flow?: boolean;
}) {
  const { threadId, setThreadId } = useSession();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [mode, setMode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastAuto = useRef<string | null>(null);

  useEffect(() => {
    // In flow mode the page scrolls (no inner box), so nudge the sentinel into view.
    if (flow) {
      if (messages.length > 0 || loading)
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading, flow]);

  // A troubleshooting "Ask coach" click passes the question in via `autoAsk`; send it once.
  useEffect(() => {
    if (autoAsk && autoAsk !== lastAuto.current) {
      lastAuto.current = autoAsk;
      send(autoAsk);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAsk]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          threadId,
          activeRecipe: recipeId,
          currentStep: currentStep
            ? `Step ${currentStep.index}/${currentStep.total}: ${currentStep.title}` +
              (currentStep.next
                ? `; the next step is "${currentStep.next}"`
                : "; this is the final step") +
              (currentStep.completed !== undefined
                ? `; ${currentStep.completed} of ${currentStep.total} steps done so far`
                : "")
            : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      if (d.threadId) setThreadId(d.threadId);
      setMode(d.mode);
      setMessages((m) => [...m, { role: "assistant", content: d.reply }]);
    } catch {
      toast.error("The assistant couldn't respond. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const base = suggestions.length ? suggestions : FALLBACK_SUGGESTIONS;
  const chips = (currentStep ? ["What's next?", ...base] : base).slice(0, 4);

  const status = currentStep
    ? `Baking · Step ${currentStep.index}/${currentStep.total}: ${currentStep.title}`
    : mode === "general"
      ? "Using general baking knowledge"
      : `Grounded in ${recipeTitle}`;

  return (
    <div
      className={
        flow
          ? "flex flex-col"
          : `flex flex-col overflow-hidden bg-card ${
              fill
                ? "h-full"
                : "h-[70vh] max-h-[640px] rounded-2xl shadow-[0_1px_2px_rgba(59,50,42,0.04),0_12px_32px_-16px_rgba(59,50,42,0.22)]"
            }`
      }
    >
      {!bare && !flow && (
        <div className="border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span aria-hidden>🍞</span>
            <div className="text-sm font-medium">Bake Me Up</div>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{status}</div>
        </div>
      )}

      <div
        ref={scrollRef}
        className={flow ? "space-y-3" : "flex-1 space-y-3 overflow-y-auto px-4 py-4"}
      >
        {messages.length === 0 &&
          (flow ? (
            <div className="text-sm">
              <p className="text-foreground/80">I&apos;m right here.</p>
              <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                Suggested
              </div>
              <div className="mt-2 flex flex-col items-start gap-1.5">
                {chips.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-sm text-primary/90 transition hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
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
                {estTimeMin && (
                  <>
                    <span aria-hidden>·</span>
                    <span>~{formatMinutes(estTimeMin)}</span>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {chips.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full bg-secondary/60 px-3 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}

        {messages.map((m, i) => (
          <Message key={i} from={m.role}>
            <MessageContent>
              <MessageResponse>{m.content}</MessageResponse>
            </MessageContent>
          </Message>
        ))}

        {loading && (
          <ReasoningStages stages={["Reading the recipe", "Thinking it through"]} />
        )}

        <div ref={endRef} />
      </div>

      {currentStep && messages.length > 0 && (
        <button
          onClick={() => send("What's next?")}
          disabled={loading}
          className={`self-start rounded-full bg-secondary/60 px-3 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40 ${
            flow ? "mt-3" : "mx-3 mb-1 mt-1"
          }`}
        >
          What&apos;s next?
        </button>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className={
          flow
            ? "mt-4 flex items-center gap-2"
            : "flex items-center gap-2 border-t border-border/50 p-3"
        }
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={flow ? "Message…" : "Ask about this recipe…"}
          className="flex-1 rounded-full bg-secondary/60 px-4 py-2.5 text-sm outline-none transition focus:bg-secondary"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full bg-primary p-2 text-white transition disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
