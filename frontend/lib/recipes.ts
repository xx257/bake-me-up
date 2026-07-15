import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { load as loadYaml } from "js-yaml";
import { formatMinutes } from "@/lib/format";

// Populated at build time by scripts/sync-recipes.mjs (predev / prebuild).
const RECIPES_DIR = join(process.cwd(), "content", "recipes");

// Precomputed step coaching (Coach Mode), keyed by slug → per-step { title, note, questions }.
type StepQuestions = Record<string, { title: string; note?: string; questions: string[] }[]>;
const STEP_QUESTIONS: StepQuestions = (() => {
  try {
    const raw = readFileSync(join(process.cwd(), "content", "step-questions.json"), "utf8");
    return JSON.parse(raw) as StepQuestions;
  } catch {
    return {};
  }
})();

const normTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Attach cached questions to steps, but only when the cache still lines up with the recipe
// (title matches at the same index) — a stale or missing cache fails safe to no questions.
function attachQuestions(slug: string, steps: Step[]): void {
  const cached = STEP_QUESTIONS[slug];
  for (const step of steps) {
    const entry = cached?.[step.index - 1];
    const matches = entry && normTitle(entry.title) === normTitle(step.title);
    if (matches && entry.questions?.length) step.questions = entry.questions;
    // Instructor tip wins; the generated note only fills the gap.
    step.note = step.tip ?? (matches ? entry.note : undefined) ?? undefined;
  }
}

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

export type IngredientItem = { qty: string; name: string };
export type IngredientGroup = { name?: string; items: IngredientItem[] };
export type MetaCard = { label: string; value: string };
export type Troubleshoot = { q: string; a: string };

// One baking step — structured for step cards + guided mode.
export type Step = {
  index: number;
  title: string;
  body: string;
  activeMin: number;
  passiveMin: number;
  minutes: number;
  completion: string[];
  temperature?: string;
  equipment?: string;
  tip?: string; // instructor tip auto-mapped to this step
  note?: string; // Coach Mode guidance: instructor tip if present, else generated
  questions?: string[]; // precomputed Coach Mode suggestions for this step
};

