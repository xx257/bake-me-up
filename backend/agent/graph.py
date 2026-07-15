"""Bake Me Up — Agentic RAG.

    START -> route -> { discover | coach | redirect }

Three lanes, clear responsibilities:

- discover: recipe / knowledge search when the recipe is UNKNOWN — intent → retrieval →
  rank & answer / recommend. Retrieval lives here.
- coach:    a recipe is SELECTED (active_recipe) → load the FULL recipe into context and
  coach over the whole workflow (Active Recipe + Workflow State + Conversation) — no
  retrieval by default.
- redirect: off-topic guard — non-baking turns are declined and redirected (no retrieval,
  no recommendation).

Session memory rides the LangGraph Platform checkpointer + a per-session thread, so this
graph is compiled without a checkpointer. Clients are lazy.
"""

from __future__ import annotations

import logging
from typing import Annotated, Literal, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from langsmith import traceable
from pydantic import BaseModel, Field

from .catalog import get_body, get_catalog, get_entry
from .config import get_chat_llm
from .retrieval import retrieve_profiles
from .tools import _tavily_search, search_baking_web

Mode = Literal["discover", "coach", "redirect"]


class State(TypedDict):
    messages: Annotated[list, add_messages]
    active_recipe: str | None  # recipe page: the user is actively baking this
    current_recommendation: str | None  # Kitchen: the pinned pick the user is evaluating
    mode: Mode
    recommendations: list
    tool: dict | None  # visible "tool call" from the discover lane (search_collection, for the UI)
    web_search: list | None  # visible web-search cards from coach/evaluate (Tavily, for the UI)
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


def _title_for(recipe_id: str | None) -> str | None:
    entry = get_entry(recipe_id) if recipe_id else None
    return entry["title"] if entry else None


# ── Router ────────────────────────────────────────────────────────────────────


class _Route(BaseModel):
    mode: Mode = Field(description="discover | redirect")


def route_node(state: State) -> dict:
    # Step 1 — deterministic: a recipe is actively selected (recipe page) → coach.
    # Highest-confidence signal in the system; coach owns execution + evaluation + coaching.
    # (A Kitchen pinned pick is NOT "selected" — those turns stay in discover, which answers
    # recipe questions and keeps iterative discovery working.)
    if state.get("active_recipe"):
        return {"mode": "coach", "tool": None}

    # Step 2 — LLM classify the rest: anything baking → discover; anything else → redirect.
    text = _last_user_text(state["messages"])
    router = get_chat_llm(mini=True).with_structured_output(_Route)
    system = SystemMessage(
        content=(
            "Classify a turn for a baking assistant (no recipe is selected). Choose one:\n"
            "- discover: ANYTHING about baking — a recipe, ingredient, technique, baking "
            "science, or finding/choosing/understanding a recipe (by name or by constraints "
            "like time, taste, occasion, ingredients, skill). Includes baking questions like "
            "'how do I temper chocolate' or 'do I need yudane for anpan'.\n"
            "- redirect: anything NOT about baking (weather, jokes, coding, resumes, "
            "chit-chat, trivia).\n"
            "Return only the mode."
        )
    )
    try:
        mode = router.invoke([system, HumanMessage(content=text)]).mode
    except Exception:
        mode = "discover"
    if mode == "coach":  # the classifier only chooses discover/redirect
        mode = "discover"
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


class _NewSearch(BaseModel):
    new_search: bool = Field(
        description="true if the user wants a DIFFERENT recipe / new search; "
        "false if asking a question about the current recommendation"
    )


@traceable(name="is_new_search", run_type="chain")
def _is_new_search(text: str, rec_title: str) -> bool:
    """Pinned-pick follow-up: a request for a DIFFERENT recipe (new search) vs a question
    about the current recommendation."""
    llm = get_chat_llm(mini=True).with_structured_output(_NewSearch)
    system = SystemMessage(
        content=(
            f"The user is looking at a recommended recipe: {rec_title}.\n"
            "- new_search = true: they want a DIFFERENT recipe or another option "
            "('something else', 'anything savory instead', 'show me another').\n"
            "- new_search = false: they're asking a QUESTION about this recommendation "
            "(why this one, difficulty, timing, substitutions, freezing, 'tell me more')."
        )
    )
    try:
        return llm.invoke([system, HumanMessage(content=text)]).new_search
    except Exception:
        return False


