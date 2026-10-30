import { SettingsPanel } from "./SettingsPanel";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Account / Settings panel" } satisfies StoryDefault;

// The panel is `position: fixed`, so the intro sits in the dimmed area beside it.
// Server actions are stood in by .ladle/mocks/profile-actions.ts and
// .ladle/mocks/widget-actions.ts. The two sub-panels have their own stories.
export const Overview = () => (
  <div className="min-h-screen">
    <StoryIntro
      what="Side panel with the account settings: theme, language, photo and name, plus two buttons that open the connections opt-in and the iPhone widget in a second panel."
      note="SettingsPanel"
    />
    <SettingsPanel
      open
      onClose={() => {}}
      currentLocale="nl"
      currentDisplayName="Jesse"
      currentLastName="Kamps"
      hasAvatar={false}
      aiEnabled
      aiAvailable
      widgetTokens={[]}
    />
  </div>
);
