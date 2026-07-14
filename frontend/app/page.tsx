"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Clock, Send } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { formatMinutes } from "@/lib/format";

const PROMPTS = [
  "I only have one hour",
  "Something for breakfast",
  "I have red bean paste",
  "I only have bread flour",
  "Beginner friendly",
  "Dessert for friends tonight",
];

type Msg = { role: "user" | "assistant"; content: string };
type Card = {
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
  const [cards, setCards] = useState<Card[]>([]);
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
      if (d.recommendations?.length) setCards(d.recommendations);
    } catch {
      toast.error("Couldn't reach the planner. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const started = messages.length > 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      {!started ? (
        <div className="mt-10 text-center">
          <div className="text-5xl" aria-hidden>
            🍞
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            What would you like to bake today?
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            Tell me your time, ingredients, or the occasion — I&apos;ll suggest the best
            recipe and bake it with you.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="mx-auto mt-6 flex max-w-xl items-center gap-2"
          >
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. I need dessert for friends tonight"
              className="flex-1 rounded-full border border-border bg-card px-5 py-3 text-sm outline-none transition focus:border-accent"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-full bg-accent p-3 text-white transition disabled:opacity-40"
              aria-label="Ask"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="mx-auto mt-4 flex max-w-xl flex-wrap justify-center gap-2">
            {PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:border-accent hover:text-accent"
              >
                {p}
              </button>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted">
            Already know what you want?{" "}
            <Link href="/recipes" className="text-accent hover:underline">
              Browse all recipes
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-24">
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              {m.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-4 py-2 text-sm text-white">
                  {m.content}
                </div>
              ) : (
                <div className="prose prose-sm prose-stone max-w-none rounded-2xl border border-border bg-card px-4 py-2 dark:prose-invert">
                  <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
                </div>
              )}
            </div>
          ))}

          {loading && <div className="text-sm text-muted">Thinking…</div>}

          {cards.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {cards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/recipe/${c.slug}`)}
                  className="group rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>
                      {c.category.emoji} {c.category.label}
                    </span>
                    {c.difficulty && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="capitalize">{c.difficulty}</span>
                      </>
                    )}
                    {c.est_time_min && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {formatMinutes(c.est_time_min)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="mt-1 font-medium transition group-hover:text-accent">
                    {c.title}
                  </div>
                  <p className="mt-1 text-sm text-muted">{c.why}</p>
                  <div className="mt-2 text-xs font-medium text-accent">Choose recipe →</div>
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="fixed inset-x-0 bottom-4 mx-auto flex w-full max-w-2xl items-center gap-2 rounded-full border border-border bg-card px-2 py-1 shadow-lg"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Refine or ask a follow-up…"
              className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
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
      )}
    </main>
  );
}
