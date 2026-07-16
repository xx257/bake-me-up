import { NextResponse } from "next/server";

// Pre-create a conversation thread (called once on app mount) so the user's FIRST message is a
// single /runs/wait call instead of paying an extra POST /threads round-trip inline. Also nudges
// the backend container awake before the user sends anything.
const API_URL = process.env.LANGGRAPH_API_URL;
const API_KEY = process.env.LANGGRAPH_API_KEY;

export async function POST() {
  if (!API_URL || !API_KEY) {
    return NextResponse.json({ error: "Backend not configured." }, { status: 500 });
  }
  try {
    const res = await fetch(`${API_URL}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": API_KEY },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(await res.text());
    const { thread_id } = await res.json();
    return NextResponse.json({ threadId: thread_id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
