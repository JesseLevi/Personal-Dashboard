// figma: node-id=3760:6187
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { ALL_ICON_NAMES, Icon, type IconName } from "./Icon";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Fundament / Icon" } satisfies StoryDefault;

// Every IconName comes from the Icon module itself, so a new icon shows up here
// with no story edit. Flags (NL/UK) share the grid: same atom, same size.
export const Overview = () => (
  <>
    <StoryIntro what="The single icon atom: every glyph in the app, plus the NL/UK flags." note="Icon" />
    <div className="flex flex-col gap-stack-xl">
      <Specimens>
        {[16, 24, 32].map((size) => (
          <Specimen key={size} label={`size ${size}`} hint={size === 24 ? "default" : undefined}>
            <Icon name="Star" size={size} className="text-text-secondary" />
          </Specimen>
        ))}
        <Specimen label="size 48, strokeWidth 1.5" hint="thinner stroke for large icons">
          <Icon name="Star" size={48} strokeWidth={1.5} className="text-text-secondary" />
        </Specimen>
      </Specimens>
      <div className="grid grid-cols-4 gap-stack-md bg-surface-highlight-white p-component-lg sm:grid-cols-6">
        {ALL_ICON_NAMES.map((name) => (
          <div
            key={name}
            className="flex flex-col items-center gap-stack-xs rounded-control border border-stroke-lines p-component-sm text-text-primary"
          >
            <Icon name={name} />
            <span className="text-xs text-text-secondary">{name}</span>
          </div>
        ))}
      </div>
    </div>
  </>
);

type PlaygroundProps = { name: IconName; size: number; strokeWidth: number };

export const Playground: Story<PlaygroundProps> = (props) => (
  <Icon {...props} className="text-text-primary" />
);
Playground.args = { name: "Star", size: 24, strokeWidth: 2 };
Playground.argTypes = {
  name: { control: { type: "select" }, options: ALL_ICON_NAMES },
  size: { control: { type: "range" }, min: 12, max: 96, step: 4 },
  strokeWidth: { control: { type: "range" }, min: 1, max: 3, step: 0.25 },
};
