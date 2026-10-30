import { AiSettingsPanel } from "./AiSettingsPanel";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Account / AI settings panel" } satisfies StoryDefault;

// The panel is `position: fixed`, so the wrapper keeps the Provider div (the
// baseline crop) from collapsing. The action is stood in by .ladle/mocks/profile-actions.ts.
const base = { open: true, onClose: () => {} } as const;

// Opt-in on (the Overview), off, and no provider configured.
export const Overview = () => (
  <div className="min-h-screen">
    <StoryIntro
      what="Level-2 panel of the settings: the opt-in for connections, smart search and the Assistant. Turning it off asks for confirmation in the footer."
      note="AiSettingsPanel"
    />
    <AiSettingsPanel {...base} aiEnabled aiAvailable />
  </div>
);

export const Off = () => (
  <div className="min-h-screen">
    <AiSettingsPanel {...base} aiEnabled={false} aiAvailable />
  </div>
);

export const Unavailable = () => (
  <div className="min-h-screen">
    <AiSettingsPanel {...base} aiEnabled={false} aiAvailable={false} />
  </div>
);
