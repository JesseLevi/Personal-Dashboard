import { WidgetSettingsPanel } from "./WidgetSettingsPanel";
import { WidgetSettings } from "./WidgetSettings";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { WidgetTokenItem } from "@/lib/widget/types";
import type { StoryDefault } from "@ladle/react";

export default { title: "Account / Widget settings panel" } satisfies StoryDefault;

// The panel is `position: fixed`, so the wrapper keeps the Provider div (the
// baseline crop) from collapsing. Actions are stood in by .ladle/mocks/widget-actions.ts.
const base = { open: true, onClose: () => {} } as const;

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

// With tokens (the Overview); never used shows "nooit".
export const Overview = () => (
  <div className="min-h-screen">
    <StoryIntro
      what="Level-2 panel of the settings: the member's iPhone-widget tokens, a form for a new token and the install steps. Deleting a token asks for confirmation in the footer."
      note="WidgetSettingsPanel"
    />
    <WidgetSettingsPanel {...base} tokens={someTokens} />
  </div>
);

export const Empty = () => (
  <div className="min-h-screen">
    <WidgetSettingsPanel {...base} tokens={[]} />
  </div>
);

export const JustCreated = () => (
  <div className="min-h-screen">
    <WidgetSettingsPanel {...base} tokens={someTokens} initialCreatedToken={CREATED} />
  </div>
);

export const LimitReached = () => (
  <div className="min-h-screen">
    <WidgetSettingsPanel {...base} tokens={fullTokens} />
  </div>
);

// The panel scrolls, so the install steps sit below the fold in the panel stories; this shows the four states in full.
export const Content = () => (
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
