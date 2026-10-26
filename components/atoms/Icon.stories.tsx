// figma: node-id=3760:6187
import { ALL_ICON_NAMES, Icon } from "./Icon";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Fundament / Icon" } satisfies StoryDefault;

// Every IconName comes from the Icon module itself, so a new icon shows up here
// with no story edit. Flags (NL/UK) share the grid: same atom, same size.
export const AllIcons = () => (
  <div className="grid grid-cols-4 gap-4 bg-surface-highlight-white p-6 sm:grid-cols-6">
    {ALL_ICON_NAMES.map((name) => (
      <div
        key={name}
        className="flex flex-col items-center gap-2 rounded-md border border-stroke-lines p-3 text-text-primary"
      >
        <Icon name={name} />
        <span className="text-xs text-text-secondary">{name}</span>
      </div>
    ))}
  </div>
);

export const Sizes = () => (
  <div className="flex items-end gap-4 bg-surface-highlight-white p-6 text-text-secondary">
    <Icon name="Star" size={16} />
    <Icon name="Star" size={24} />
    <Icon name="Star" size={32} />
    <Icon name="Star" size={48} strokeWidth={1.5} />
  </div>
);
