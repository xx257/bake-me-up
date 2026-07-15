import Link from "next/link";
import { getAllRecipes } from "@/lib/recipes";
import RecipeCard from "@/components/RecipeCard";

export default function RecipesPage() {
  const recipes = getAllRecipes();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <header className="mb-8 border-b border-border/60 pb-4">
        <h1 className="font-display text-4xl font-normal tracking-tight text-foreground">
          My Baking Collection
        </h1>
        <p className="mt-2 text-body">
          {recipes.length} recipes in your kitchen. Not sure what to make? Start in the{" "}
          <Link href="/" className="text-primary hover:underline">
            Kitchen
          </Link>{" "}
          and I&apos;ll help you choose.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((r) => (
          <RecipeCard
            key={r.slug}
            slug={r.slug}
            title={r.title}
            categoryLabel={r.category.label}
            emoji={r.category.emoji}
            difficulty={r.difficulty?.level}
            estTimeMin={r.estTimeMin}
          />
        ))}
      </div>
    </main>
  );
}
