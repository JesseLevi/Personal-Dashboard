// figma: node-id=4231:16052
import { AvatarGroup } from "./AvatarGroup";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Fundament / Avatar group" } satisfies StoryDefault;

// Dev-only demo data.
export const TwoMembers = () => (
  <AvatarGroup
    members={[
      { id: "1", name: "Jesse Kamps" },
      { id: "2", name: "Youri Tukker" },
    ]}
  />
);

export const ThreeMembers = () => (
  <AvatarGroup
    members={[
      { id: "1", name: "Jesse Kamps" },
      { id: "2", name: "Youri Tukker" },
      { id: "3", name: "Anne de Vries" },
    ]}
  />
);