# ── Collection search (agentic tool) ─────────────────────────────────────────

DISCOVER_PROMPT = (
    "You are Bake Me Up, a baking assistant. Call EXACTLY ONE tool for this turn — never both:\n"
    "- search_collection: the user wants to find, compare, identify, or get a recommendation for a "
    "recipe in THEIR collection. Put their core ask in `request` (a named bake or a description) and "
    "fill the optional constraint fields (taste, texture, occasion, difficulty, time_limit_min, "
    "ingredients) ONLY when the user actually stated them. The collection is searched and ranked for "
    "you afterward.\n"
    "- search_baking_web: the user asks a STANDALONE baking-knowledge question (a technique, concept, "
    "ingredient fact, or troubleshooting) — not a request for a recipe. Answer from the web results.\n"
    "search_baking_web is ONLY for baking knowledge outside the stored recipes — NEVER use it to find "
    "public recipes or replace the curated collection. Prefer the collection for anything recipe-shaped."
)

# Standalone baking-knowledge answer synthesized from the web tool's results.
WEB_KNOWLEDGE_PROMPT = (
    "You are Bake Me Up, a calm, confident baking instructor. Answer the user's baking question from "
    "the web search results provided — concise and plain, no emojis, never invent facts. Then offer "
    "to help them find something to bake."
)


@traceable(run_type="tool", name="search_collection")
def _run_collection_search(
    request: str,
    taste: str | None = None,
    texture: str | None = None,
    occasion: str | None = None,
    difficulty: str | None = None,
    time_limit_min: int | None = None,
    ingredients: list[str] | None = None,
) -> dict:
    """Profile search over Qdrant from the model's structured args. A first-class `tool` span
    (like the Tavily search). Returns `{"candidates", "input"}` — the caller ranks the candidates
    and builds the UI card from `input`."""
    intent = _Intent(
        taste=taste,
        texture=texture,
        occasion=occasion,
        difficulty=difficulty,
        time_limit_min=time_limit_min,
        available_ingredients=ingredients or [],
    )
    candidates = retrieve_profiles(_intent_query(intent, request), k=4, score_floor=0.2)
    return {"candidates": candidates, "input": _intent_input(intent, request)}


@tool
def search_collection(
    request: str,
    taste: str | None = None,
    texture: str | None = None,
    occasion: str | None = None,
    difficulty: str | None = None,
    time_limit_min: int | None = None,
    ingredients: list[str] | None = None,
) -> str:
    """Search the user's OWN recipe collection for candidate recipes. `request` is their core ask
    (a named bake or a description of what they want); the other fields are optional constraints —
    set one only when the user actually stated it. Returns the matching candidate recipes."""
    res = _run_collection_search(
        request, taste, texture, occasion, difficulty, time_limit_min, ingredients
    )
    return _candidates_block(res["candidates"]) or "No matches in the collection."


def _collection_card(tool_input: dict, candidates: list[dict]) -> dict:
    """The visible search_collection tool card for the UI — what was searched + considered."""
    return {
        "name": "search_collection",
        "input": tool_input,
        "considered": [
            {
                "title": c["title"],
                "category": c["category"]["label"],
                "difficulty": c.get("difficulty"),
                "total_time_min": c.get("total_time_min"),
                "score": c.get("_score"),
            }
            for c in candidates
        ],
        "state": "output-available",
    }


log = logging.getLogger("bake_me_up.agent")

_DISCOVERY_FALLBACK_MSG = (
    "I didn't quite catch that — are you looking for a recipe from your collection, or asking a "
    "baking question? Tell me a little more and I'll help."
)


