"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Troubleshoot } from "@/lib/recipes";

export default function Troubleshooting({
  items,
  onAsk,
}: {
  items: Troubleshoot[];
  onAsk?: (q: string) => void;
}) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="font-display text-xl tracking-tight">Troubleshooting</h2>
      <div className="mt-3 space-y-2">
        {items.map((t, i) => (
          <details
            key={i}
            className="group rounded-xl bg-secondary/40 px-4 py-3 [&_summary]:cursor-pointer"
          >
            <summary className="flex items-center justify-between gap-2 text-sm font-medium marker:content-['']">
              <span>{t.q}</span>
              {onAsk && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onAsk(t.q);
                  }}
                  className="shrink-0 rounded-full bg-card px-2.5 py-1 text-xs text-primary transition hover:brightness-105"
                >
                  Ask coach
                </button>
              )}
            </summary>
            <div className="prose prose-sm prose-stone mt-2 max-w-none">
              <Markdown remarkPlugins={[remarkGfm]}>{t.a}</Markdown>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
