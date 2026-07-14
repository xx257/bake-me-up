"""Bake Me Up — agentic graph.

    START -> route -> { plan | retrieve -> generate | general }

- route:     LLM router classifies the turn into a lane, given whether a recipe is active.
- plan:      recommend recipes from the catalog for the user's goal (structured cards).
- recipe_qa: dense RAG over Qdrant, grounded + cited (retrieve -> generate).
- general:   general baking knowledge when nothing in the library matches (with a disclaimer).

Session memory (planning goal carried into baking) comes from the LangGraph Platform
checkpointer + a per-session thread — so this graph is compiled without a checkpointer.
Clients are built lazily (config.py) so the module imports with no env.
"""

from __future__ import annotations

from typing import Annotated, Literal, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field

from .catalog import catalog_summary, get_catalog
from .config import get_chat_llm
from .retrieval import format_context, retrieve

Mode = Literal["plan", "recipe_qa", "general"]


class State(TypedDict):
    messages: Annotated[list, add_messages]
    active_recipe: str | None  # recipe_id when the user is on a recipe
    mode: Mode  # set by the router; surfaced to the UI
    recommendations: list  # structured recipe cards from the plan lane
    context: str  # transient retrieved grounding


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
    mode: Mode = Field(description="plan | recipe_qa | general")


def route_node(state: State) -> dict:
    active = state.get("active_recipe")
    router = get_chat_llm(mini=True).with_structured_output(_Route)
    system = SystemMessage(
        content=(
            "You route a baking assistant's turn into one lane:\n"
            "- plan: the user is describing what they want to bake or asking for a "
            "recommendation (time, ingredients, occasion, skill level).\n"
            "- recipe_qa: a question about a specific recipe in the library.\n"
            "- general: a baking question not tied to any library recipe.\n"
            f"Active recipe: {active or 'none'}. Library: {_library_titles()}.\n"
            "Return only the lane."
        )
    )
    try:
        mode = router.invoke([system, HumanMessage(content=_last_user_text(state["messages"]))]).mode
    except Exception:
        mode = "recipe_qa" if active else "plan"

    # Constrain by context: the Kitchen (no active recipe) plans or answers generally;
    # a recipe page answers about that recipe or generally.
    if active and mode == "plan":
        mode = "recipe_qa"
    if not active and mode == "recipe_qa":
        mode = "plan"
    return {"mode": mode}


def _select_lane(state: State) -> str:
    return state["mode"]


# ── Plan lane ───────────────────────────────────────────────────────────────


class _Rec(BaseModel):
    id: str = Field(description="the recipe id from the catalog")
    why: str = Field(description="one sentence on why this fits the user's goal")


class _Plan(BaseModel):
    message: str = Field(description="a warm, brief reply introducing the picks")
    recommendations: list[_Rec] = Field(description="1-3 recipes, best first")


def plan_node(state: State) -> dict:
    planner = get_chat_llm().with_structured_output(_Plan)
    system = SystemMessage(
        content=(
            "You are Bake Me Up, a baking companion. Recommend recipes from THIS library "
            "for the user's goal. Only use ids that appear below. Pick 1-3, best first, and "
            "say why each fits (time, ingredients, occasion, skill). If nothing fits well, "
            "say so and suggest the closest option.\n\nLibrary:\n" + catalog_summary()
        )
    )
    result = planner.invoke([system, *state["messages"]])
    by_id = {r["id"]: r for r in get_catalog()}
    cards = []
    for rec in result.recommendations:
        r = by_id.get(rec.id)
        if not r:
            continue
        cards.append(
            {
                "id": r["id"],
                "slug": r["slug"],
                "title": r["title"],
                "category": r["category"],
                "difficulty": r.get("difficulty"),
                "est_time_min": r.get("est_time_min"),
                "why": rec.why,
            }
        )
    return {"messages": [AIMessage(content=result.message)], "recommendations": cards}


# ── Recipe QA lane (dense RAG) ───────────────────────────────────────────────

GROUNDED_PROMPT = (
    "You are Bake Me Up, a warm, practical baking companion. Answer using ONLY the recipe "
    "context below. Cite the recipe by name. If the answer is not in the context, say you "
    "don't have that in the recipe yet rather than inventing it."
)


def retrieve_node(state: State) -> dict:
    query = _last_user_text(state["messages"])
    docs = retrieve(query, recipe_id=state.get("active_recipe"), k=4)
    return {"context": format_context(docs)}


def generate_node(state: State) -> dict:
    system = SystemMessage(content=f"{GROUNDED_PROMPT}\n\nRecipe context:\n{state['context']}")
    reply = get_chat_llm().invoke([system, *state["messages"]])
    return {"messages": [reply]}


# ── General lane (no retrieval) ──────────────────────────────────────────────


def general_node(state: State) -> dict:
    system = SystemMessage(
        content=(
            "You are Bake Me Up, a friendly baking expert. The user's question is not about a "
            "specific recipe in their library, so answer from general baking knowledge. Briefly "
            "note it isn't from a recipe in their library and they can add that recipe later for "
            f"tailored guidance. Their library currently has: {_library_titles()}."
        )
    )
    reply = get_chat_llm().invoke([system, *state["messages"]])
    return {"messages": [reply]}


def build_graph(checkpointer=None):
    builder = StateGraph(State)
    builder.add_node("route", route_node)
    builder.add_node("plan", plan_node)
    builder.add_node("retrieve", retrieve_node)
    builder.add_node("generate", generate_node)
    builder.add_node("general", general_node)

    builder.add_edge(START, "route")
    builder.add_conditional_edges(
        "route",
        _select_lane,
        {"plan": "plan", "recipe_qa": "retrieve", "general": "general"},
    )
    builder.add_edge("retrieve", "generate")
    return builder.compile(checkpointer=checkpointer)


# LangGraph Platform / `langgraph dev` import this module-level `graph` and inject their
# own (managed Postgres) checkpointer — so it's compiled without one here.
graph = build_graph()
