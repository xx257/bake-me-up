import type { MetaCard } from "@/lib/recipes";

export default function MetaCards({ cards }: { cards: MetaCard[] }) {
  if (!cards.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl bg-secondary/50 px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {c.label}
          </div>
          <div className="mt-0.5 text-sm font-medium">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
