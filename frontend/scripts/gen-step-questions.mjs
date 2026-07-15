// Precompute step-specific suggested questions for Coach Mode.
//
// The recipe corpus is static, so we generate 2–3 natural, step-tailored questions per
// step ONCE via the LLM and commit the result — no per-step latency, no runtime cost, and
// the build needs no gateway key. Re-run manually whenever the recipes change:
//
//   AI_GATEWAY_BASE_URL=… AI_GATEWAY_API_KEY=… node scripts/gen-step-questions.mjs
//
// (If those aren't exported, we fall back to reading repo/backend/.env.)
//
// Output: repo/data/step-questions.json  ->  synced into content/ by sync-recipes.mjs.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const RECIPES_DIR = join(repo, "data", "recipes");
const OUT = join(repo, "data", "step-questions.json");
const SKIP = new Set(["TEMPLATE.md", "README.md"]);
const MODEL = process.env.QUESTION_MODEL ?? process.env.CHAT_MODEL ?? "gpt-4.1";

// ── gateway credentials (env first, then backend/.env) ───────────────────────
function loadEnvFallback() {
  if (process.env.AI_GATEWAY_BASE_URL && process.env.AI_GATEWAY_API_KEY) return;
  const envPath = join(repo, "backend", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const val = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnvFallback();

const BASE = process.env.AI_GATEWAY_BASE_URL;
const KEY = process.env.AI_GATEWAY_API_KEY;
if (!BASE || !KEY) {
  console.error(
    "[gen-step-questions] Missing AI_GATEWAY_BASE_URL / AI_GATEWAY_API_KEY " +
      "(export them or add them to backend/.env).",
  );
  process.exit(1);
}

// ── light step parsing (generation input only; mirrors lib/recipes.ts) ────────
function stepsSection(content) {
  const parts = content.split(/\n(?=##[^#])/);
  for (const part of parts) {
    const m = part.match(/^##\s+(.+?)\n([\s\S]*)$/);
    if (m && m[1].trim().toLowerCase() === "steps") return m[2];
  }
  return "";
}

function parseSteps(content) {
  const body = stepsSection(content);
  if (!body) return [];
  return body
    .split(/\n(?=###[^#])/)
    .filter((b) => /^###\s/.test(b.trim()))
    .map((b, i) => {
      const titleLine = b.trim().split("\n")[0].replace(/^###\s+/, "");
      const title = titleLine.replace(/^Step\s+\d+\s*[—-]\s*/i, "").trim();
      const recipeMatch = b.match(/####\s*Recipe\s*([\s\S]*?)(?=####\s*Workflow|$)/i);
      const prose = (recipeMatch ? recipeMatch[1] : "")
        .replace(/\n-{3,}\s*$/g, "")
        .trim();
      const wf = b.match(/####\s*Workflow\s*```yaml([\s\S]*?)```/i);
      let criteria = "";
      if (wf) {
        const cm = wf[1].match(/completion:\s*([\s\S]*?)(?:\nnext_step:|\n[a-z_]+:|$)/i);
        if (cm) criteria = cm[1].trim();
      }
      return { index: i + 1, title, prose, criteria };
    });
}

// ── LLM call (OpenAI-compatible gateway) ─────────────────────────────────────
async function generateForRecipe(recipe) {
  const stepList = recipe.steps
    .map(
      (s) =>
        `Step ${s.index} — ${s.title}\nInstruction: ${s.prose || "(none)"}\n` +
        `Ready when: ${s.criteria || "(no explicit criteria)"}`,
    )
    .join("\n\n");

  const system =
    "You are Kiwi, a calm, confident baking coach walking a home baker through a recipe one " +
    "step at a time. For each step produce two things:\n" +
    "1. note: 1–2 short paragraphs (≤ ~35 words each) of proactive coaching for THIS step — " +
    "the key technique, what to watch for, or how to recover if it looks wrong. Calm, " +
    "confident, instructional. NO emojis, not chatty, don't just restate the instruction.\n" +
    "2. questions: exactly 3 short, natural questions the baker would ask RIGHT NOW at this " +
    "step — concrete and specific (reference its ingredients, technique, or success criteria). " +
    "Avoid yes/no questions, avoid 'what's next' (the UI adds that), avoid duplicates across " +
    "steps, keep each under ~10 words.\n" +
    "Return JSON only.";

  const user =
    `Recipe: ${recipe.title}` +
    (recipe.difficulty ? ` (difficulty: ${recipe.difficulty})` : "") +
    `\n\nSteps:\n\n${stepList}\n\n` +
    'Return JSON of the form {"steps":[{"index":1,"note":"...","questions":["...","...","..."]}, ' +
    "...]} with one entry per step, in order.";

  const res = await fetch(`${BASE.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${recipe.slug}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const content = data.choices[0].message.content.trim();
  // Model may wrap JSON in ```json fences; extract the outermost object.
  const jsonText = content.replace(/^```(?:json)?\s*|\s*```$/g, "").match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) throw new Error(`${recipe.slug}: no JSON in response: ${content.slice(0, 200)}`);
  const parsed = JSON.parse(jsonText);
  const byIndex = new Map((parsed.steps ?? []).map((s) => [Number(s.index), s]));
  return recipe.steps.map((s) => {
    const entry = byIndex.get(s.index) ?? {};
    return {
      title: s.title,
      note: entry.note ? String(entry.note).trim() : "",
      questions: (entry.questions ?? []).slice(0, 3).map((q) => String(q).trim()),
    };
  });
}

// ── main ─────────────────────────────────────────────────────────────────────
const slugs = readdirSync(RECIPES_DIR)
  .filter((f) => f.endsWith(".md") && !SKIP.has(f))
  .map((f) => f.replace(/\.md$/, ""));

const out = {};
for (const slug of slugs) {
  const { data, content } = matter(readFileSync(join(RECIPES_DIR, `${slug}.md`), "utf8"));
  const steps = parseSteps(content);
  if (!steps.length) {
    console.log(`[gen-step-questions] ${slug}: no steps, skipping`);
    continue;
  }
  const recipe = { slug, title: data.title ?? slug, difficulty: data.difficulty?.level, steps };
  process.stdout.write(`[gen-step-questions] ${slug} (${steps.length} steps)… `);
  out[slug] = await generateForRecipe(recipe);
  console.log("done");
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`[gen-step-questions] wrote ${Object.keys(out).length} recipes -> ${OUT}`);
