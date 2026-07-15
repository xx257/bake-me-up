"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Clock, Send } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { formatMinutes } from "@/lib/format";
import { MessageResponse } from "@/components/ai-elements/message";
import RecipeImage from "@/components/RecipeImage";
import KiwiMark from "@/components/KiwiMark";
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

type QA = { q: string; a: string };
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

type Featured = { slug: string; title: string; note: string[] };

export default function Kitchen({ featured }: { featured?: Featured }) {
  const { threadId, setThreadId } = useSession();
  const [started, setStarted] = useState(false);
  const [cards, setCards] = useState<Rec[]>([]);
  const [intro, setIntro] = useState(""); // the note that came with the current recommendation
  const [qa, setQa] = useState<QA[]>([]); // follow-up notes about the current recommendation
  const [pendingQ, setPendingQ] = useState<string | null>(null); // question in-flight
  const [showEarlier, setShowEarlier] = useState(false);
  const [tool, setTool] = useState<ToolCall | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const hadRec = cards.length > 0;
    setStarted(true);
    setInput("");
    setLoading(true);
    setPendingQ(q);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          threadId,
          // The pinned pick the user is evaluating — lets the backend coach follow-ups
          // about it (grounded) instead of re-planning. Clears automatically when cards reset.
          currentRecommendation: cards[0]?.id,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      if (d.threadId) setThreadId(d.threadId);
      const reply = (d.reply ?? "").trim();
      const recs: Rec[] = d.recommendations ?? [];
      // The planner often re-returns the SAME pick on a follow-up; only a genuinely different
      // recipe is a "new recommendation" that resets the conversation.
      const samePick =
        recs.length > 0 && cards.length > 0 && recs[0].id === cards[0].id;
      if (recs.length > 0 && !samePick) {
        // First pick, or a different recipe → pin it and reset the attached conversation.
        setCards(recs);
        setIntro(reply);
        setQa([]);
        setShowEarlier(false);
        setTool(d.tool ?? null);
      } else if (hadRec) {
        // Follow-up about the current pick (same recipe re-returned, or a general answer)
        // → append to the conversation; keep the recommendation pinned.
        setQa((prev) => [...prev, { q, a: reply }]);
        setTool((prev) => d.tool ?? prev);
      } else {
        // No recommendation yet (clarifying question / redirect) → framing note.
        setIntro(reply);
        setTool((prev) => d.tool ?? prev);
      }
    } catch {
      toast.error("Couldn't reach the planner. Please try again.");
    } finally {
      setLoading(false);
      setPendingQ(null);
    }
  }

  // Escape hatch — clear the session and return to Kitchen discovery.
  function newSearch() {
    setStarted(false);
    setCards([]);
    setIntro("");
    setQa([]);
    setShowEarlier(false);
    setPendingQ(null);
    setTool(null);
    setInput("");
    setThreadId(null);
  }

  // ── Recommendation session — the pick is the state; conversation supports it ──
  if (started) {
    const [topPick, ...restPicks] = cards;
    const EARLIER = qa.length > 5;
    const visibleQa = showEarlier ? qa : qa.slice(-5);

    return (
      <main className="mx-auto w-full max-w-[880px] px-5 py-8">
        {/* Escape hatch */}
        <button
          onClick={newSearch}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> New search
        </button>

        {/* Intro note — the framing that came with the current recommendation */}
        {intro && (
          <div className="mt-6 flex items-start gap-3">
            <KiwiMark size={30} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 text-body">
              <MessageResponse>{intro}</MessageResponse>
            </div>
          </div>
        )}

        {/* Initial recommendation loading (a follow-up's spinner lives in the notes below). */}
        {loading && !topPick && (
          <div className="mt-4">
            <ReasoningStages stages={PLAN_STAGES} />
          </div>
        )}

        {/* Recommendation — session state; stays visible through loading + follow-ups */}
        {topPick && (
          <div className="mt-8">
            {/* Featured pick — the hero */}
            <button
              onClick={() => router.push(`/recipe/${topPick.slug}`)}
              className="group block w-full overflow-hidden rounded-3xl border border-border bg-card text-left shadow-[0_1px_2px_rgba(31,29,27,0.04),0_18px_44px_-22px_rgba(31,29,27,0.22)] transition hover:-translate-y-0.5"
            >
              <div className="grid sm:grid-cols-[1.15fr_1fr]">
                <RecipeImage
                  slug={topPick.slug}
                  emoji={topPick.category.emoji}
                  alt={topPick.title}
                  className="h-52 w-full object-cover sm:h-full sm:min-h-[260px]"
                />
                <div className="flex flex-col justify-center p-6 sm:p-8">
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
                  <div className="font-display mt-2 text-[1.7rem] leading-tight tracking-tight">
                    {topPick.title}
                  </div>
                  {topPick.why && (
                    <div className="mt-3">
                      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">
                        Why this one
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-body">{topPick.why}</p>
                    </div>
                  )}
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    View recipe
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </button>

            {/* More options — deliberately below, clearly secondary */}
            {restPicks.length > 0 && (
              <div className="mt-8">
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  More options
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {restPicks.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => router.push(`/recipe/${c.slug}`)}
                      className="group flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(31,29,27,0.04),0_12px_28px_-18px_rgba(31,29,27,0.22)]"
                    >
                      <RecipeImage
                        slug={c.slug}
                        emoji={c.category.emoji}
                        alt={c.title}
                        className="h-14 w-14 shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0">
                        <div className="font-display text-[15px] leading-snug">{c.title}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <span>{c.category.label}</span>
                          {c.est_time_min && (
                            <>
                              <span aria-hidden>·</span>
                              <span>{formatMinutes(c.est_time_min)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation — compact memory attached to the recipe, not a chat transcript */}
            {(qa.length > 0 || (loading && pendingQ)) && (
              <div className="mt-8 border-t border-border pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Conversation
                  </div>
                  {EARLIER && (
                    <button
                      onClick={() => setShowEarlier((v) => !v)}
                      className="shrink-0 text-xs text-muted-foreground transition hover:text-foreground"
                    >
                      {showEarlier ? "Hide earlier notes" : "View earlier notes"}
                    </button>
                  )}
                </div>
                <div className="mt-4 space-y-5">
                  {visibleQa.map((ex, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex gap-3">
                        <span className="mt-0.5 w-9 shrink-0 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                          You
                        </span>
                        <p className="flex-1 text-body">{ex.q}</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="mt-0.5 w-9 shrink-0 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                          Kiwi
                        </span>
                        <div className="min-w-0 flex-1 text-body">
                          <MessageResponse>{ex.a}</MessageResponse>
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && pendingQ && (
                    <div className="space-y-2">
                      <div className="flex gap-3">
                        <span className="mt-0.5 w-9 shrink-0 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                          You
                        </span>
                        <p className="flex-1 text-body">{pendingQ}</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="w-9 shrink-0" />
                        <ReasoningStages stages={["Thinking it through"]} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Retrieval card — kept for the RAG demo, quiet + collapsed */}
            {tool && tool.considered.length > 0 && (
              <div className="mt-6">
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
              </div>
            )}
          </div>
        )}

        {/* Follow-up input — below the whole recommendation section, in-flow */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-10 border-t border-border pt-6"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 transition focus-within:border-primary/50">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this pick, or search for something else…"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-primary p-2 text-primary-foreground transition hover:bg-primary-hover disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <Link
            href="/recipes"
            className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Browse all recipes <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </form>
      </main>
    );
  }

  // ── Planner home — concierge, not a catalog ────────────────────────────
  return (
    <main className="mx-auto w-full max-w-[1120px] px-6 pb-28 pt-20 sm:pt-28">
      <section className="max-w-[880px]">
        <h1 className="font-headline text-[2.5rem] font-medium leading-[1.1] tracking-tight text-foreground sm:text-[2.75rem]">
          What are we baking today?
        </h1>
        <p className="mt-4 max-w-[600px] text-[1.05rem] leading-[1.55] text-body">
          Tell me what you&apos;re craving, how much time you have, or what ingredients
          you want to use up. From quick cookies to weekend bread projects, I&apos;ll
          help you find the right bake.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-8"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 shadow-[0_1px_2px_rgba(59,50,42,0.03),0_6px_18px_-12px_rgba(59,50,42,0.10)] transition focus-within:border-primary/50">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="I want something sweet…"
              className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-xl bg-primary p-2.5 text-primary-foreground transition hover:bg-primary-hover disabled:opacity-40"
              aria-label="Plan a bake"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Try asking:</span>
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full px-3.5 py-1.5 text-sm text-body ring-1 ring-foreground/15 transition hover:text-foreground hover:ring-foreground/30"
              >
                {q}
              </button>
            ))}
          </div>
        </form>

        <Link
          href="/recipes"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition hover:text-primary-hover"
        >
          No idea? Browse the collection
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Today's Inspiration — a quiet magazine note, stacked. No image/card/container. */}
      {featured && (
        <section className="mt-10 max-w-[880px] pl-7">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Today&apos;s Inspiration
          </div>
          <h2 className="mt-3 font-display text-xl tracking-tight text-foreground">
            {featured.title}
          </h2>
          <p className="mt-2 font-display text-[0.95rem] italic leading-relaxed text-body">
            {featured.note.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
          <Link
            href={`/recipe/${featured.slug}`}
            className="mt-4 inline-flex text-sm font-medium text-primary transition hover:text-primary-hover"
          >
            View recipe →
          </Link>
        </section>
      )}
    </main>
  );
}
