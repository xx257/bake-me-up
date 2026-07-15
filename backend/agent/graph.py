"""Bake Me Up — Agentic RAG v2.

    START -> route -> { plan | bake | general }

Two phases, two architectures (see references/Bake_Me_Up_Product_Vision_Agentic_v1.md v2):

- Planning Mode  (plan): LLM intent extraction → structured prefs → Qdrant retrieval over
  recipe PROFILES → LLM rank + explain over the top candidates → recommendation cards.
- Baking Mode    (bake): load the FULL recipe markdown into context and coach over the
  whole workflow — no per-question retrieval.
- General        (general): general baking knowledge when nothing in the library matches.

Session memory (planning goal → baking) rides the LangGraph Platform checkpointer + a
per-session thread, so this graph is compiled without a checkpointer. Clients are lazy.
"""

from __future__ import annotations

import re
from typing import Annotated, Literal, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from langsmith import traceable
from pydantic import BaseModel, Field

from .catalog import get_body, get_catalog, get_entry
from .config import get_chat_llm
from .retrieval import retrieve_profiles

Mode = Literal["plan", "bake", "general"]


class State(TypedDict):
    messages: Annotated[list, add_messages]
    active_recipe: str | None  # recipe page: the user is actively baking this
    current_recommendation: str | None  # Kitchen: the pinned pick the user is evaluating
    mode: Mode
    recommendations: list
    tool: dict | None  # visible "tool call" from the plan lane (for the UI)
    context: str


def _last_user_text(messages: list) -> str:
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            return m.content
        if isinstance(m, dict) and m.get("role") == "user":
            return m["content"]
    return ""


def _recent_user_text(messages: list, n: int = 3) -> str:
    """Join the last up-to-n user turns so planning constraints carry across a short exchange
    ('something sweet under an hour' + 'cookies please'). Structured intent extraction
    downstream ignores non-baking chatter, so stray turns don't pollute retrieval."""
    texts: list[str] = []
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            texts.append(m.content)
        elif isinstance(m, dict) and m.get("role") == "user":
            texts.append(m["content"])
        if len(texts) >= n:
            break
    return "\n".join(reversed(texts))


def _library_titles() -> str:
    return ", ".join(r["title"] for r in get_catalog())


# Obvious "give me a different recipe" phrases → skip the LLM router, go straight to plan.
# `instead` matches only when NOT "instead of" (which is a substitution question about the pick).
_NEW_SEARCH_RE = re.compile(
    r"(\banything else\b|\bsomething else\b|\bshow me (another|something else)\b|"
    r"\banother (one|option|recipe|idea)\b|\ba different (one|recipe|option|idea)\b|"
    r"\bother (options?|recipes?|ideas?)\b|\bwhat else\b|\bnot (that|this) one\b|"
    r"\binstead\b(?!\s+of))",
    re.IGNORECASE,
)


def _wants_new_search(text: str) -> bool:
    return bool(_NEW_SEARCH_RE.search(text or ""))


def _title_for(recipe_id: str | None) -> str | None:
    entry = get_entry(recipe_id) if recipe_id else None
    return entry["title"] if entry else None


# ── Router ────────────────────────────────────────────────────────────────────


class _Route(BaseModel):
    mode: Mode = Field(description="plan | bake | general")


@traceable(name="classify_followup", run_type="chain")
def _route_followup(text: str, rec_title: str) -> Mode:
    """Pinned-pick turn: is this ABOUT the suggested recipe (bake), a new search (plan),
    or off-topic (general)? Covers the deterministic new-search shortcut + the LLM route."""
    if _wants_new_search(text):
        return "plan"
    router = get_chat_llm(mini=True).with_structured_output(_Route)
    system = SystemMessage(
        content=(
            f"The user is looking at a suggested recipe: {rec_title}. Route their turn:\n"
            f"- bake: a question or request ABOUT {rec_title} (ingredients, substitutions, "
            "timing, technique, difficulty, 'why this one', 'tell me more') — we answer "
            "grounded in it.\n"
            "- plan: they want a DIFFERENT recipe or another option (a new search).\n"
            "- general: a general baking question unrelated to this recipe, or off-topic.\n"
            "Return only the mode."
        )
    )
    try:
        return router.invoke([system, HumanMessage(content=text)]).mode
    except Exception:
        return "bake"


