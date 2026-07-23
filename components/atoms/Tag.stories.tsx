// figma: node-id=3626:4515
import { Tag } from "./Tag";

// Dev-only demo copy — not user-facing (component text always comes from `children` at call sites).
export const AllVariants = () => (
  <div className="flex flex-wrap gap-3">
    <Tag variant="neutral">Neutral</Tag>
    <Tag variant="urgent">Urgent</Tag>
    <Tag variant="medium">Medium</Tag>
    <Tag variant="low">Low</Tag>
    <Tag variant="highlight">Highlight</Tag>
  </div>
);

export const Neutral = () => <Tag variant="neutral">Tag</Tag>;
export const Urgent = () => <Tag variant="urgent">Tag</Tag>;
export const Medium = () => <Tag variant="medium">Tag</Tag>;
export const Low = () => <Tag variant="low">Tag</Tag>;
export const Highlight = () => <Tag variant="highlight">Tag</Tag>;
