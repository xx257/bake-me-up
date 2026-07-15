"use client";

type TimelineStep = { index: number; title: string };

export default function RecipeTimeline({
  steps,
  active,
  variant,
  onJump,
}: {
  steps: TimelineStep[];
  active?: number;
  variant: "sidebar" | "bar";
  onJump: (index: number) => void;
}) {
  if (steps.length < 2) return null;

  // Vertical, sticky-friendly list for the desktop sidebar.
  if (variant === "sidebar") {
    return (
      <nav aria-label="Recipe steps">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Timeline
        </div>
        <ol className="space-y-0.5">
          {steps.map((s) => {
            const on = active === s.index;
            return (
              <li key={s.index}>
                <button
                  onClick={() => onJump(s.index)}
                  className={`flex w-full items-center gap-2.5 rounded-lg border-l-2 py-1.5 pl-3 pr-2 text-left text-sm transition ${
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <span className="text-[11px] tabular-nums opacity-60">{s.index}</span>
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  // Horizontal, single-row scrollable pills for mobile.
  return (
    <ol className="flex items-center gap-x-1.5 overflow-x-auto pb-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {steps.map((s, i) => {
        const on = active === s.index;
        return (
          <li key={s.index} className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => onJump(s.index)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 transition ${
                on
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-[11px] tabular-nums opacity-60">{s.index}</span>
              {s.title}
            </button>
            {i < steps.length - 1 && (
              <span className="text-muted-foreground/40" aria-hidden>
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
