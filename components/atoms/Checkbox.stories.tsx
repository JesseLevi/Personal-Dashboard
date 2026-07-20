// figma: node-id=3727:4084
import { useState } from "react";
import { Checkbox } from "./Checkbox";

// Checked=No/Yes side by side — the full variant axis from the Figma
// component set, both rendered statically.
export const States = () => (
  <div className="flex gap-4">
    <Checkbox checked={false} />
    <Checkbox checked />
  </div>
);

// Exercises the #45 fix: clicking (or focusing + pressing Space, for free
// from the native <button> host) toggles the box, and aria-checked always
// reflects the composer-owned `checked` state passed back in.
export const Toggleable = () => {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      checked={checked}
      aria-label="Toggleable checkbox"
      onClick={() => setChecked((prev) => !prev)}
    />
  );
};
