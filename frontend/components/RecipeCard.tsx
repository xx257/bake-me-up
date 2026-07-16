import Link from "next/link";
import { Clock } from "lucide-react";
import RecipeImage from "./RecipeImage";
import { formatMinutes } from "@/lib/format";

export type RecipeCardData = {
  slug: string;
  title: string;
  categoryLabel: string;
  emoji: string;
  difficulty?: string;
  estTimeMin?: number;
};

// Soft, borderless recipe card — a page in the cookbook, not a shadcn panel.
export default function RecipeCard({
  slug,
  title,
  categoryLabel,
  emoji,
  difficulty,
  estTimeMin,
}: RecipeCardData) {
  return (
    <Link
      href={`/recipe/${slug}`}
      className="group overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(59,50,42,0.04),0_8px_24px_-12px_rgba(59,50,42,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(59,50,42,0.06),0_16px_32px_-14px_rgba(59,50,42,0.26)]"
    >
      <RecipeImage slug={slug} emoji={emoji} alt={title} className="h-44 w-full" />
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{categoryLabel}</span>
          {difficulty && (
            <>
              <span aria-hidden>·</span>
              <span className="capitalize">{difficulty}</span>
            </>
          )}
          {estTimeMin && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {formatMinutes(estTimeMin)}
              </span>
            </>
          )}
        </div>
        <h3 className="font-display mt-1 text-lg leading-snug">{title}</h3>
      </div>
    </Link>
  );
}
