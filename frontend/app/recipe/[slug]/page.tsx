import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getRecipe, getSlugs } from "@/lib/recipes";
import RecipeWorkspace from "@/components/RecipeWorkspace";

export function generateStaticParams() {
  return getSlugs().map((slug) => ({ slug }));
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getSlugs().includes(slug)) notFound();
  const recipe = getRecipe(slug);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" /> All recipes
      </Link>
      <RecipeWorkspace recipe={recipe} />
    </main>
  );
}
