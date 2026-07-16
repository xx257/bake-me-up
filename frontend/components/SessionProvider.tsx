"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

// One conversation thread per browser session, shared between the Kitchen (planning)
// and the recipe/baking coach so the backend remembers the user's goal throughout.
// Lives in the root layout, which stays mounted across client navigations.
type SessionCtx = {
  threadId: string | null;
  setThreadId: Dispatch<SetStateAction<string | null>>;
};

const Ctx = createContext<SessionCtx>({ threadId: null, setThreadId: () => {} });

export function useSession() {
  return useContext(Ctx);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [threadId, setThreadId] = useState<string | null>(null);

  // Pre-create the thread on mount so the first message skips the inline POST /threads
  // round-trip (and wakes the backend early). Only set if a message hasn't already made one.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/thread", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.threadId) setThreadId((cur) => cur ?? d.threadId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <Ctx.Provider value={{ threadId, setThreadId }}>{children}</Ctx.Provider>;
}