@traceable(name="select_discovery_tool")
def _select_discovery_tool(messages: list):
    """Bind both discovery tools and require the model to pick EXACTLY ONE (guardrails 1, 3, 4).
    The chosen tool IS the intent (collection vs standalone knowledge) — no separate classifier.
    Retries once with an explicit instruction if the selection is missing or ambiguous (zero, or
    more than one, tool calls). Returns the valid AIMessage, or None → caller sends a graceful
    error (never silently defaults to a recommendation)."""
    llm = get_chat_llm().bind_tools(
        [search_collection, search_baking_web], tool_choice="required"
    )
    system = DISCOVER_PROMPT
    for attempt in range(2):
        ai = llm.invoke([SystemMessage(content=system), *messages])
        calls = getattr(ai, "tool_calls", None) or []
        if len(calls) == 1:
            return ai
        log.warning(
            "discovery tool-selection invalid (attempt %d/2): %d calls %s",
            attempt + 1,
            len(calls),
            [c["name"] for c in calls],
        )
        system = DISCOVER_PROMPT + "\n\nYour last reply was invalid. Call EXACTLY ONE tool — not zero, not both."
    return None


@traceable(name="answer_from_web")
def _answer_from_web(messages: list, ai) -> tuple[AIMessage, list | None]:
    """Run the model's search_baking_web call and synthesize a standalone baking-knowledge answer.
    `ai` is the tool-selecting message (validated to a single search_baking_web call). Returns
    `(final_message, web_search)` with the visible web card(s)."""
    convo: list = [SystemMessage(content=WEB_KNOWLEDGE_PROMPT), *messages, ai]
    web: list = []
    for tc in ai.tool_calls:
        result = _tavily_search(tc["args"]["query"])
        web.append(
            {
                "query": tc["args"]["query"],
                "sources": result["sources"],
                "result_count": result["result_count"],
            }
        )
        convo.append(ToolMessage(content=result["text"], tool_call_id=tc["id"]))
    final = get_chat_llm().invoke(convo)
    return final, (web or None)


def discover_node(state: State) -> dict:
    goal = _last_user_text(state["messages"])
    rec = state.get("current_recommendation")
    # Follow-up about the pinned recommendation → answer grounded in it and STAY in discover
    # (keep the pick + retrieval card; do NOT re-recommend). Only a fresh turn or an explicit
    # new-search request runs the recommendation pipeline below.
    if rec and not _is_new_search(goal, _title_for(rec) or "the recommended recipe"):
        body = get_body(rec)
        if body:
            msg, web = _answer_with_recipe(EVALUATE_PROMPT, body, state["messages"])
            return {"messages": [msg], "web_search": web}

    # Fresh discovery: bind BOTH tools in one call and let the model pick EXACTLY one — the tool it
    # chooses is the intent (collection vs standalone knowledge). No separate triage/classifier pass.
    ai = _select_discovery_tool(state["messages"])
    if ai is None:  # guardrails 3 & 4: never silently default to a recommendation
        return {
            "messages": [AIMessage(content=_DISCOVERY_FALLBACK_MSG)],
            "recommendations": [],
            "tool": None,
            "web_search": None,
        }

    tc = ai.tool_calls[0]  # exactly one, validated by _select_discovery_tool
    if tc["name"] == "search_collection":
        res = _run_collection_search(**tc["args"])
        candidates = res["candidates"]
        by_id = {c["id"]: c for c in candidates}
        tool = _collection_card(res["input"], candidates)
        if not candidates:
            msg = (
                "I don't have a good match for that in your collection yet. Tell me a bit more "
                "about what you're after, or add the recipe later and I'll walk you through it."
            )
            return {
                "messages": [AIMessage(content=msg)],
                "recommendations": [],
                "tool": tool,
                "web_search": None,
            }
        # rank + explain over ONLY the candidates (clarify-vs-recommend decision lives here)
        result = _rank(candidates, state["messages"])
        cards = [_card(by_id[r.id], r.why) for r in result.recommendations if r.id in by_id]
        return {
            "messages": [AIMessage(content=result.message)],
            "recommendations": cards,
            "tool": tool,
            "web_search": None,
        }

    # search_baking_web → standalone baking knowledge (Tavily), synthesized answer + web card.
    msg, web = _answer_from_web(state["messages"], ai)
    return {"messages": [msg], "recommendations": [], "tool": None, "web_search": web}


# ── Baking Mode (full recipe in context) ─────────────────────────────────────