export type Recipe = RecipeMeta & {
  body: string; // fallback full prose
  description: string;
  pan?: string;
  bakeTemp?: string;
  metaCards: MetaCard[];
  ingredientGroups: IngredientGroup[];
  steps: Step[];
  timeline: string[];
  generalNotes: string[];
  troubleshooting: Troubleshoot[];
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

function stripWorkflow(body: string): string {
  return body
    .replace(/####\s*Workflow\s*```yaml[\s\S]*?```/gi, "")
    .replace(/\n-{3,}\s*(?=\n)/g, "");
}

function h2Sections(content: string): { heading: string; body: string }[] {
  return content
    .split(/\n(?=##[^#])/)
    .map((part) => {
      const m = part.match(/^##\s+(.+?)\n([\s\S]*)$/);
      return m ? { heading: m[1].trim(), body: m[2] } : null;
    })
    .filter((s): s is { heading: string; body: string } => s !== null);
}

function section(content: string, name: string) {
  return h2Sections(content).find((s) => s.heading.toLowerCase() === name.toLowerCase());
}

function description(content: string): string {
  const para: string[] = [];
  let started = false;
  for (const line of content.split("\n")) {
    if (!started) {
      started = line.startsWith("# ");
      continue;
    }
    if (line.startsWith("#")) break;
    if (!line.trim()) {
      if (para.length) break;
      continue;
    }
    para.push(line.trim());
  }
  return para.join(" ").trim();
}

// ── Workflow YAML helpers ────────────────────────────────────────────────────

type Dur = Record<string, unknown> | undefined;

function pickMinutes(dur: Dur, key: string): number {
  const v = dur?.[key];
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "max" in (v as Record<string, unknown>)) {
    return Number((v as { max: number }).max) || 0;
  }
  return 0;
}

function fmtVal(v: unknown): string {
  if (v && typeof v === "object" && "min" in (v as Record<string, unknown>)) {
    const o = v as { min: number; max: number };
    return `${o.min}–${o.max}`;
  }
  return String(v);
}

function humanize(key: string): string {
  const s = key.replace(/_c$/, "").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtCriterion(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const [k, v] = Object.entries(item as Record<string, unknown>)[0] ?? ["", ""];
    const val = fmtVal(v);
    if (/temperature_c$/.test(k)) return `${humanize(k)} ${val}°C`;
    if (k === "texture") return val;
    if (k === "pan_height_percent") return `${val}% of pan height`;
    if (k === "pieces") return `${val} pieces`;
    if (/piece_weight_g$/.test(k)) return `${val} g pieces`;
    if (k === "dough_diameter_in") return `${val}" diameter`;
    return `${humanize(k)} ${val}`.trim();
  }
  return String(item);
}

function stepTemperature(completion: unknown[], wf: Record<string, unknown>): string | undefined {
  for (const item of completion) {
    if (item && typeof item === "object") {
      const [k, v] = Object.entries(item as Record<string, unknown>)[0] ?? ["", ""];
      if (/temperature_c$/.test(k)) return `${fmtVal(v)}°C`;
    }
  }
  const env = wf.environment as Record<string, unknown> | undefined;
  if (env?.temperature_c) return `${env.temperature_c}°C`;
  return undefined;
}

function stepEquipment(wf: Record<string, unknown>): string | undefined {
  const eq = (wf.equipment ?? wf.oven) as Record<string, unknown> | undefined;
  if (!eq) return undefined;
  const conv = (eq.convection ?? eq) as Record<string, unknown>;
  if (conv?.temperature_c) return `${conv.temperature_c}°C oven`;
  return undefined;
}

function parseSteps(content: string): Step[] {
  const s = section(content, "steps");
  if (!s) return [];
  return s.body
    .split(/\n(?=###[^#])/)
    .filter((b) => /^###\s/.test(b.trim()))
    .map((b, i) => {
      const titleLine = b.trim().split("\n")[0].replace(/^###\s+/, "");
      const title = titleLine.replace(/^Step\s+\d+\s*[—-]\s*/i, "").trim();
      const recipeMatch = b.match(/####\s*Recipe\s*([\s\S]*?)(?=####\s*Workflow|$)/i);
      const bodyText = (recipeMatch ? recipeMatch[1] : b.replace(/^###.*\n/, ""))
        .replace(/\n-{3,}\s*$/g, "")
        .trim();

      let activeMin = 0;
      let passiveMin = 0;
      let completion: string[] = [];
      let temperature: string | undefined;
      let equipment: string | undefined;

      const wfBlock = b.match(/####\s*Workflow\s*```yaml([\s\S]*?)```/i);
      if (wfBlock) {
        try {
          const wf = (loadYaml(wfBlock[1]) ?? {}) as Record<string, unknown>;
          const dur = wf.duration as Dur;
          activeMin = pickMinutes(dur, "active_min");
          passiveMin = pickMinutes(dur, "passive_min");
          const crit = Array.isArray(wf.completion) ? wf.completion : [];
          completion = crit.map(fmtCriterion);
          temperature = stepTemperature(crit, wf);
          equipment = stepEquipment(wf);
        } catch {
          /* leave defaults on malformed yaml */
        }
      }

      return {
        index: i + 1,
        title,
        body: bodyText,
        activeMin,
        passiveMin,
        minutes: activeMin + passiveMin,
        completion,
        temperature,
        equipment,
      };
    });
}

// ── Ingredients ──────────────────────────────────────────────────────────────

const QTY_RE = /^-\s*([\d.,/]+\s*(?:g|kg|ml|l|tsp|tbsp|cup|cups|oz|lb)\b\.?)\s+(.+)$/i;

function parseIngredients(content: string): IngredientGroup[] {
  const s = section(content, "ingredients");
  if (!s) return [];
  // Split into `### Subsection` groups; text before the first `###` is a default group.
  const parts = s.body.split(/\n(?=###[^#])/);
  const groups: IngredientGroup[] = [];
  for (const part of parts) {
    const headed = part.match(/^###\s+(.+)/);
    const name = headed ? headed[1].trim() : undefined;
    const items: IngredientItem[] = [];
    for (const line of part.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("-") || t.startsWith("**")) continue;
      const m = t.match(QTY_RE);
      if (m) items.push({ qty: m[1].trim(), name: m[2].trim() });
      else items.push({ qty: "", name: t.replace(/^-\s*/, "") });
    }
    if (items.length) groups.push({ name, items });
  }
  return groups;
}

// ── Meta cards ───────────────────────────────────────────────────────────────

function parseMetaCards(data: Record<string, unknown>, content: string): MetaCard[] {
  const cards: MetaCard[] = [];
  const push = (label: string, value?: string | number) => {
    if (value !== undefined && value !== null && String(value).trim())
      cards.push({ label, value: String(value) });
  };
  const y = (data.yield ?? {}) as Record<string, unknown>;
  push("Yield", y.units as string);
  if (y.total_dough_g) push("Dough", `${y.total_dough_g} g`);
  if (data.est_time_min) push("Total time", formatMinutes(Number(data.est_time_min)));
  const oven = (data.equipment as Record<string, unknown>)?.oven as Record<string, unknown> | undefined;
  const conv = (oven?.convection ?? oven?.conventional) as Record<string, unknown> | undefined;
  if (conv?.temperature_c) push("Bake", `${conv.temperature_c}°C`);

  const summary = section(content, "recipe summary");
  if (summary) {
    const wanted = /dough temperature|first (proof|fermentation)|final proof|bench rest|bake time/i;
    for (const m of summary.body.matchAll(/^-\s*([^:\n]+):\s*(.+)$/gm)) {
      const label = m[1].trim();
      if (wanted.test(label) && !cards.some((c) => c.label.toLowerCase() === label.toLowerCase())) {
        cards.push({ label, value: m[2].trim() });
      }
    }
  }
  return cards;
}

// ── Instructor tips → steps (keyword mapping) ────────────────────────────────

const STOP = new Set([
  "the", "and", "for", "with", "your", "you", "when", "before", "after", "not",
  "just", "are", "more", "than", "should", "better", "provides", "making", "exact",
  "into", "over", "from", "this", "that", "each", "keep", "will", "does",
]);

function words(s: string): string[] {
  return (s.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w));
}

function parseTips(content: string): string[] {
  const s = section(content, "instructor tips") ?? section(content, "instructor notes");
  if (!s) return [];
  return [...s.body.matchAll(/^-\s+(.+)$/gm)].map((m) => m[1].trim());
}

function mapTips(tips: string[], steps: Step[]): { steps: Step[]; general: string[] } {
  const general: string[] = [];
  const titleWords = steps.map((st) => new Set(words(st.title)));
  for (const tip of tips) {
    const tw = new Set(words(tip));
    let best = -1;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].tip) continue; // one tip per step, keep it tidy
      if ([...titleWords[i]].some((w) => tw.has(w))) {
        best = i;
        break;
      }
    }
    if (best >= 0) steps[best].tip = tip;
    else general.push(tip);
  }
  return { steps, general };
}

// ── Troubleshooting ──────────────────────────────────────────────────────────

function parseTroubleshooting(content: string): Troubleshoot[] {
  const s = section(content, "troubleshooting");
  if (!s) return [];
  return s.body
    .split(/\n(?=###[^#])/)
    .filter((b) => /^###\s/.test(b.trim()))
    .map((b) => {
      const [head, ...rest] = b.trim().split("\n");
      const q = head.replace(/^###\s+/, "").trim();
      const a = rest
        .join("\n")
        .replace(/\*\*Related topics:\*\*[\s\S]*/i, "")
        .trim();
      return { q, a };
    });
}

// ── Assemble ─────────────────────────────────────────────────────────────────

function parse(slug: string): Recipe {
  const raw = readFileSync(join(RECIPES_DIR, `${slug}.md`), "utf8");
  const { data, content } = matter(raw);
  const tags: string[] = data.tags ?? [];

  const rawSteps = parseSteps(content);
  const { steps, general } = mapTips(parseTips(content), rawSteps);
  attachQuestions(slug, steps);
  const troubleshooting = parseTroubleshooting(content);
  const oven = data.equipment?.oven;
  const conv = oven?.convection ?? oven?.conventional;

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
    description: description(content),
    pan: data.equipment?.pan?.type,
    bakeTemp: conv?.temperature_c ? `${conv.temperature_c}°C` : undefined,
    metaCards: parseMetaCards(data, content),
    ingredientGroups: parseIngredients(content),
    steps,
    timeline: steps.map((s) => s.title),
    generalNotes: general,
    troubleshooting,
    suggestions: troubleshooting.map((t) => t.q),
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
