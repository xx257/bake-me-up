"use client";

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

// One entry per web-search tool call the coach made this turn (usually one).
export type WebSearchCall = {
  query: string;
  sources: { title: string; url: string }[];
  result_count: number;
};

// "Searched the web" card — the Tavily fallback surfaced like the "Searched your collection"
// card, so the web lookup the coach did is visible (and its sources clickable).
export function WebSearchCard({
  webSearch,
}: {
  webSearch?: WebSearchCall[] | null;
}) {
  if (!webSearch || webSearch.length === 0) return null;

  return (
    <>
      {webSearch.map((w, i) => (
        <div key={`${i}-${w.query}`} className="mt-4">
          <Tool defaultOpen={false}>
            <ToolHeader
              title="Searched the web"
              type="tool-web_search"
              state="output-available"
            />
            <ToolContent>
              <ToolInput input={{ query: w.query }} />
              <ToolOutput
                errorText={undefined}
                output={
                  <ul className="space-y-1.5 p-3 text-sm">
                    {w.sources.length === 0 ? (
                      <li className="text-muted-foreground">
                        No linked sources for this query.
                      </li>
                    ) : (
                      w.sources.map((s) => (
                        <li key={s.url}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {s.title || s.url}
                          </a>
                        </li>
                      ))
                    )}
                  </ul>
                }
              />
            </ToolContent>
          </Tool>
        </div>
      ))}
    </>
  );
}
