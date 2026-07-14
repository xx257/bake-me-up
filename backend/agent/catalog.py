"""Recipe catalog loader (v2).

Serves both modes:
- Planning: `profile_text()` is embedded into Qdrant; `card()` is the UI-facing metadata.
- Baking: `get_body()` returns the full normalized markdown for the coach's context.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_CATALOG_PATH = Path(__file__).parent / "catalog.json"

# Fields sent back to the UI as a recommendation card (everything except the heavy body).
_CARD_FIELDS = (
    "id",
    "slug",
    "title",
    "category",
    "difficulty",
    "total_time_min",
    "active_time_min",
    "tags",
)


@lru_cache(maxsize=1)
def get_catalog() -> list[dict]:
    if not _CATALOG_PATH.exists():
        return []
    return json.loads(_CATALOG_PATH.read_text())


@lru_cache(maxsize=1)
def _by_id() -> dict[str, dict]:
    return {r["id"]: r for r in get_catalog()}


def get_entry(recipe_id: str) -> dict | None:
    return _by_id().get(recipe_id)


def get_body(recipe_id: str) -> str | None:
    entry = get_entry(recipe_id)
    return entry.get("body") if entry else None


def card(entry: dict) -> dict:
    c = {k: entry.get(k) for k in _CARD_FIELDS}
    # UI expects `est_time_min` on the card.
    c["est_time_min"] = entry.get("total_time_min")
    return c


def profile_text(entry: dict) -> str:
    """Semantic blob embedded for planning-mode retrieval."""
    j = lambda xs: ", ".join(xs or [])  # noqa: E731
    return (
        f"{entry['title']}. {entry.get('summary', '')} "
        f"Category: {entry['category']['label']}. Difficulty: {entry.get('difficulty')}. "
        f"About {entry.get('total_time_min')} minutes (~{entry.get('active_time_min')} active). "
        f"Taste: {j(entry.get('taste'))}. Texture: {j(entry.get('texture'))}. "
        f"Good for: {j(entry.get('occasion'))}. Pairs with: {j(entry.get('pairs_with'))}. "
        f"Key ingredients: {j(entry.get('ingredients', [])[:8])}. "
        f"Skills: {j(entry.get('skills'))}. Tags: {j(entry.get('tags'))}."
    )
