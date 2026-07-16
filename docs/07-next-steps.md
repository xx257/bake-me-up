# Task 7 — Next Steps

Reflecting on what's built (see [`04-prototype.md`](04-prototype.md)): what to **keep** for Demo Day,
and what to **change or improve** afterward — with reasoning.

## What I Would Keep (for Demo Day)

### Stateful LangGraph Architecture

One design decision I would keep is the stateful LangGraph architecture built around three responsibilities: Discovery, Coach, and Redirect.

During development I experimented with more complex routing and workflow designs, but I found that a shallow graph with explicit state management was easier to reason about and evaluate. The current architecture uses conversation state (current_recommendation, active_recipe, and workflow progress) to drive behavior across turns, allowing the agent to support both recipe discovery and guided execution without introducing unnecessary orchestration complexity.

This architecture also produced cleaner LangSmith traces and made debugging significantly easier during development.

### Retrieval Only When the Relevant Recipe Is Unknown

I would keep the decision to use retrieval only in the discovery and knowledge lookup workflows.

One of the most important architectural lessons from this project was recognizing that retrieval is not valuable everywhere. Once a user has selected a recipe, the relevant knowledge source is already known. In Coach Mode, loading the full recipe into context provides a simpler and more reliable solution than performing retrieval on every turn.

As a result, retrieval is primarily used for:

* recipe identification,
* recipe recommendation,
* recipe knowledge lookup,

while coaching relies on full recipe context and workflow state.

This separation reduced complexity and created a cleaner evaluation strategy for Task 6.

### Local-First Knowledge Architecture

I would also keep the local-first retrieval strategy.

Recipe discovery and recipe-specific questions are grounded in the curated collection, while Tavily is used only when the collection cannot answer a baking-related question. This creates a clear separation between private domain knowledge and public information sources.

From a systems perspective, this improves grounding while preserving the collection as the primary source of truth.

### Observable Agent Behavior

Another implementation choice I would keep is exposing retrieval and web-search evidence in the UI.

Collection searches, recommendation candidates, and Tavily results are surfaced directly to the user rather than hidden inside the agent. This improves transparency, simplifies debugging, and makes evaluation easier because the retrieval path is visible during both testing and live demos.

---

## What I Would Improve (after Demo Day)

### Larger and User-Owned Knowledge Base

The current implementation uses a small curated recipe corpus designed for rapid iteration and evaluation.

The next technical milestone would be supporting user-managed knowledge collections, including recipe uploads, recipe versioning, annotations, and personal notes. This would significantly increase corpus size and create more realistic retrieval challenges, making advanced retrieval techniques more meaningful.

It would also create a stronger use case for the parent-child retrieval approach explored in Task 6. A related direction is **web recipe discovery + ingest**: today Tavily is knowledge-only, but it could also find a recipe off the web and ingest it into the collection (structure → profile + body → Qdrant), so a "no match" in the curated corpus can become a saved recipe.

### Richer Knowledge Representation

Currently, recipes are stored as structured markdown and retrieved as text.

A future improvement would be representing recipes as richer knowledge objects containing:

* ingredients,
* workflow stages,
* troubleshooting guidance,
* substitutions,
* baker notes,
* prior baking outcomes.

This would allow retrieval and reasoning to operate on baking concepts rather than only document text, enabling more targeted guidance and future planning workflows.

### More Context-Aware Coach Mode

The current coaching workflow uses recipe context and conversational state.

Future versions could incorporate additional execution state, such as:

* active timers,
* completed steps,
* user confirmations,
* baking history,
* previous mistakes.

This would allow the agent to provide more proactive guidance rather than relying entirely on user-initiated questions.

### Multimodal Evaluation and Troubleshooting

A natural extension of the current architecture would be multimodal reasoning.

Instead of relying exclusively on text, users could provide images of dough development, proofing progress, or finished bakes. The agent could then combine:

* recipe knowledge,
* workflow state,
* image observations,

to provide more precise troubleshooting recommendations.

---

### Evaluation and Performance Improvements

As the corpus grows, I would continue expanding the evaluation framework introduced in this project.

The current evaluation already focuses on retrieval quality because retrieval is the primary technical component that changes system behavior. Task 6 measured recipe identification accuracy (`recipe_id_hit@3`), answer correctness (LLM-as-judge), faithfulness, context size, and latency across fixed-chunk vs. parent-child retrieval. As the corpus grows I would continue and expand this — re-running those metrics at scale and adding:

* answer relevancy trends as the corpus grows,
* routing-behavior accuracy (collection vs. knowledge vs. redirect),
* end-to-end (through-the-graph) behavior coverage beyond the current subset.

One lesson from this project was that evaluation should drive architecture decisions rather than the other way around. For example, the Task 6 comparison between fixed-chunk retrieval and parent-child retrieval was designed to isolate specific retrieval tradeoffs instead of simply adopting a more complex architecture by default.

As the system evolves, I would continue using controlled experiments and trace analysis to validate future improvements before integrating them into the production workflow.