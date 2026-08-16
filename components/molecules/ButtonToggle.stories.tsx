// figma: node-id=4160:33335
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

// `items-start` guards the same flex-col stretch trap every hug-width story
// in this codebase documents (see e.g. PortionStepper.stories.tsx) — a
// default `stretch` cross-axis would otherwise force the track full-width.
export const WithTitle = () => (
  <div className="flex flex-col items-start gap-8">
    <ButtonToggle
      title={nl.components.settingsPanel.themeLabel}
      items={themeItems}
      defaultValue="system"
    />
    <ButtonToggle
      title={en.components.settingsPanel.themeLabel}
      items={themeItemsEn}
      defaultValue="dark"
    />
  </div>
);

// No visible title — `aria-label` alone (TeDoenHeader-style toolbar usage).
export const WithoutTitle = () => (
  <ButtonToggle items={themeItems} defaultValue="light" aria-label={nl.components.settingsPanel.themeLabel} />
);

// Unequal label widths, the actual reason this molecule measures the
// indicator at runtime instead of reusing the old atom's fixed step table.
const mixedWidthItems: readonly ButtonToggleItem[] = [
  { value: "a", icon: "Sun", label: "A" },
  { value: "b", icon: "Moon", label: "A much longer label" },
  { value: "c", icon: "SunMoon", label: "Mid" },
];

export const VariableWidthSegments = () => (
  <ButtonToggle items={mixedWidthItems} defaultValue="b" aria-label="Variable width demo" />
);