# Actively baking (recipe page): coach through the recipe, step by step.
COACH_PROMPT = (
    "You are Bake Me Up — a calm, confident baking instructor working alongside the user "
    "through ONE recipe they are baking. Warm but not chatty; plain and editorial, no emojis. "
    "Use the full recipe below and the conversation so far (including any goals from planning). "
    "Answer grounded in this recipe. If the user needs general baking knowledge the recipe does "
    "NOT cover (an ingredient fact, or a substitution the recipe doesn't mention), use the "
    "search_baking_web tool and answer from it as general guidance; never invent facts. Keep "
    "replies concise and decisive.\n"
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
    "it concise (2-4 sentences) and decisive. If it's general baking knowledge the recipe "
    "doesn't cover (a substitution, an ingredient fact), use the search_baking_web tool; "
    "otherwise answer from the recipe."
)


@traceable(name="load_recipe_context", run_type="retriever")
def _load_recipe_context(recipe_id: str) -> str:
    """Load the full recipe markdown that grounds the coach (no per-question RAG)."""
    return get_body(recipe_id or "")


@traceable(name="answer_with_recipe")
def _answer_with_recipe(prompt: str, body: str, messages: list) -> tuple[AIMessage, list | None]:
    """Answer grounded in the FULL recipe; local-first — may call `search_baking_web` for
    general baking knowledge the recipe genuinely doesn't cover (substitutions, ingredient
    facts).

    Returns `(final_message, web_search)` where `web_search` is a list of visible web-search
    cards (`{"query", "sources", "result_count"}`) for the UI when Tavily was used, else None.
    The tool loop runs internally — only the synthesized message reaches graph state — so the
    web cards are surfaced separately rather than lost."""
    system = SystemMessage(content=f"{prompt}\n\n--- RECIPE ---\n{body}")
    convo: list = [system, *messages]
    ai = get_chat_llm().bind_tools([search_baking_web]).invoke(convo)
    web: list = []
    if getattr(ai, "tool_calls", None):
        convo.append(ai)
        for tc in ai.tool_calls:
            result = _tavily_search(tc["args"]["query"])  # structured: text + sources
            web.append(
                {
                    "query": tc["args"]["query"],
                    "sources": result["sources"],
                    "result_count": result["result_count"],
                }
            )
            convo.append(ToolMessage(content=result["text"], tool_call_id=tc["id"]))
        ai = get_chat_llm().invoke(convo)  # synthesize the final answer with the web context
    return ai, (web or None)


def coach_node(state: State) -> dict:
    # Coach knows the recipe already — load the FULL recipe (it fits the window) and reason
    # over Active Recipe + Workflow State + Conversation. NO retrieval; Tavily is a fallback
    # for baking knowledge the recipe doesn't cover.
    active = state.get("active_recipe")
    recipe_id = active or state.get("current_recommendation")
    body = _load_recipe_context(recipe_id or "")
    if not body:
        return redirect_node(state)
    prompt = COACH_PROMPT if active else EVALUATE_PROMPT  # active bake vs. evaluating a suggestion
    msg, web = _answer_with_recipe(prompt, body, state["messages"])
    return {"messages": [msg], "web_search": web}


# ── General lane ─────────────────────────────────────────────────────────────


def redirect_node(state: State) -> dict:
    # Boundary guard: the turn was classified as non-baking. Do NOT answer it — redirect
    # back to what Bake Me Up does. No retrieval, no Tavily, no recommendation.
    system = SystemMessage(
        content=(
            "You are Bake Me Up, a baking companion. The user's message is NOT about baking. "
            "Do not answer it. In 1-2 plain sentences, no emojis, say you're focused on baking "
            "and recipe guidance, and offer to help with recipes, baking techniques, "
            "troubleshooting, or choosing what to bake."
        )
    )
    reply = get_chat_llm(mini=True).invoke([system, *state["messages"]])
    return {"messages": [reply]}


def build_graph(checkpointer=None):
    builder = StateGraph(State)
    builder.add_node("route", route_node)
    builder.add_node("discover", discover_node)
    builder.add_node("coach", coach_node)
    builder.add_node("redirect", redirect_node)

    builder.add_edge(START, "route")
    builder.add_conditional_edges(
        "route",
        _select_lane,
        {"discover": "discover", "coach": "coach", "redirect": "redirect"},
    )
    return builder.compile(checkpointer=checkpointer)


# LangGraph Platform / `langgraph dev` import this module-level `graph`.
graph = build_graph()