def route_node(state: State) -> dict:
    # Recipe page: a recipe is actively selected → always coach over it.
    if state.get("active_recipe"):
        return {"mode": "bake", "tool": None}

    text = _last_user_text(state["messages"])
    rec = state.get("current_recommendation")

    # Kitchen with a pinned recommendation: is this about that pick, or a new search?
    if rec:
        title = _title_for(rec) or "the suggested recipe"
        mode = _route_followup(text, title)
        # A re-plan clears the stale tool card; a bake/general follow-up leaves it untouched
        # so the UI keeps the pinned recommendation's retrieval card.
        return {"mode": "plan", "tool": None} if mode == "plan" else {"mode": mode}

    # Kitchen, no pick yet: plan a bake, or general (baking question / off-topic redirect).
    router = get_chat_llm(mini=True).with_structured_output(_Route)
    system = SystemMessage(
        content=(
            "Route a baking assistant's turn (no recipe is selected). Choose one:\n"
            "- plan: the user wants to bake something, or to make/find a recipe — by NAME "
            "('how do I make roll cake', 'anpan') or by CONSTRAINTS (time, taste, occasion, "
            "ingredients, skill). The library is searched afterward, so you do NOT need to "
            "know what's in it.\n"
            "- general: a general baking QUESTION (technique, concept, comparison, "
            "troubleshooting — e.g. 'how do I temper chocolate'), OR anything NOT about "
            "baking (weather, jokes, chit-chat). The general lane answers baking questions "
            "and redirects off-topic ones.\n"
            "Return only the mode."
        )
    )
    try:
        mode = router.invoke([system, HumanMessage(content=text)]).mode
    except Exception:
        mode = "plan"
    if mode == "bake":
        mode = "plan"
    return {"mode": mode, "tool": None}


def _select_lane(state: State) -> str:
    return state["mode"]


# ── Planning Mode ────────────────────────────────────────────────────────────


class _Intent(BaseModel):
    taste: str | None = Field(None, description="e.g. sweet, savory, rich, light")
    texture: str | None = Field(None, description="e.g. soft, chewy, fluffy, crisp")
    occasion: str | None = Field(None, description="e.g. breakfast, dessert, entertaining")
    difficulty: str | None = Field(None, description="beginner | intermediate | advanced")
    time_limit_min: int | None = Field(None, description="minutes available, if stated")
    available_ingredients: list[str] = Field(default_factory=list)


class _Rec(BaseModel):
    id: str = Field(description="a recipe id from the candidates")
    why: str = Field(
        description="short editorial card copy — 1-2 crisp fragments, specific and memorable "
        "(e.g. 'Crisp edges. Soft centers. Ready in 40 minutes.'). Grounded ONLY in this "
        "candidate's data and the user's constraints — invent nothing. Not a full-sentence "
        "explanation, and not a repeat of the message's reasoning."
    )


class _Plan(BaseModel):
    message: str = Field(
        description="a decisive, editorial reply in 1-3 sentences: the recommendation, a brief "
        "reason, and one practical insight if useful. Plain and confident — no emojis, no filler "
        "('Love that', 'Great question', 'Let me know if…')."
    )
    recommendations: list[_Rec] = Field(
        default_factory=list,
        description="0-3 recipes that GENUINELY fit; empty if none of the candidates fit",
    )


def _intent_input(intent: _Intent, goal: str) -> dict:
    """The planner's 'tool input' — the goal + whatever preferences were extracted."""
    d: dict = {"request": goal}
    if intent.taste:
        d["taste"] = intent.taste
    if intent.texture:
        d["texture"] = intent.texture
    if intent.occasion:
        d["occasion"] = intent.occasion
    if intent.difficulty:
        d["difficulty"] = intent.difficulty
    if intent.time_limit_min:
        d["time_limit_min"] = intent.time_limit_min
    if intent.available_ingredients:
        d["ingredients"] = intent.available_ingredients
    return d


def _intent_query(intent: _Intent, goal: str) -> str:
    parts = [goal]
    if intent.taste:
        parts.append(f"taste: {intent.taste}")
    if intent.texture:
        parts.append(f"texture: {intent.texture}")
    if intent.occasion:
        parts.append(f"occasion: {intent.occasion}")
    if intent.available_ingredients:
        parts.append("ingredients: " + ", ".join(intent.available_ingredients))
    if intent.difficulty:
        parts.append(f"difficulty: {intent.difficulty}")
    if intent.time_limit_min:
        parts.append(f"under {intent.time_limit_min} minutes")
    return ". ".join(parts)


