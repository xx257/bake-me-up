import Link from "next/link";
import { getAllRecipes } from "@/lib/recipes";

export default function Home() {
  const recipes = getAllRecipes();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Bake Me Up <span aria-hidden>🍞</span>
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Pick a recipe, then ask anything — an AI companion that knows it by heart and
          answers grounded in the recipe itself.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((r) => (
          <Link
            key={r.slug}
            href={`/recipe/${r.slug}`}
            className="group rounded-2xl border border-border bg-card p-1.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-50 text-5xl dark:from-amber-950/40 dark:to-orange-950/20">
              <span aria-hidden>{r.category.emoji}</span>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span>{r.category.label}</span>
                {r.difficulty?.level && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="capitalize">{r.difficulty.level}</span>
                  </>
                )}
              </div>
              <h2 className="mt-1 font-medium leading-snug transition group-hover:text-accent">
                {r.title}
              </h2>
              {r.yieldUnits && (
                <p className="mt-1 text-sm text-muted">{r.yieldUnits}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
