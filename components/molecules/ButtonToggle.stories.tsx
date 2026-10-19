// figma: node-id=4160:33335
import { Button } from "../atoms/Button";
import { ButtonToggle, type ButtonToggleItem } from "./ButtonToggle";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

// Real catalog content, not invented demo strings — the molecule's own real
// caller (SettingsPanel.tsx, #265) is this exact Kleurenthema toggle.
const themeItems: readonly ButtonToggleItem[] = [
  { value: "system", icon: "SunMoon", label: nl.components.settingsPanel.themeOptions.system },
  { value: "light", icon: "Sun", label: nl.components.settingsPanel.themeOptions.light },
  { value: "dark", icon: "Moon", label: nl.components.settingsPanel.themeOptions.dark },
];

const themeItemsEn: readonly ButtonToggleItem[] = [
  { value: "system", icon: "SunMoon", label: en.components.settingsPanel.themeOptions.system },
  { value: "light", icon: "Sun", label: en.components.settingsPanel.themeOptions.light },
  { value: "dark", icon: "Moon", label: en.components.settingsPanel.themeOptions.dark },
];

// This molecule is FILL-designed (Figma `layoutGrow: 1`/`hSize: FILL` on the
// component root and its track, see design/notes/ButtonToggle.md) — it
// stretches to whatever width its parent gives it, matching the real caller
// (SettingsPanel.tsx's 368px-wide panel content column). A bare flex-col
// wrapper with no width constraint would let it stretch to the whole story
// canvas, which doesn't demonstrate anything; `w-[368px]` on each wrapper
// reproduces the real container width instead.
export const WithTitle = () => (
  <div className="flex flex-col gap-8">
    <div className="w-[368px]">
      <ButtonToggle
        title={nl.components.settingsPanel.themeLabel}
        items={themeItems}
        defaultValue="system"
      />
    </div>
    <div className="w-[368px]">
      <ButtonToggle
        title={en.components.settingsPanel.themeLabel}
        items={themeItemsEn}
        defaultValue="dark"
      />
    </div>
  </div>
);

// No visible title — `aria-label` alone (TeDoenHeader-style toolbar usage).
export const WithoutTitle = () => (
  <div className="w-[368px]">
    <ButtonToggle items={themeItems} defaultValue="light" aria-label={nl.components.settingsPanel.themeLabel} />
  </div>
);

// Unequal label widths, the actual reason this molecule measures the
// indicator at runtime instead of reusing the old atom's fixed step table —
// still equal-width segments (`grow basis-0`), so the longer label proves
// the indicator scales, not the segment itself.
const mixedWidthItems: readonly ButtonToggleItem[] = [
  { value: "a", icon: "Sun", label: "A" },
  { value: "b", icon: "Moon", label: "A much longer label" },
  { value: "c", icon: "SunMoon", label: "Mid" },
];

export const VariableWidthSegments = () => (
  <div className="w-[368px]">
    <ButtonToggle items={mixedWidthItems} defaultValue="b" aria-label="Variable width demo" />
  </div>
);

// `size="small"`: the track is as high as the default Button next to it (40 px).
export const SmallBesideButton = () => (
  <div className="flex w-[560px] items-center gap-4">
    <ButtonToggle items={themeItems} defaultValue="light" size="small" aria-label={nl.components.settingsPanel.themeLabel} className="w-80" />
    <Button>Vandaag</Button>
  </div>
);

// Text only: `icon` is optional (Agenda's view toggle).
export const SmallTextOnly = () => (
  <div className="w-[368px]">
    <ButtonToggle
      items={[
        { value: "day", label: "Dag" },
        { value: "week", label: "Week" },
        { value: "month", label: "Maand" },
        { value: "list", label: "Lijst" },
      ]}
      defaultValue="week"
      size="small"
      aria-label="Weergave"
    />
  </div>
);
