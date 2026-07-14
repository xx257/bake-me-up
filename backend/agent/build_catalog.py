"""Generate agent/catalog.json from the recipe corpus (v2).

Each entry carries (a) a recommendation profile for Planning Mode (embedded in Qdrant)
and (b) the full normalized recipe markdown for Baking Mode (loaded into the coach's
context). The deployed backend can't see data/recipes, so this is committed. Regenerate:

    uv run --project backend python -m agent.build_catalog
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

RECIPE_DIR = Path(__file__).resolve().parents[2] / "data" / "recipes"
OUT = Path(__file__).resolve().parent / "catalog.json"
SKIP = {"TEMPLATE.md", "README.md"}

CATEGORIES = [
    ("bread", "Bread", "🍞"),
    ("cake", "Cake", "🍰"),
    ("cookies", "Cookies", "🍪"),
    ("mochi", "Mochi", "🍡"),
]

_WORKFLOW_RE = re.compile(r"####\s*Workflow\s*```yaml.*?```", re.DOTALL | re.IGNORECASE)


def category_of(tags: list[str]) -> dict:
    for match, label, emoji in CATEGORIES:
        if any(match in t.lower() for t in tags):
            return {"label": label, "emoji": emoji}
    return {"label": "Dessert", "emoji": "🍮"}


def split_frontmatter(text: str) -> tuple[dict, str]:
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            return yaml.safe_load(text[3:end]) or {}, text[end + 4 :].lstrip("\n")
    return {}, text


def normalized_body(body: str) -> str:
    """Prose the coach reads — drop the machine-only #### Workflow blocks + rules."""
    body = _WORKFLOW_RE.sub("", body)
    body = re.sub(r"\n-{3,}\s*(?=\n)", "", body)
    return body.strip()


def ingredient_names(meta: dict) -> list[str]:
    names: list[str] = []
    components = (meta.get("scale") or {}).get("components") or {}
    for comp in components.values():
        for ing in comp.get("ingredients", []):
            if ing.get("name"):
                names.append(ing["name"])
        for formula in (comp.get("nested_formulas") or {}).values():
            for ing in formula.get("ingredients", []):
                if ing.get("name"):
                    names.append(ing["name"])
    seen: set[str] = set()
    return [n for n in names if not (n in seen or seen.add(n))]


def description(body: str) -> str:
    para: list[str] = []
    started = False
    for line in body.splitlines():
        if not started:
            started = line.startswith("# ")
            continue
        if line.startswith("#"):
            break
        if not line.strip():
            if para:
                break
            continue
        para.append(line.strip())
    return " ".join(para).strip()


def main() -> None:
    catalog = []
    for path in sorted(RECIPE_DIR.glob("*.md")):
        if path.name in SKIP:
            continue
        meta, body = split_frontmatter(path.read_text())
        tags = meta.get("tags") or []
        profile = meta.get("profile") or {}
        catalog.append(
            {
                "id": meta.get("id") or path.stem,
                "slug": path.stem,
                "title": meta.get("title") or path.stem,
                "category": category_of(tags),
                "difficulty": (meta.get("difficulty") or {}).get("level"),
                "skills": (meta.get("difficulty") or {}).get("skills", []),
                "total_time_min": meta.get("est_time_min"),
                "active_time_min": profile.get("active_time_min"),
                "taste": profile.get("taste", []),
                "texture": profile.get("texture", []),
                "occasion": profile.get("occasion", []),
                "pairs_with": profile.get("pairs_with", []),
                "tags": tags,
                "ingredients": ingredient_names(meta),
                "summary": description(body),
                "body": normalized_body(body),
            }
        )
    OUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2))
    print(f"Wrote {len(catalog)} recipes -> {OUT.relative_to(Path.cwd())}")


if __name__ == "__main__":
    main()
