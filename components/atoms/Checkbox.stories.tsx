// figma: node-id=3727:4084
import { Checkbox } from "./Checkbox";

export const Unchecked = () => <Checkbox checked={false} />;

export const Checked = () => <Checkbox checked />;

export const Both = () => (
  <div className="flex gap-4">
    <Checkbox checked={false} />
    <Checkbox checked />
  </div>
);
