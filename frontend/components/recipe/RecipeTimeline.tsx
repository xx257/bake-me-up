export default function RecipeTimeline({
  steps,
  current,
}: {
  steps: string[];
  current?: number;
}) {
  if (steps.length < 2) return null;
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              current === i
                ? "bg-primary/15 text-primary"
                : "bg-secondary/50 text-muted-foreground"
            }`}
          >
            <span className="text-[11px] tabular-nums opacity-60">{i + 1}</span>
            {s}
          </span>
          {i < steps.length - 1 && (
            <span className="text-muted-foreground/40" aria-hidden>
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
