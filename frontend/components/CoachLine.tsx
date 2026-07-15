import type { ReactNode } from "react";

// A woven coach line — the companion talking you through it. Typographic and quiet
// (a small rose marker, not a mascot), so recipe content and coaching read as one flow.
export default function CoachLine({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`flex gap-2.5 text-[0.95rem] leading-relaxed text-muted-foreground ${className}`}
    >
      <span
        aria-hidden
        className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-primary/50"
      />
      <span>{children}</span>
    </p>
  );
}
