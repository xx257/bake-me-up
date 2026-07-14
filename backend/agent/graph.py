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

from typing import Annotated, Literal, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field

from .catalog import get_body, get_catalog
from .config import get_chat_llm
from .retrieval import retrieve_profiles

Mode = Literal["plan", "bake", "general"]


class State(TypedDict):
    messages: Annotated[list, add_messages]
    active_recipe: str | None
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


def _library_titles() -> str:
    return ", ".join(r["title"] for r in get_catalog())


# ── Router ────────────────────────────────────────────────────────────────────


class _Route(BaseModel):
    mode: Mode = Field(description="plan | bake | general")


def route_node(state: State) -> dict:
    # Baking Mode: a recipe is selected, so always coach over that recipe (the full
    # markdown is in context and can draw on general knowledge as needed). Clear any
    # stale tool card from an earlier planning turn on this thread.
    if state.get("active_recipe"):
        return {"mode": "bake", "tool": None}

    # No recipe selected (Kitchen): plan a bake, or answer generally if nothing matches.
    router = get_chat_llm(mini=True).with_structured_output(_Route)
    system = SystemMessage(
        content=(
            "Route a baking assistant's turn (no recipe is selected). Choose one:\n"
            "- plan: the user wants to bake something, or to make/find a recipe — whether "
            "by NAME ('how do I make roll cake', 'anpan', 'I want to bake shokupan') or by "
            "CONSTRAINTS (time, taste, occasion, ingredients, skill; e.g. 'something quick "
            "and sweet', 'dessert for friends'). Their library is searched afterward and we "
            "either recommend a match or say it's not there — so you do NOT need to know "
            "what's in the library.\n"
            "- general: a general baking QUESTION that is not about making a specific item — "
            "a technique, concept, comparison, or general troubleshooting. e.g. 'how do I "
            "temper chocolate', 'what does folding mean', 'why do cookies spread', 'baking "
            "soda vs powder'.\n"
            "Return only the mode."
        )
    )
    try:
        mode = router.invoke(
            [system, HumanMessage(content=_last_user_text(state["messages"]))]
        ).mode
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
    why: str = Field(description="one sentence on why it fits the goal")


class _Plan(BaseModel):
    message: str = Field(
        description="a warm, brief reply — introduce the picks, or if none fit, say so kindly"
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


def plan_node(state: State) -> dict:
    goal = _last_user_text(state["messages"])
    # 1) understand: natural language → structured preferences
    intent = (
        get_chat_llm(mini=True)
        .with_structured_output(_Intent)
        .invoke(
            [
                SystemMessage(
                    content="Extract the user's baking preferences from their message. "
                    "Leave a field null if not stated."
                ),
                HumanMessage(content=goal),
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
            "Hmm, I don't have a great match for that in your collection yet 🤔 — want me "
            "to suggest something else, or you can add that recipe later and I'll totally "
            "coach you through it! 🧑‍🍳"
        )
        return {"messages": [AIMessage(content=msg)], "recommendations": [], "tool": tool}

    # 3) reason: rank + explain over ONLY the candidates (may recommend none)
    planner = get_chat_llm().with_structured_output(_Plan)
    system = SystemMessage(
        content=(
            "You are Bake Me Up — a warm, casual baking friend 🧑‍🍳. Recommend from ONLY "
            "these candidate recipes for the user's goal. Recommend ONLY recipes that "
            "genuinely fit (respect any time limit — total minutes shown); return 0-3, best "
            "first, each with a short, friendly one-line why. Write the message like you're "
            "texting a friend — warm and casual, with a light emoji or two (don't overdo "
            "it). If none genuinely fit, return an empty list and a kind message that the "
            "collection doesn't have a great match for that. Use only ids listed.\n\n"
            "Candidates:\n" + _candidates_block(candidates)
        )
    )
    result = planner.invoke([system, *state["messages"]])
    cards = [_card(by_id[r.id], r.why) for r in result.recommendations if r.id in by_id]
    return {
        "messages": [AIMessage(content=result.message)],
        "recommendations": cards,
        "tool": tool,
    }


# ── Baking Mode (full recipe in context) ─────────────────────────────────────

COACH_PROMPT = (
    "You are Bake Me Up — a warm, encouraging baking friend baking right alongside the "
    "user through ONE recipe. Keep it casual and friendly, like texting a friend who loves "
    "to bake, with a light sprinkle of emojis 🧑‍🍳 (a couple per reply, don't overdo it). "
    "Use the full recipe below and the conversation so far (including any goals they "
    "mentioned while planning). Answer grounded in this recipe and mention it by name; if "
    "something truly isn't covered, just say so rather than making it up. Keep them moving "
    "and confident! 🙌"
)


def bake_node(state: State) -> dict:
    body = get_body(state.get("active_recipe") or "")
    if not body:
        return general_node(state)
    system = SystemMessage(content=f"{COACH_PROMPT}\n\n--- RECIPE ---\n{body}")
    reply = get_chat_llm().invoke([system, *state["messages"]])
    return {"messages": [reply]}


# ── General lane ─────────────────────────────────────────────────────────────


def general_node(state: State) -> dict:
    system = SystemMessage(
        content=(
            "You are Bake Me Up — a friendly baking buddy 🍞. The user's question isn't "
            "about a recipe in their library, so answer from general baking knowledge in a "
            "warm, casual tone with a light touch of emojis (a couple, don't overdo it). "
            "Gently mention you don't have that one in their collection yet and they can add "
            f"it later for tailored coaching. Their library has: {_library_titles()}."
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
