"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

// A quiet, staged "what the agent is doing" indicator, shown while a turn is in flight —
// in place of a bare "Thinking…". The stages mirror the real pipeline (e.g. planning:
// extract intent → retrieve profiles → rank).
export default function ReasoningStages({ stages }: { stages: string[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    const id = setInterval(
      () => setActive((a) => Math.min(a + 1, stages.length - 1)),
      1100,
    );
    return () => clearInterval(id);
  }, [stages.length]);

  return (
    <div className="space-y-2 py-1">
      {stages.map((s, i) => (
        <div
          key={s}
          className={`flex items-center gap-2 text-sm transition-colors duration-300 ${
            i <= active ? "text-foreground" : "text-muted-foreground/40"
          }`}
        >
          {i < active ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
          ) : i === active ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
          ) : (
            <span className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{s}</span>
        </div>
      ))}
    </div>
  );
}
