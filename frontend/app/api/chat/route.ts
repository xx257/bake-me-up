import { NextResponse } from "next/server";

// Server-side proxy to the LangGraph Platform deployment. Holds the API key so it is
// never exposed to the browser, and scopes retrieval to the active recipe.
const API_URL = process.env.LANGGRAPH_API_URL;
const API_KEY = process.env.LANGGRAPH_API_KEY;

type Msg = { role: "user" | "assistant"; content: string };

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === "string" ? c : (c?.text ?? "")))
      .join("");
  }
  return "";
}

export async function POST(request: Request) {
  if (!API_URL || !API_KEY) {
    return NextResponse.json(
      { error: "Backend not configured (LANGGRAPH_API_URL / LANGGRAPH_API_KEY)." },
      { status: 500 },
    );
  }

  const { messages, recipeId, currentStep } = (await request.json()) as {
    messages: Msg[];
    recipeId?: string;
    currentStep?: string;
  };

  // Make the assistant context-aware of where the baker is (v0.2). Injected as a
  // system message so "what's next?" and step questions resolve without the user
  // having to restate their progress.
  const input = currentStep
    ? [
        {
          role: "system",
          content: `The baker is currently on ${currentStep}. Take that into account — e.g. "what's next?" means the step after this one.`,
        },
        ...messages,
      ]
    : messages;

  const upstream = await fetch(`${API_URL}/runs/wait`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": API_KEY },
    body: JSON.stringify({
      assistant_id: "agent",
      input: {
        messages: input,
        active_recipe: recipeId ?? null,
        context: "",
      },
    }),
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Backend error: ${await upstream.text()}` },
      { status: 502 },
    );
  }

  const data = await upstream.json();
  const msgs: Array<{ content: unknown }> = data.messages ?? [];
  const reply = extractText(msgs[msgs.length - 1]?.content);
  return NextResponse.json({ reply });
}
