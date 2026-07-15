import Kitchen from "@/components/Kitchen";
import { getRecipe } from "@/lib/recipes";

// Kitchen = the AI planner. Pass one featured recipe for the empty-state "Today's Inspiration".
export default function Page() {
  const r = getRecipe("roll-cake");
  // A single featured pick for the quiet "Today's Inspiration" note — two short
  // editorial fragments, one per line.
  const featured = {
    slug: r.slug,
    title: r.title,
    note: ["Soft sponge. Fresh cream.", "A tumble of strawberries."],
  };
  return <Kitchen featured={featured} />;
}
