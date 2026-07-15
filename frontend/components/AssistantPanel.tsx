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
import KiwiMark from "@/components/KiwiMark";

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
  hideIntro = false,
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
  hideIntro?: boolean;
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
            ? `You are currently on Step ${currentStep.index} of ${currentStep.total}: ${currentStep.title}` +
              (currentStep.next
                ? `. The next step is "${currentStep.next}" (they have NOT advanced yet)`
                : ". This is the final step") +
              (currentStep.completed !== undefined
                ? `. ${currentStep.completed} of ${currentStep.total} steps done so far`
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
            <KiwiMark size={22} />
            <div className="text-sm font-medium">Bake Me Up</div>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{status}</div>
        </div>
      )}

      <div
        ref={scrollRef}
        className={
          flow ? "space-y-3 text-body" : "flex-1 space-y-3 overflow-y-auto px-4 py-4 text-body"
        }
      >
        {messages.length === 0 && (
          <div className="text-sm">
            {!hideIntro &&
              (flow ? (
                <p className="text-body">I&apos;m right here.</p>
              ) : (
                <>
                  <p className="text-body">
                    Ask me anything about{" "}
                    <span className="font-medium text-foreground">{recipeTitle}</span>.
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
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
                </>
              ))}
            {/* Coaching shows a persistent, per-step chip row below instead (updates each step). */}
            {!currentStep && (
              <>
                <div
                  className={`text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground ${
                    hideIntro ? "" : "mt-4"
                  }`}
                >
                  Suggested
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {chips.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full bg-primary/10 px-3 py-1.5 text-sm text-foreground transition hover:bg-primary/15"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <Message key={i} from="user">
              <MessageContent>
                <MessageResponse>{m.content}</MessageResponse>
              </MessageContent>
            </Message>
          ) : (
            // The companion's note — a soft recipe-note card, not a chat bubble.
            <div
              key={i}
              className="rounded-2xl border border-[#e8e0d6] bg-card p-4 text-body"
            >
              <MessageResponse>{m.content}</MessageResponse>
            </div>
          ),
        )}

        {loading && (
          <ReasoningStages stages={["Reading the recipe", "Thinking it through"]} />
        )}

        <div ref={endRef} />
      </div>

      {/* Coaching: a persistent, per-step suggestion row. Updates as the step changes so the
          chips always reflect the current step (not just the empty state). */}
      {currentStep && (
        <div className={`flex flex-wrap gap-1.5 ${flow ? "mt-3" : "mx-3 mb-1 mt-1"}`}>
          {chips.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={loading}
              className="rounded-full bg-primary/10 px-3 py-1 text-xs text-foreground transition hover:bg-primary/15 disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
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
          className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60"
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
