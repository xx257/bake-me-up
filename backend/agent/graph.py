"""Bake Me Up — agent graph.

Day-2 vertical slice: a grounded-answer RAG flow.

    START -> retrieve -> generate -> END

`retrieve` pulls dense matches from Qdrant (optionally filtered to the active recipe);
`generate` answers grounded in that context via the chat LLM (Vercel AI Gateway) and
cites the source recipe. Router fan-out (workflow engine / Tavily / scale / timeline)
and the memory checkpointer come next.

Clients are built lazily (see config.py), so this module imports/compiles with no env.
"""

from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages

from .config import get_chat_llm
from .retrieval import format_context, retrieve

SYSTEM_PROMPT = (
    "You are Bake Me Up, a warm, practical baking companion. "
    "Answer the user's question using ONLY the recipe context provided below. "
    "Cite the recipe by name. If the answer is not in the context, say you don't have "
    "that in the recipe yet rather than inventing it."
)


class State(TypedDict):
    messages: Annotated[list, add_messages]
    active_recipe: str | None  # recipe_id to scope retrieval to (optional)
    context: str  # transient: retrieved grounding for the current turn


def _last_user_text(messages: list) -> str:
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            return m.content
        if isinstance(m, dict) and m.get("role") == "user":
            return m["content"]
    return ""


def retrieve_node(state: State) -> dict:
    query = _last_user_text(state["messages"])
    docs = retrieve(query, recipe_id=state.get("active_recipe"), k=4)
    return {"context": format_context(docs)}


def generate_node(state: State) -> dict:
    system = SystemMessage(content=f"{SYSTEM_PROMPT}\n\nRecipe context:\n{state['context']}")
    reply = get_chat_llm().invoke([system, *state["messages"]])
    return {"messages": [reply]}


def build_graph(checkpointer=None):
    builder = StateGraph(State)
    builder.add_node("retrieve", retrieve_node)
    builder.add_node("generate", generate_node)
    builder.add_edge(START, "retrieve")
    builder.add_edge("retrieve", "generate")
    return builder.compile(checkpointer=checkpointer)


# LangGraph Platform / `langgraph dev` import this module-level `graph` and inject their
# own (managed Postgres) checkpointer — so it's compiled without one here.
graph = build_graph()
