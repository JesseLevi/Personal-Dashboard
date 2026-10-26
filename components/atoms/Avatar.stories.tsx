// figma: node-id=4231:16053
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { Avatar, type AvatarProps } from "./Avatar";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Fundament / Avatar" } satisfies StoryDefault;

// Dev-only demo data. The image is an inline SVG data URI (no network in visual tests).
const IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='gray'/><circle cx='20' cy='16' r='7' fill='white'/><rect x='8' y='26' width='24' height='14' rx='7' fill='white'/></svg>";

export const Overview = () => (
  <>
    <StoryIntro what="A person's picture, or their initials when there is none." note="Avatar" />
    <Specimens>
      <Specimen label="initials, md" hint="square, 40 px (Sidebar account)">
        <Avatar name="Jesse Kamps" size="md" />
      </Specimen>
      <Specimen label="initials, sm" hint="round, 32 px">
        <Avatar name="Jesse Kamps" size="sm" />
      </Specimen>
      <Specimen label="image, md">
        <Avatar name="Jesse Kamps" src={IMAGE} size="md" />
      </Specimen>
      <Specimen label="image, sm">
        <Avatar name="Jesse Kamps" src={IMAGE} size="sm" />
      </Specimen>
    </Specimens>
  </>
);

type PlaygroundProps = Required<Pick<AvatarProps, "name" | "size">> & { withImage: boolean };

export const Playground: Story<PlaygroundProps> = ({ withImage, ...props }) => (
  <Avatar {...props} src={withImage ? IMAGE : undefined} />
);
Playground.args = { name: "Jesse Kamps", size: "md", withImage: false };
Playground.argTypes = {
  name: { control: { type: "text" } },
  size: { control: { type: "select" }, options: ["md", "sm"] },
  withImage: { control: { type: "boolean" } },
};
