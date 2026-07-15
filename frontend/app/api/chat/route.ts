import { NextResponse } from "next/server";

// Server-side proxy to the LangGraph Platform deployment. Holds the API key (never
// exposed to the browser) and runs on a per-session thread so the backend checkpointer
// remembers the conversation (planning goal → baking) across turns and pages.
const API_URL = process.env.LANGGRAPH_API_URL;
const API_KEY = process.env.LANGGRAPH_API_KEY;

const headers = () => ({
  "Content-Type": "application/json",
  "X-Api-Key": API_KEY as string,
});

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === "string" ? c : (c?.text ?? "")))
      .join("");
  }
  return "";
}

async function ensureThread(threadId?: string): Promise<string> {
  if (threadId) return threadId;
  const res = await fetch(`${API_URL}/threads`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`thread create failed: ${await res.text()}`);
  return (await res.json()).thread_id;
}

export async function POST(request: Request) {
  if (!API_URL || !API_KEY) {
    return NextResponse.json(
      { error: "Backend not configured (LANGGRAPH_API_URL / LANGGRAPH_API_KEY)." },
      { status: 500 },
    );
  }

  const { message, threadId, activeRecipe, currentStep, currentRecommendation } =
    (await request.json()) as {
      message: string;
      threadId?: string;
      activeRecipe?: string;
      currentStep?: string;
      currentRecommendation?: string;
    };

  try {
    const tid = await ensureThread(threadId);
    // Inline the current-step context into the turn (keeps the backend aware without
    // piling up system messages in the persisted thread).
    const content = currentStep ? `[Context: I'm on ${currentStep}] ${message}` : message;

    const res = await fetch(`${API_URL}/threads/${tid}/runs/wait`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        assistant_id: "agent",
        input: {
          messages: [{ role: "user", content }],
          active_recipe: activeRecipe ?? null,
          // Always send it (null when absent) so the backend mirrors the pinned pick each turn.
          current_recommendation: currentRecommendation ?? null,
        },
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Backend error: ${await res.text()}` }, { status: 502 });
    }

    const data = await res.json();
    const state = data.values ?? data; // thread run returns final state values
    const msgs: Array<{ content: unknown }> = state.messages ?? [];
    return NextResponse.json({
      threadId: tid,
      reply: extractText(msgs[msgs.length - 1]?.content),
      mode: state.mode ?? null,
      recommendations: state.recommendations ?? [],
      tool: state.tool ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
