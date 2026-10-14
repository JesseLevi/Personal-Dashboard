import type { AgendaLinkCandidate } from "@/lib/agenda/links";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import { AgendaLinkSearchPanel, linkKey } from "./AgendaLinkSearchPanel";

// Dev-only mock search: the panel never imports the real "use server" module.
const candidates: AgendaLinkCandidate[] = [
  { kind: "recipe", id: "r1", title: "Pompoensoep met gember" },
  { kind: "recipe", id: "r2", title: "Soep van geroosterde tomaat" },
  { kind: "card", id: "c1", title: "Soepketel terugbrengen" },
  { kind: "note", id: "n1", title: "Soepen voor de winter" },
];

async function mockSearch(): Promise<AgendaActionResult<AgendaLinkCandidate[]>> {
  return { success: true, data: candidates };
}
async function mockSearchEmpty(): Promise<AgendaActionResult<AgendaLinkCandidate[]>> {
  return { success: true, data: [] };
}
async function mockSearchFailing(): Promise<AgendaActionResult<AgendaLinkCandidate[]>> {
  return { success: false, error: "generic" };
}
async function mockSelect(): Promise<AgendaActionResult<unknown>> {
  return { success: true, data: undefined };
}

// `min-h-screen` wrapper: SidePanel is `position: fixed` (see BoardPanel.stories.tsx). Harness-only.
const Harness = (props: Partial<Parameters<typeof AgendaLinkSearchPanel>[0]>) => (
  <div className="min-h-screen">
    <AgendaLinkSearchPanel
      open
      onClose={() => {}}
      onSearch={mockSearch}
      onSelect={mockSelect}
      linkedKeys={new Set()}
      {...props}
    />
  </div>
);

export const Empty = () => <Harness />;

export const Results = () => <Harness initialQuery="soep" />;

export const WithAlreadyLinked = () => (
  <Harness initialQuery="soep" linkedKeys={new Set([linkKey("recipe", "r1"), linkKey("note", "n1")])} />
);

export const NoResults = () => <Harness initialQuery="zzz" onSearch={mockSearchEmpty} />;

export const SearchFailed = () => <Harness initialQuery="soep" onSearch={mockSearchFailing} />;
