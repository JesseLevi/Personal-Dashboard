// figma: node-id=3626:4515
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { ALL_ICON_NAMES } from "./Icon";
import { Tag, type TagProps } from "./Tag";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Fundament / Tag" } satisfies StoryDefault;

// Dev-only demo copy — not user-facing (component text always comes from `children` at call sites).
export const Overview = () => (
  <>
    <StoryIntro what="A small pill that labels a card: priority, size or a highlight." note="Tag" />
    <Specimens>
      <Specimen label="neutral" hint="default, no priority">
        <Tag variant="neutral">Neutral</Tag>
      </Specimen>
      <Specimen label="urgent" hint="priority urgent">
        <Tag variant="urgent">Urgent</Tag>
      </Specimen>
      <Specimen label="medium" hint="priority medium">
        <Tag variant="medium">Medium</Tag>
      </Specimen>
      <Specimen label="low" hint="priority low">
        <Tag variant="low">Low</Tag>
      </Specimen>
      <Specimen label="highlight" hint="no priority meaning">
        <Tag variant="highlight">Highlight</Tag>
      </Specimen>
    </Specimens>
  </>
);

export const Playground: Story<TagProps> = (props) => <Tag {...props} />;
Playground.args = { children: "Tag", variant: "neutral", icon: undefined };
Playground.argTypes = {
  variant: { control: { type: "select" }, options: ["neutral", "urgent", "medium", "low", "highlight"] },
  children: { control: { type: "text" } },
  icon: { control: { type: "select" }, options: ALL_ICON_NAMES },
};
