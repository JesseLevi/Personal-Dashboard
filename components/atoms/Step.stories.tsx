// figma: node-id=3727:3208
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { Step } from "./Step";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Fundament / Step" } satisfies StoryDefault;

export const Overview = () => (
  <>
    <StoryIntro what="A numbered badge for recipe steps; one fixed look." note="Step" />
    <Specimens>
      <Specimen label="single" hint="one digit">
        <Step>1</Step>
      </Specimen>
      <Specimen label="sequence" hint="numbers run in a row">
        <div className="flex items-center gap-inline-sm">
          <Step>1</Step>
          <Step>2</Step>
          <Step>3</Step>
        </div>
      </Specimen>
    </Specimens>
  </>
);

export const Playground: Story<{ children: string }> = ({ children }) => <Step>{children}</Step>;
Playground.args = { children: "1" };
Playground.argTypes = { children: { control: { type: "text" } } };
