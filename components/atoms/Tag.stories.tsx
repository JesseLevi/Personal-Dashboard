import { Tag } from "./Tag";

// Dev-only demo copy — not user-facing (component text always comes from `children` at call sites).
export const AllColors = () => (
  <div className="flex flex-wrap gap-3">
    <Tag color="grey">Grey</Tag>
    <Tag color="red">Red</Tag>
    <Tag color="yellow">Yellow</Tag>
    <Tag color="green">Green</Tag>
    <Tag color="blue">Blue</Tag>
  </div>
);

export const Grey = () => <Tag color="grey">Tag</Tag>;
export const Red = () => <Tag color="red">Tag</Tag>;
export const Yellow = () => <Tag color="yellow">Tag</Tag>;
export const Green = () => <Tag color="green">Tag</Tag>;
export const Blue = () => <Tag color="blue">Tag</Tag>;
