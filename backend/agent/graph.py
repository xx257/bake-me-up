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
    # markdown is in context and can draw on general knowledge as needed).
    if state.get("active_recipe"):
        return {"mode": "bake"}

    # No recipe selected (Kitchen): plan a bake, or answer generally if nothing matches.
    router = get_chat_llm(mini=True).with_structured_output(_Route)
    system = SystemMessage(
        content=(
            "Route a baking assistant's turn (no recipe is selected):\n"
            "- plan: the user is describing what they want to bake / asking for a recommendation.\n"
            "- general: a baking question that isn't about choosing a recipe from the library.\n"
            f"Library: {_library_titles()}.\n"
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
    return {"mode": mode}


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
    message: str = Field(description="a warm, brief reply introducing the picks")
    recommendations: list[_Rec] = Field(description="1-3 candidates, best first")


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
    # 2) retrieve: profile search over Qdrant
    candidates = retrieve_profiles(_intent_query(intent, goal), k=4)
    by_id = {c["id"]: c for c in candidates}
    # 3) reason: rank + explain over ONLY the candidates
    planner = get_chat_llm().with_structured_output(_Plan)
    system = SystemMessage(
        content=(
            "You are Bake Me Up. Recommend from ONLY these candidate recipes for the "
            "user's goal. Pick 1-3, best first, and say why each fits (respect any time "
            "limit — total minutes shown). Use only ids listed.\n\nCandidates:\n"
            + _candidates_block(candidates)
        )
    )
    result = planner.invoke([system, *state["messages"]])
    cards = [_card(by_id[r.id], r.why) for r in result.recommendations if r.id in by_id]
    return {"messages": [AIMessage(content=result.message)], "recommendations": cards}


# ── Baking Mode (full recipe in context) ─────────────────────────────────────

COACH_PROMPT = (
    "You are Bake Me Up, an experienced, warm baking coach guiding the user through ONE "
    "recipe. Use the full recipe below and the conversation so far (including any goals "
    "the user mentioned while planning). Answer grounded in this recipe and cite it by "
    "name; if something truly isn't covered, say so briefly rather than inventing it. "
    "Keep the baker moving and confident."
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
            "You are Bake Me Up, a friendly baking expert. The user's question isn't about "
            "a recipe in their library, so answer from general baking knowledge. Briefly say "
            "you don't have that recipe in their collection yet and they can add it later for "
            f"tailored coaching. Their library has: {_library_titles()}."
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