def _candidates_block(cands: list[dict]) -> str:
    lines = []
    for c in cands:
        j = lambda xs: ", ".join(xs or [])  # noqa: E731
        lines.append(
            f"- id={c['id']} | {c['title']} | {c['category']['label']} | "
            f"{c.get('difficulty', '?')} | ~{c.get('total_time_min')} min "
            f"(~{c.get('active_time_min')} active) | taste: {j(c.get('taste'))} | "
            f"texture: {j(c.get('texture'))} | good for: {j(c.get('occasion'))} | "
            f"pairs: {j(c.get('pairs_with'))} | {c.get('summary', '')}"
        )
    return "\n".join(lines)


def _card(payload: dict, why: str) -> dict:
    return {
        "id": payload["id"],
        "slug": payload["slug"],
        "title": payload["title"],
        "category": payload["category"],
        "difficulty": payload.get("difficulty"),
        "est_time_min": payload.get("total_time_min"),
        "why": why,
    }


@traceable(name="rank_recommendations", run_type="chain")
def _rank(candidates: list[dict], messages) -> _Plan:
    """Rank + explain over ONLY the retrieved candidates (may recommend none)."""
    planner = get_chat_llm().with_structured_output(_Plan)
    system = SystemMessage(
        content=(
            "You are Bake Me Up — a calm, confident baking instructor. Recommend the right "
            "recipe from ONLY these candidates for what the user wants.\n"
            "- If they've given ANY concrete signal (taste, time, occasion, ingredient, "
            "category, or a named bake), recommend now: return 1-3 that genuinely fit (respect "
            "any time limit — total minutes shown), best first.\n"
            "- Ask a clarifying question ONLY if the request is genuinely too vague to choose "
            "well AND you have NOT already asked one earlier (check the history). Then return "
            "an empty list with one short question as the message. Never ask twice.\n"
            "- If none genuinely fit, return an empty list and say plainly that the collection "
            "doesn't have a good match.\n"
            "- When the user names a broad CATEGORY (bread, cake, cookies), prefer the most "
            "representative example as a SOFT tiebreaker only — the user's explicit constraints "
            "(time, difficulty, ingredients) always win over that default.\n"
            "VOICE — the `message` is decisive and editorial, 1-3 sentences: the pick, a brief "
            "reason, and one practical insight if useful (e.g. 'I'd start with the Anpan. It "
            "uses the same Kashipan dough, but the process is more forgiving. The dough "
            "development is the part worth paying attention to.'). No emojis. No filler ('Love "
            "that', 'Great question', 'Let me know if…'). Sound like you know what you'd choose.\n"
            "Each `why` is short editorial card copy — crisp fragments grounded ONLY in the "
            "candidate's data below (taste, texture, good-for, summary, time, difficulty) and "
            "the user's constraints; invent nothing, and don't repeat the message's reasoning. "
            "Use only ids listed.\n\n"
            "Candidates:\n" + _candidates_block(candidates)
        )
    )
    return planner.invoke([system, *messages])


def plan_node(state: State) -> dict:
    goal = _last_user_text(state["messages"])
    recent = _recent_user_text(state["messages"], n=3)
    # 1) understand: recent planning turns → structured preferences (carry constraints across a
    # short exchange; the query below is built from the STRUCTURED intent, so off-topic chatter
    # can't leak into retrieval).
    intent = (
        get_chat_llm(mini=True)
        .with_structured_output(_Intent)
        .invoke(
            [
                SystemMessage(
                    content="Extract the user's baking preferences from their recent messages. "
                    "Combine constraints stated across turns; ignore anything not about baking. "
                    "Leave a field null if not stated."
                ),
                HumanMessage(content=recent),
            ]
        )
    )
    # 2) retrieve: profile search over Qdrant (drop far-off matches)
    candidates = retrieve_profiles(_intent_query(intent, goal), k=4, score_floor=0.2)
    by_id = {c["id"]: c for c in candidates}

    # Visible "tool call" for the UI: what the planner searched and considered.
    tool = {
        "name": "search_collection",
        "input": _intent_input(intent, goal),
        "considered": [
            {
                "title": c["title"],
                "category": c["category"]["label"],
                "difficulty": c.get("difficulty"),
                "total_time_min": c.get("total_time_min"),
            }
            for c in candidates
        ],
        "state": "output-available",
    }

    if not candidates:
        msg = (
            "I don't have a good match for that in your collection yet. Tell me a bit more "
            "about what you're after, or add the recipe later and I'll walk you through it."
        )
        return {"messages": [AIMessage(content=msg)], "recommendations": [], "tool": tool}

    # 3) reason: rank + explain over ONLY the candidates (may recommend none)
    result = _rank(candidates, state["messages"])
    cards = [_card(by_id[r.id], r.why) for r in result.recommendations if r.id in by_id]
    return {
        "messages": [AIMessage(content=result.message)],
        "recommendations": cards,
        "tool": tool,
    }


