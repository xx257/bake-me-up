"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { IngredientGroup } from "@/lib/recipes";

export default function IngredientGroups({ groups }: { groups: IngredientGroup[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  if (!groups.length) return null;

  const toggle = (k: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const done = checked.size;

  return (
    <div className="space-y-5">
      {total > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {done} / {total} prepared
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.name && (
            <h3 className="font-display text-base text-muted-foreground">{g.name}</h3>
          )}
          <ul className="mt-2 divide-y divide-border/50">
            {g.items.map((it, ii) => {
              const k = `${gi}-${ii}`;
              const on = checked.has(k);
              return (
                <li key={k}>
                  <button
                    onClick={() => toggle(k)}
                    className="flex w-full items-baseline gap-3 py-2 text-left"
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                        on ? "border-primary bg-primary text-white" : "border-border"
                      }`}
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span
                      className={`w-20 shrink-0 font-medium tabular-nums ${
                        on ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {it.qty}
                    </span>
                    <span className={on ? "text-muted-foreground line-through" : ""}>
                      {it.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
