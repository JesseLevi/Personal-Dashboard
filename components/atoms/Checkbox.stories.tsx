// figma: node-id=3727:4084
import { useState } from "react";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { Checkbox } from "./Checkbox";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Invoer / Checkbox" } satisfies StoryDefault;

export const Overview = () => (
  <>
    <StoryIntro what="A square checkbox button; the parent owns the checked state." note="Checkbox" />
    <Specimens>
      <Specimen label="checked={false}">
        <Checkbox checked={false} aria-label="Unchecked" />
      </Specimen>
      <Specimen label="checked">
        <Checkbox checked aria-label="Checked" />
      </Specimen>
    </Specimens>
  </>
);

export const Playground: Story<{ checked: boolean; disabled: boolean }> = (props) => (
  <Checkbox {...props} aria-label="Playground checkbox" />
);
Playground.args = { checked: false, disabled: false };
Playground.argTypes = {
  checked: { control: { type: "boolean" } },
  disabled: { control: { type: "boolean" } },
};

// Click, or focus and press Space: aria-checked follows the state passed back in.
export const Interactive = () => {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      checked={checked}
      aria-label="Interactive checkbox"
      onClick={() => setChecked((prev) => !prev)}
    />
  );
};
