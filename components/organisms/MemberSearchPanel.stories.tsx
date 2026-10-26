// figma: node-id=4231:16811 (+4231:17096 result, 4233:17340 selected)
import { MemberSearchPanel } from "./MemberSearchPanel";
import type { ActionResult, MemberSearchResult } from "@/lib/sharing/types";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Panelen / Member search panel" } satisfies StoryDefault;

// Dev-only mock search: the panel never imports the real "use server" module
// (design/notes/MemberSearchPanel.md). Without `hasAvatar` every result shows
// the letter fallback, so the baselines need no /api/avatar route.

const members: MemberSearchResult[] = [
  {
    id: "member-1",
    displayName: "Jesse",
    lastName: "Kamps",
    hasAvatar: false,
    updatedAt: "2026-10-12T10:00:00Z",
    email: null,
  },
  {
    id: "member-2",
    displayName: "Jessica",
    lastName: "de Vries",
    hasAvatar: false,
    updatedAt: "2026-10-12T10:00:00Z",
    email: "jessica@voorbeeld.nl",
  },
];

async function mockSearch(input: unknown): Promise<ActionResult<typeof members>> {
  console.log("searchMembers", input);
  return { success: true, data: members };
}

async function mockSearchRateLimited(): Promise<ActionResult<typeof members>> {
  return { success: false, error: "rate-limited" };
}

async function mockSearchEmpty(): Promise<ActionResult<typeof members>> {
  return { success: true, data: [] };
}

// `min-h-screen` wrapper: SidePanel is `position: fixed` (see BoardPanel.stories.tsx). Harness-only.
const Harness = (props: Partial<Parameters<typeof MemberSearchPanel>[0]>) => (
  <div className="min-h-screen">
    <MemberSearchPanel open onClose={() => {}} onSearch={mockSearch} onSelect={() => {}} {...props} />
  </div>
);

// Figma 04: empty search field and the prompt.
export const Empty = () => <Harness />;

// Figma 05: results (one with the e-mail the RPC returns on an exact match).
export const Results = () => <Harness initialQuery="jes" />;

// Figma 06: one result selected (border), "Voeg toe" enabled.
export const Selected = () => <Harness initialQuery="jes" selectedId="member-2" />;

export const NoResults = () => <Harness initialQuery="zzz" onSearch={mockSearchEmpty} />;

export const RateLimited = () => <Harness initialQuery="jes" onSearch={mockSearchRateLimited} />;

// Recipe sharing (ADR-0036): the confirm button reads "Delen" with a check.
export const ShareRecipe = () => (
  <Harness initialQuery="jes" selectedId="member-2" confirmLabel="Delen" confirmIcon="Check" />
);