# ── Baking Mode (full recipe in context) ─────────────────────────────────────

# Actively baking (recipe page): coach through the recipe, step by step.
COACH_PROMPT = (
    "You are Bake Me Up — a calm, confident baking instructor working alongside the user "
    "through ONE recipe they are baking. Warm but not chatty; plain and editorial, no emojis. "
    "Use the full recipe below and the conversation so far (including any goals from planning). "
    "Answer grounded in this recipe; if something truly isn't covered, say so rather than "
    "inventing it. Keep replies concise and decisive.\n"
    "STEP STATE — the turn's context names the user's CURRENT step (and the next). Treat that as "
    "shared state and ground every answer in the CURRENT step:\n"
    "- Questions (why, substitutions, technique, 'what does medium peak mean') → answer only; do "
    "NOT tell them to move on or imply they've advanced.\n"
    "- If they ask what comes next, describe the upcoming step framed as 'After this step, "
    "we'll…' and tell them to press 'I'm Ready' when the current step is done. Never phrase it as "
    "if they've already advanced.\n"
    "- You cannot change the step — the user advances it with the 'I'm Ready' button. Only ever "
    "speak as if they're on the current step, so the chat and the page never drift apart."
)

# Evaluating a suggested recipe (Kitchen follow-up): help them decide — they haven't started.
EVALUATE_PROMPT = (
    "You are Bake Me Up — a calm, confident baking instructor. The user is CONSIDERING this "
    "suggested recipe; they have NOT started baking it. Help them decide: answer their question "
    "grounded in the full recipe below — difficulty, time, substitutions, what to expect, why it "
    "fits. Warm but not chatty; plain and editorial, no emojis. Do not assume they've begun. Keep "
    "it concise (2-4 sentences) and decisive; if something isn't covered, say so."
)


@traceable(name="load_recipe_context", run_type="retriever")
def _load_recipe_context(recipe_id: str) -> str:
    """Load the full recipe markdown that grounds the coach (no per-question RAG)."""
    return get_body(recipe_id or "")


@traceable(name="select_prompt_mode")
def _select_prompt_mode(active: bool) -> str:
    """Coaching an active bake vs. evaluating a suggested recipe the user hasn't started."""
    return "coach" if active else "evaluate"


def bake_node(state: State) -> dict:
    active = state.get("active_recipe")
    recipe_id = active or state.get("current_recommendation")
    body = _load_recipe_context(recipe_id or "")
    if not body:
        return general_node(state)
    prompt = COACH_PROMPT if _select_prompt_mode(bool(active)) == "coach" else EVALUATE_PROMPT
    system = SystemMessage(content=f"{prompt}\n\n--- RECIPE ---\n{body}")
    reply = get_chat_llm().invoke([system, *state["messages"]])
    return {"messages": [reply]}


# ── General lane ─────────────────────────────────────────────────────────────


def general_node(state: State) -> dict:
    system = SystemMessage(
        content=(
            "You are Bake Me Up — a calm, confident baking instructor, not a general "
            "assistant. Plain and editorial, no emojis.\n"
            "- If the user asked a genuine BAKING question (technique, concept, ingredient, "
            "troubleshooting), answer briefly and plainly, then offer to help them pick "
            "something to make.\n"
            "- If the message is NOT about baking (weather, jokes, chit-chat, trivia), do NOT "
            "answer it. Briefly redirect: you help people decide what to bake and walk them "
            "through it — ask what they're in the mood for.\n"
            f"Their collection has: {_library_titles()}."
        )
    )
    reply = get_chat_llm().invoke([system, *state["messages"]])
    return {"messages": [reply]}


def build_graph(checkpointer=None):
    builder = StateGraph(State)
    builder.add_node("route", route_node)
    builder.add_node("plan", plan_node)
    builder.add_node("bake", bake_node)
    builder.add_node("general", general_node)

    builder.add_edge(START, "route")
    builder.add_conditional_edges(
        "route",
        _select_lane,
        {"plan": "plan", "bake": "bake", "general": "general"},
    )
    return builder.compile(checkpointer=checkpointer)


# LangGraph Platform / `langgraph dev` import this module-level `graph`.
graph = build_graph()
