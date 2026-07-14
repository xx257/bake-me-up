// Copies the recipe corpus (repo/data/recipes/*.md) into frontend/content/recipes
// so the app can read it self-contained at build time (works on Vercel regardless of
// the configured root directory). Runs automatically via predev / prebuild.
import { readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "data", "recipes"); // repo/data/recipes
const dest = join(here, "..", "content", "recipes"); // frontend/content/recipes
const SKIP = new Set(["TEMPLATE.md", "README.md"]);

mkdirSync(dest, { recursive: true });
let n = 0;
for (const f of readdirSync(src)) {
  if (!f.endsWith(".md") || SKIP.has(f)) continue;
  copyFileSync(join(src, f), join(dest, f));
  n++;
}
console.log(`[sync-recipes] copied ${n} recipes -> content/recipes`);
