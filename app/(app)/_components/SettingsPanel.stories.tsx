import { SettingsPanel } from "./SettingsPanel";
import { WidgetSettings } from "./WidgetSettings";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { WidgetTokenItem } from "@/lib/widget/types";
import type { StoryDefault } from "@ladle/react";

export default { title: "Account / Settings panel" } satisfies StoryDefault;

// Harness-only: SidePanel is `position: fixed`, so the wrapper keeps the
// Provider div (the baseline crop) from collapsing. Server actions are stood in
// by .ladle/mocks/profile-actions.ts and .ladle/mocks/widget-actions.ts.
const base = {
  open: true,
  onClose: () => {},
  currentLocale: "nl",
  currentDisplayName: "Jesse",
  currentLastName: "Kamps",
  hasAvatar: false,
  widgetTokens: [],
} as const;

const NAMES = ["iPhone van Jesse", "iPad", "Oude iPhone", "Telefoon van Lotte", "Test"];
const token = (n: number, used: boolean): WidgetTokenItem => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  label: NAMES[n - 1],
  createdAt: `2026-10-${10 + n}T12:00:00Z`,
  lastUsedAt: used ? "2026-10-29T12:00:00Z" : null,
});

const someTokens = [token(1, true), token(2, false)];
const fullTokens = [token(1, true), token(2, false), token(3, true), token(4, false), token(5, true)];
const CREATED = "atlas_wgt_Zm9yLWxhZGxlLXN0b3JpZXMtb25seS1ub3QtYS1yZWFsLXRva2Vu";

// "Verbanden en slim zoeken" opt-in (#579): off (default), on, and no provider configured.
export const AiOff = () => (
  <div className="min-h-screen">
    <SettingsPanel {...base} aiEnabled={false} aiAvailable />
  </div>
);

export const AiOn = () => (
  <div className="min-h-screen">
    <SettingsPanel {...base} aiEnabled aiAvailable />
  </div>
);

export const AiUnavailable = () => (
  <div className="min-h-screen">
    <SettingsPanel {...base} aiEnabled={false} aiAvailable={false} />
  </div>
);

// The panel scrolls, so the iPhone-widget section sits below the fold in the panel stories; this shows it in full.
export const Widget = () => (
  <Specimens>
    <Specimen label="Empty" hint="No token yet">
      <div className="w-96">
        <WidgetSettings tokens={[]} onAskDelete={() => {}} />
      </div>
    </Specimen>
    <Specimen label="With tokens" hint="Never used shows nooit">
      <div className="w-96">
        <WidgetSettings tokens={someTokens} onAskDelete={() => {}} />
      </div>
    </Specimen>
    <Specimen label="Just created" hint="Plaintext shown once">
      <div className="w-96">
        <WidgetSettings tokens={someTokens} initialCreatedToken={CREATED} onAskDelete={() => {}} />
      </div>
    </Specimen>
    <Specimen label="Limit reached" hint="5 tokens: New token disabled">
      <div className="w-96">
        <WidgetSettings tokens={fullTokens} onAskDelete={() => {}} />
      </div>
    </Specimen>
  </Specimens>
);

// The panel is `position: fixed`, so the intro sits in the dimmed area beside it.
export const Overview = () => (
  <div className="min-h-screen">
    <StoryIntro
      what="Side panel with the account settings: language, name, avatar, the opt-in for connections and smart search, and the iPhone widget (tokens and install steps)."
      note="SettingsPanel"
    />
    <SettingsPanel {...base} widgetTokens={someTokens} aiEnabled aiAvailable />
  </div>
);
