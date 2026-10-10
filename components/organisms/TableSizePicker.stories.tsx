// design: Claude-designed on request (#330)
import { useEffect, useRef } from "react";
import { TableSizePicker } from "./TableSizePicker";

// Opens at first paint and moves the highlight one column right (3 x 4), the
// same ArrowRight a keyboard user would press.
function OpenPicker() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      ref.current?.querySelector<HTMLButtonElement>("button")?.click();
      requestAnimationFrame(() => {
        document
          .querySelector("[role=grid]")
          ?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div ref={ref} className="flex min-h-96 w-full items-start">
      <TableSizePicker onInsert={() => {}} onDismiss={() => {}} tabIndex={0} onTriggerFocus={() => {}} />
    </div>
  );
}

export const Closed = () => (
  <TableSizePicker onInsert={() => {}} onDismiss={() => {}} tabIndex={0} onTriggerFocus={() => {}} />
);
export const Open = () => <OpenPicker />;
