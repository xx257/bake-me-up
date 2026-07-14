import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

// Populated at build time by scripts/sync-recipes.mjs (predev / prebuild).
const RECIPES_DIR = join(process.cwd(), "content", "recipes");

export type Difficulty = { level?: string; skills?: string[] };

export type RecipeMeta = {
  slug: string;
  id: string;
  title: string;
  tags: string[];
  aliases: string[];
  difficulty?: Difficulty;
  estTimeMin?: number;
  yieldUnits?: string;
  source?: string;
  category: { label: string; emoji: string };
};

// One baking step, for Guided Baking mode.
export type Step = { index: number; title: string; body: string; minutes: number };

export type Recipe = RecipeMeta & {
  body: string;
  steps: Step[];
  suggestions: string[];
  totalMinutes: number;
};

const CATEGORIES = [
  { match: "bread", label: "Bread", emoji: "🍞" },
  { match: "cake", label: "Cake", emoji: "🍰" },
  { match: "cookies", label: "Cookies", emoji: "🍪" },
  { match: "mochi", label: "Mochi", emoji: "🍡" },
];

function categoryOf(tags: string[]) {
  for (const c of CATEGORIES) {
    if (tags.some((t) => t.toLowerCase().includes(c.match))) {
      return { label: c.label, emoji: c.emoji };
    }
  }
  return { label: "Dessert", emoji: "🍮" };
}

function sourceName(src: unknown): string | undefined {
  if (!src) return undefined;
  if (typeof src === "string") return src;
  if (typeof src === "object" && "name" in (src as Record<string, unknown>)) {
    return String((src as { name: unknown }).name);
  }
  return undefined;
}

// Keep only the prose the RAG uses: drop the per-step `#### Workflow` YAML blocks
// (they're machine metadata) and the `---` step separators.
function stripWorkflow(body: string): string {
  return body
    .replace(/####\s*Workflow\s*```yaml[\s\S]*?```/gi, "")
    .replace(/\n-{3,}\s*(?=\n)/g, "");
}

// Split a recipe body into its `## Heading` sections (skips the H1/intro).
function h2Sections(content: string): { heading: string; body: string }[] {
  return content
    .split(/\n(?=##[^#])/)
    .map((part) => {
      const m = part.match(/^##\s+(.+?)\n([\s\S]*)$/);
      return m ? { heading: m[1].trim(), body: m[2] } : null;
    })
    .filter((s): s is { heading: string; body: string } => s !== null);
}

// Minutes from a `#### Workflow` YAML block (active + passive; ranges use the max).
function stepMinutes(workflow: string): number {
  const pick = (key: string): number => {
    const inline = workflow.match(new RegExp(`${key}:\\s*(\\d+)`));
    if (inline) return Number(inline[1]);
    const range = workflow.match(
      new RegExp(`${key}:\\s*\\n\\s*min:\\s*(\\d+)\\s*\\n\\s*max:\\s*(\\d+)`),
    );
    if (range) return Number(range[2]);
    return 0;
  };
  return pick("active_min") + pick("passive_min");
}

function parseSteps(content: string): Step[] {
  const section = h2Sections(content).find((s) => s.heading.toLowerCase() === "steps");
  if (!section) return [];
  return section.body
    .split(/\n(?=###[^#])/)
    .filter((b) => /^###\s/.test(b.trim()))
    .map((b, i) => {
      const titleLine = b.trim().split("\n")[0].replace(/^###\s+/, "");
      const title = titleLine.replace(/^Step\s+\d+\s*[—-]\s*/i, "").trim();
      const recipeMatch = b.match(/####\s*Recipe\s*([\s\S]*?)(?=####\s*Workflow|$)/i);
      const prose = (recipeMatch ? recipeMatch[1] : b.replace(/^###.*\n/, ""))
        .replace(/\n-{3,}\s*$/g, "")
        .trim();
      const wf = b.match(/####\s*Workflow\s*```yaml([\s\S]*?)```/i);
      return { index: i + 1, title, body: prose, minutes: wf ? stepMinutes(wf[1]) : 0 };
    });
}

// Recipe-specific suggested questions, sourced from the recipe's own Troubleshooting Q&A.
function parseTroubleshooting(content: string): string[] {
  const section = h2Sections(content).find(
    (s) => s.heading.toLowerCase() === "troubleshooting",
  );
  if (!section) return [];
  return [...section.body.matchAll(/^###\s+(.+)$/gm)].map((m) => m[1].trim());
}

function parse(slug: string): Recipe {
  const raw = readFileSync(join(RECIPES_DIR, `${slug}.md`), "utf8");
  const { data, content } = matter(raw);
  const tags: string[] = data.tags ?? [];
  const steps = parseSteps(content);
  return {
    slug,
    id: data.id ?? slug,
    title: data.title ?? slug,
    tags,
    aliases: data.aliases ?? [],
    difficulty: data.difficulty,
    estTimeMin: data.est_time_min,
    yieldUnits: data.yield?.units,
    source: sourceName(data.source),
    category: categoryOf(tags),
    body: stripWorkflow(content).trim(),
    steps,
    suggestions: parseTroubleshooting(content),
    totalMinutes: steps.reduce((sum, s) => sum + s.minutes, 0),
  };
}

export function getSlugs(): string[] {
  return readdirSync(RECIPES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export function getAllRecipes(): RecipeMeta[] {
  return getSlugs()
    .map((s): RecipeMeta => {
      const r = parse(s);
      return {
        slug: r.slug,
        id: r.id,
        title: r.title,
        tags: r.tags,
        aliases: r.aliases,
        difficulty: r.difficulty,
        estTimeMin: r.estTimeMin,
        yieldUnits: r.yieldUnits,
        source: r.source,
        category: r.category,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getRecipe(slug: string): Recipe {
  return parse(slug);
}
