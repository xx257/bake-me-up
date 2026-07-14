"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Clock, Send } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { formatMinutes } from "@/lib/format";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import RecipeImage from "@/components/RecipeImage";
import ReasoningStages from "@/components/ReasoningStages";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

const PLAN_STAGES = [
  "Understanding your request",
  "Searching your collection",
  "Choosing the best matches",
];

const QUICK = [
  "Under an hour",
  "Something for breakfast",
  "Beginner friendly",
  "Use up strawberries",
  "Dessert for friends",
];

type Msg = { role: "user" | "assistant"; content: string };
type ToolCall = {
  name: string;
  input: Record<string, unknown>;
  considered: {
    title: string;
    category: string;
    difficulty?: string;
    total_time_min?: number;
  }[];
  state: string;
};
type Rec = {
  id: string;
  slug: string;
  title: string;
  category: { label: string; emoji: string };
  difficulty?: string;
  est_time_min?: number;
  why: string;
};

export default function Kitchen() {
  const { threadId, setThreadId } = useSession();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [cards, setCards] = useState<Rec[]>([]);
  const [tool, setTool] = useState<ToolCall | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
        body: JSON.stringify({ message: q, threadId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      if (d.threadId) setThreadId(d.threadId);
      setMessages((m) => [...m, { role: "assistant", content: d.reply }]);
      setCards(d.recommendations ?? []);
      setTool(d.tool ?? null);
    } catch {
      toast.error("Couldn't reach the planner. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Planning conversation ──────────────────────────────────────────────
  if (messages.length > 0) {
    const [topPick, ...restPicks] = cards;
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="space-y-5 pb-24">
          {messages.map((m, i) => (
            <Message key={i} from={m.role}>
              <MessageContent>
                <MessageResponse>{m.content}</MessageResponse>
              </MessageContent>
            </Message>
          ))}

          {loading && <ReasoningStages stages={PLAN_STAGES} />}

          {!loading && tool && tool.considered.length > 0 && (
            <Tool defaultOpen={false}>
              <ToolHeader
                title="Searched your collection"
                type="tool-search_collection"
                state="output-available"
              />
              <ToolContent>
                <ToolInput input={tool.input} />
                <ToolOutput
                  errorText={undefined}
                  output={
                    <ul className="space-y-1.5 p-3 text-sm">
                      {tool.considered.map((c) => (
                        <li
                          key={c.title}
                          className="flex items-center justify-between gap-3"
                        >
                          <span>{c.title}</span>
                          <span className="text-muted-foreground">
                            {c.category}
                            {c.total_time_min ? ` · ~${c.total_time_min}m` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  }
                />
              </ToolContent>
            </Tool>
          )}

          {topPick && (
            <div className="space-y-4">
              {/* The recommendation is the hero of the reply — a pick with a reason. */}
              <button
                onClick={() => router.push(`/recipe/${topPick.slug}`)}
                className="group grid w-full overflow-hidden rounded-3xl bg-card text-left shadow-[0_1px_2px_rgba(59,50,42,0.05),0_18px_44px_-20px_rgba(59,50,42,0.30)] transition hover:-translate-y-0.5 sm:grid-cols-2"
              >
                <RecipeImage
                  slug={topPick.slug}
                  emoji={topPick.category.emoji}
                  alt={topPick.title}
                  className="h-48 w-full sm:h-full sm:min-h-[220px]"
                />
                <div className="flex flex-col p-6">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{topPick.category.label}</span>
                    {topPick.difficulty && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="capitalize">{topPick.difficulty}</span>
                      </>
                    )}
                    {topPick.est_time_min && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {formatMinutes(topPick.est_time_min)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="font-display mt-1.5 text-2xl leading-tight tracking-tight transition group-hover:text-primary">
                    {topPick.title}
                  </div>
                  {topPick.why && (
                    <div className="mt-3">
                      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary/80">
                        Why this one
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                        {topPick.why}
                      </p>
                    </div>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Open recipe
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>

              {restPicks.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {restPicks.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => router.push(`/recipe/${c.slug}`)}
                      className="group flex gap-3 overflow-hidden rounded-2xl bg-card p-3 text-left shadow-[0_1px_2px_rgba(59,50,42,0.04),0_8px_24px_-14px_rgba(59,50,42,0.18)] transition hover:-translate-y-0.5"
                    >
                      <RecipeImage
                        slug={c.slug}
                        emoji={c.category.emoji}
                        alt={c.title}
                        className="h-16 w-16 shrink-0 rounded-xl"
                      />
                      <div className="min-w-0">
                        <div className="font-display text-base leading-snug transition group-hover:text-primary">
                          {c.title}
                        </div>
                        {c.why && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {c.why}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <Link
                href="/recipes"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary"
              >
                Browse all recipes <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="fixed inset-x-0 bottom-4 mx-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl bg-card px-3 py-2 shadow-lg"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Refine or ask a follow-up…"
              className="flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-primary p-2 text-primary-foreground transition hover:brightness-105 disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ── Cookbook home — the collection is the hero ─────────────────────────
  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-24 pt-12 sm:pt-20">
      <section className="mb-16 max-w-2xl">
        <h1 className="font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">
          What are we baking today?
        </h1>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Tell me what you&apos;re craving, how much time you have, or what&apos;s in the
          pantry — I&apos;ll find the one worth making, then bake it with you, step by step.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-6"
        >
          <div className="flex items-center gap-2 rounded-2xl bg-secondary/70 px-4 py-3 shadow-sm transition focus-within:bg-secondary">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Let's plan today's bake…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-xl bg-primary p-2 text-primary-foreground transition hover:brightness-105 disabled:opacity-40"
              aria-label="Plan a bake"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground/60">Try</span>
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full px-3 py-1 text-xs text-muted-foreground/80 ring-1 ring-border/60 transition hover:text-foreground hover:ring-border"
              >
                {q}
              </button>
            ))}
          </div>
        </form>

        <Link
          href="/recipes"
          className="mt-12 inline-flex items-center gap-1 text-sm text-muted-foreground/70 transition hover:text-foreground"
        >
          No idea? Browse the collection
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </main>
  );
}
