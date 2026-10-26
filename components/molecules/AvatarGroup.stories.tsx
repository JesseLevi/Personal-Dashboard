// figma: node-id=4231:16052
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { AvatarGroup } from "./AvatarGroup";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Fundament / Avatar group" } satisfies StoryDefault;

// Dev-only demo data.
const MEMBERS = [
  { id: "1", name: "Jesse Kamps" },
  { id: "2", name: "Youri Tukker" },
  { id: "3", name: "Anne de Vries" },
  { id: "4", name: "Sam Bakker" },
  { id: "5", name: "Noor Smit" },
];

export const Overview = () => (
  <>
    <StoryIntro what="Overlapping avatars of the people a card or list is shared with." note="AvatarGroup" />
    <Specimens>
      <Specimen label="2 members">
        <AvatarGroup members={MEMBERS.slice(0, 2)} />
      </Specimen>
      <Specimen label="3 members">
        <AvatarGroup members={MEMBERS.slice(0, 3)} />
      </Specimen>
    </Specimens>
  </>
);

export const Playground: Story<{ count: number }> = ({ count }) => <AvatarGroup members={MEMBERS.slice(0, count)} />;
Playground.args = { count: 3 };
Playground.argTypes = { count: { control: { type: "range" }, min: 1, max: 5, step: 1 } };
