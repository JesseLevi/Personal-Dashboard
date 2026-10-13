// design: Claude-designed (#492), see design/notes/OtpInput.md.
import { useState } from "react";
import { OtpInput } from "./OtpInput";

// Dev-only demo copy — not user-facing.
function Field({ initial = "", ...props }: { initial?: string } & Partial<React.ComponentProps<typeof OtpInput>>) {
  const [value, setValue] = useState(initial);
  return (
    <div className="w-[312px]">
      <OtpInput aria-label="Login code" value={value} onChange={setValue} {...props} />
    </div>
  );
}

// No focus: nothing is drawn active. Click the field to see the fake caret.
export const Empty = () => <Field />;

export const Partial = () => <Field initial="123" />;

export const Filled = () => <Field initial="123456" />;

export const ErrorState = () => <Field initial="123456" invalid />;

export const Disabled = () => <Field initial="123" disabled />;

// Focused with one digit typed: the next slot is active and shows the fake caret.
export const ActiveSlot = () => <Field initial="12" autoFocus />;
