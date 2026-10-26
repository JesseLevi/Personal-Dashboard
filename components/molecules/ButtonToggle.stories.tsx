// figma: node-id=4160:33335
import { useState } from "react";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { Button } from "../atoms/Button";
import { ButtonToggle, type ButtonToggleItem } from "./ButtonToggle";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Invoer / Button toggle" } satisfies StoryDefault;

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

// FILL-designed (design/notes/ButtonToggle.md): it stretches to its parent, so each
// specimen gets the real caller's 368 px column.
const mixedWidthItems: readonly ButtonToggleItem[] = [
  { value: "a", icon: "Sun", label: "A" },
  { value: "b", icon: "Moon", label: "A much longer label" },
  { value: "c", icon: "SunMoon", label: "Mid" },
];

const viewItems: readonly ButtonToggleItem[] = [
  { value: "day", label: "Dag" },
  { value: "week", label: "Week" },
  { value: "month", label: "Maand" },
  { value: "list", label: "Lijst" },
];

export const Overview = () => (
  <>
    <StoryIntro what="A segmented toggle: one option is active, the indicator slides to it." note="ButtonToggle" />
    <Specimens>
      <Specimen label="with title" hint="Kleurenthema, as in SettingsPanel">
        <div className="w-[368px]">
          <ButtonToggle title={nl.components.settingsPanel.themeLabel} items={themeItems} defaultValue="system" />
        </div>
      </Specimen>
      <Specimen label="without title" hint="aria-label only (toolbar usage)">
        <div className="w-[368px]">
          <ButtonToggle items={themeItems} defaultValue="light" aria-label={nl.components.settingsPanel.themeLabel} />
        </div>
      </Specimen>
      <Specimen label="variable width" hint="indicator is measured, segments stay equal">
        <div className="w-[368px]">
          <ButtonToggle items={mixedWidthItems} defaultValue="b" aria-label="Variable width demo" />
        </div>
      </Specimen>
      <Specimen label="size small" hint="as high as a default Button (40 px)">
        <div className="flex w-[560px] items-center gap-inline-md">
          <ButtonToggle items={themeItems} defaultValue="light" size="small" aria-label={nl.components.settingsPanel.themeLabel} className="w-80" />
          <Button>Vandaag</Button>
        </div>
      </Specimen>
      <Specimen label="size small, text only" hint="icon is optional (Agenda view toggle)">
        <div className="w-[368px]">
          <ButtonToggle items={viewItems} defaultValue="week" size="small" aria-label="Weergave" />
        </div>
      </Specimen>
    </Specimens>
  </>
);

type PlaygroundProps = { size: "default" | "small"; tone: "default" | "button"; withIcons: boolean; title: string };

export const Playground: Story<PlaygroundProps> = ({ size, tone, withIcons, title }) => (
  <div className="w-[368px]">
    <ButtonToggle
      key={String(withIcons)}
      title={title}
      size={size}
      tone={tone}
      items={withIcons ? themeItems : viewItems}
      defaultValue={withIcons ? "light" : "week"}
    />
  </div>
);
Playground.args = { size: "default", tone: "default", withIcons: true, title: "Kleurenthema" };
Playground.argTypes = {
  size: { control: { type: "inline-radio" }, options: ["default", "small"] },
  tone: { control: { type: "inline-radio" }, options: ["default", "button"] },
  withIcons: { control: { type: "boolean" } },
  title: { control: { type: "text" } },
};

// Controlled: the chosen value is read back from the parent's state.
export const Interactive = () => {
  const [value, setValue] = useState("light");
  return (
    <div className="flex w-[368px] flex-col gap-stack-sm">
      <ButtonToggle items={themeItems} value={value} defaultValue={value} onValueChange={setValue} aria-label="Interactive toggle" />
      <p className="text-sm text-text-secondary">Selected: {value}</p>
    </div>
  );
};

// English catalog check.
export const English = () => (
  <div className="w-[368px]">
    <ButtonToggle title={en.components.settingsPanel.themeLabel} items={themeItemsEn} defaultValue="dark" />
  </div>
);
