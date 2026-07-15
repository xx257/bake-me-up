"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight, Check, Send } from "lucide-react";
import type { Recipe } from "@/lib/recipes";
import { formatMinutes } from "@/lib/format";
import KiwiMark from "./KiwiMark";
import { useCoachChat } from "./useCoachChat";
import { WebSearchCard } from "./WebSearchCard";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import ReasoningStages from "@/components/ReasoningStages";

// Baking Together — one coherent vertical flow (a companion, not a side chat):
// step → Kiwi guidance → ready when → suggested questions → progression → conversation.
export default function BakingTogether({
  recipe,
  index,
  onIndex,
  onExit,
  onFinish,
}: {
  recipe: Recipe;
  index: number;
  onIndex: (i: number) => void;
  onExit: () => void;
  onFinish: () => void;
}) {
  const steps = recipe.steps;
  const step = steps[index];
  const total = steps.length;
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const next = !isLast ? steps[index + 1] : undefined;

  const { messages, loading, send } = useCoachChat(recipe.id, {
    index: step.index,
    title: step.title,
    total,
    next: next?.title,
  });
  const [input, setInput] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [index]);
  useEffect(() => {
    if (messages.length || loading)
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  const time = [
    step.activeMin ? `${formatMinutes(step.activeMin)} active` : null,
    step.passiveMin ? `${formatMinutes(step.passiveMin)} passive` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const pct = ((index + 1) / total) * 100;
  const notePara = (step.note ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chips = ["What's next?", ...(step.questions ?? [])].slice(0, 4);

  const Divider = () => <div className="my-8 border-t border-border" />;

  function submit(text: string) {
    const q = text.trim();
    if (!q) return;
    setInput("");
    send(q);
  }

  return (
    <div ref={scrollRef} className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-[680px] px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* Top bar */}
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Recipe
        </button>

        {/* ── Current step ─────────────────────────────────────────── */}
        <div className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
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

        {/* ── Kiwi guidance ────────────────────────────────────────── */}
        {notePara.length > 0 && (
          <>
            <Divider />
            <div className="flex items-center gap-2">
              <KiwiMark size={22} />
              <span className="text-sm font-medium text-foreground">Kiwi</span>
            </div>
            <div className="mt-3 space-y-2.5 text-[1.05rem] leading-relaxed text-body">
              {notePara.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </>
        )}

        {/* ── Ready when ───────────────────────────────────────────── */}
        {step.completion.length > 0 && (
          <>
            <Divider />
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Ready when
            </div>
            <ul className="mt-3 space-y-2 text-body">
              {step.completion.map((c, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* ── Suggested questions ──────────────────────────────────── */}
        <Divider />
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Suggested questions
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={loading}
              className="rounded-full bg-primary/10 px-3.5 py-1.5 text-sm text-foreground transition hover:bg-primary/15 disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>

        {/* ── Progression ──────────────────────────────────────────── */}
        <Divider />
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
            onClick={() => (isLast ? onFinish() : onIndex(index + 1))}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            {isLast ? (
              "Finish"
            ) : (
              <>
                I&apos;m Ready <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {/* ── Conversation ─────────────────────────────────────────── */}
        <Divider />
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Conversation
        </div>
        <div className="mt-3 space-y-3">
          {messages.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">
              Ask Kiwi anything about this step — tap a question above or type below.
            </p>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <Message key={i} from="user">
                <MessageContent>
                  <MessageResponse>{m.content}</MessageResponse>
                </MessageContent>
              </Message>
            ) : (
              <div key={i} className="space-y-3">
                <div className="rounded-2xl border border-[#e8e0d6] bg-card p-4 text-body">
                  <MessageResponse>{m.content}</MessageResponse>
                </div>
                <WebSearchCard webSearch={m.webSearch} />
              </div>
            ),
          )}
          {loading && (
            <ReasoningStages stages={["Reading the recipe", "Thinking it through"]} />
          )}
          <div ref={endRef} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="mt-4 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Kiwi about this step…"
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
    </div>
  );
}
