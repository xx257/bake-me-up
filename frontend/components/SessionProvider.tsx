"use client";

import { createContext, useContext, useState } from "react";

// One conversation thread per browser session, shared between the Kitchen (planning)
// and the recipe/baking coach so the backend remembers the user's goal throughout.
// Lives in the root layout, which stays mounted across client navigations.
type SessionCtx = {
  threadId: string | null;
  setThreadId: (id: string | null) => void;
};

const Ctx = createContext<SessionCtx>({ threadId: null, setThreadId: () => {} });

export function useSession() {
  return useContext(Ctx);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  return <Ctx.Provider value={{ threadId, setThreadId }}>{children}</Ctx.Provider>;
}
