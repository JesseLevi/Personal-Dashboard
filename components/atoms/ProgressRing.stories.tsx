// design: Claude-designed (#686)
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { ProgressRing, type ProgressRingTone } from "./ProgressRing";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Fundament / Progress ring" } satisfies StoryDefault;

const TONES: ProgressRingTone[] = ["blue", "green", "yellow", "neutral"];
const VALUES = [0, 14, 38, 72, 100];

// Dev-only demo copy, not user-facing.
export const Overview = () => (
  <>
    <StoryIntro what="A small ring that shows how far something is, from 0 to 100 percent." note="ProgressRing" />
    <Specimens>
      {TONES.map((tone) => (
        <Specimen key={tone} label={tone}>
          <span className="flex items-center gap-inline-lg">
            {VALUES.map((value) => (
              <ProgressRing key={value} tone={tone} value={value} label={`${value}%`} />
            ))}
          </span>
        </Specimen>
      ))}
    </Specimens>
  </>
);

export const Playground: Story<{ value: number; tone: ProgressRingTone }> = ({ value, tone }) => (
  <ProgressRing value={value} tone={tone} label={`${value}%`} />
);
Playground.args = { value: 72, tone: "blue" };
Playground.argTypes = {
  value: { control: { type: "range", min: 0, max: 100, step: 1 } },
  tone: { control: { type: "select" }, options: TONES },
};
