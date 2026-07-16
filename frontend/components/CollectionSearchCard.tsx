"use client";

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

// The retrieval tool card the discover lane surfaces — what was searched in the user's
// collection + the recipes it considered (with cosine scores). Rendered per-turn below the
// reply that ran `search_collection`, mirroring `WebSearchCard`.
export type ToolCall = {
  name: string;
  input: Record<string, unknown>;
  considered: {
    title: string;
    category: string;
    difficulty?: string;
    total_time_min?: number;
    score?: number;
  }[];
  state: string;
};

export function CollectionSearchCard({ tool }: { tool?: ToolCall | null }) {
  if (!tool || tool.considered.length === 0) return null;

  return (
    <div className="mt-4">
      <Tool defaultOpen={false}>
        <ToolHeader
          title="Searched your collection"
          type="tool-search_collection"
          state="output-available"
        />
        <ToolContent>
          <ToolInput input={tool.input} />
          <ToolOutput
            errorText={undefined}
            output={
              <ul className="space-y-1.5 p-3 text-sm">
                {tool.considered.map((c) => (
                  <li
                    key={c.title}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>{c.title}</span>
                    <span className="flex items-center gap-2.5 text-muted-foreground">
                      <span>
                        {c.category}
                        {c.total_time_min ? ` · ~${c.total_time_min}m` : ""}
                      </span>
                      {typeof c.score === "number" && (
                        <span
                          className="font-mono text-xs text-muted-foreground/70"
                          title="cosine similarity"
                        >
                          {c.score.toFixed(2)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            }
          />
        </ToolContent>
      </Tool>
    </div>
  );
}
