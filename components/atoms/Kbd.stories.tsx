// design: Claude-designed (#686)
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { Kbd } from "./Kbd";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Fundament / Kbd" } satisfies StoryDefault;

// Dev-only demo copy, not user-facing.
export const Overview = () => (
  <>
    <StoryIntro what="A small chip that shows a keyboard key." note="Kbd" />
    <Specimens>
      <Specimen label="letter" hint="one key">
        <Kbd>K</Kbd>
      </Specimen>
      <Specimen label="symbol" hint="arrows and return">
        <span className="flex gap-inline-xs">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <Kbd>↵</Kbd>
        </span>
      </Specimen>
      <Specimen label="word" hint="grows with its label">
        <Kbd>esc</Kbd>
      </Specimen>
    </Specimens>
  </>
);
