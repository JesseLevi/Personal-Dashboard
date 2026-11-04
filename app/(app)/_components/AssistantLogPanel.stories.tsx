import { AssistantLogPanel } from "./AssistantLogPanel";
import { assistantLogFixture, emptyAssistantLogFixture } from "@/.ladle/mocks/assistant-log-actions";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Account / Assistant log panel" } satisfies StoryDefault;

// The panel is `position: fixed`, so the wrapper keeps the Provider div (the
// baseline crop) from collapsing. The log is seeded through `initialLog`.
const base = { open: true, onClose: () => {} } as const;

// A log with every outcome, and an empty one.
export const Overview = () => (
  <div className="min-h-screen">
    <StoryIntro
      what="Level-2 panel opened from the AI settings: the Assistant's runs of the last 30 days per day, what it saw and answered per cluster, and the export for analysis."
      note="AssistantLogPanel"
    />
    <AssistantLogPanel {...base} initialLog={assistantLogFixture} />
  </div>
);

export const Empty = () => (
  <div className="min-h-screen">
    <AssistantLogPanel {...base} initialLog={emptyAssistantLogFixture} />
  </div>
);
