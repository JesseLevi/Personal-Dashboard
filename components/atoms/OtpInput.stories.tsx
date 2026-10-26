// design: Claude-designed (#492), see design/notes/OtpInput.md.
import { useState } from "react";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { OtpInput } from "./OtpInput";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Invoer / Otp input" } satisfies StoryDefault;

// Dev-only demo copy — not user-facing.
function Field({ initial = "", ...props }: { initial?: string } & Partial<React.ComponentProps<typeof OtpInput>>) {
  const [value, setValue] = useState(initial);
  return (
    <div className="w-[312px]">
      <OtpInput aria-label="Login code" value={value} onChange={setValue} {...props} />
    </div>
  );
}

export const Overview = () => (
  <>
    <StoryIntro what="A six-digit code field: one real input drawn as separate slots." note="OtpInput" />
    <Specimens>
      <Specimen label="empty" hint="no focus, nothing drawn active">
        <Field />
      </Specimen>
      <Specimen label="partial" hint="3 of 6 digits">
        <Field initial="123" />
      </Specimen>
      <Specimen label="filled">
        <Field initial="123456" />
      </Specimen>
      <Specimen label="invalid" hint="slots in the error colour">
        <Field initial="123456" invalid />
      </Specimen>
      <Specimen label="disabled">
        <Field initial="123" disabled />
      </Specimen>
    </Specimens>
  </>
);

type PlaygroundProps = { initial: string; length: number; invalid: boolean; disabled: boolean };

export const Playground: Story<PlaygroundProps> = ({ initial, ...props }) => (
  <Field key={`${initial}-${props.length}`} initial={initial} {...props} />
);
Playground.args = { initial: "12", length: 6, invalid: false, disabled: false };
Playground.argTypes = {
  initial: { control: { type: "text" } },
  length: { control: { type: "range" }, min: 4, max: 8, step: 1 },
  invalid: { control: { type: "boolean" } },
  disabled: { control: { type: "boolean" } },
};

// Click and type: digits only, backspace deletes, paste fills every slot.
export const Interactive = () => {
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-stack-sm">
      <Field onComplete={setDone} />
      <p className="text-sm text-text-secondary">{done ? `Complete: ${done}` : "Type six digits"}</p>
    </div>
  );
};

// Focused with two digits typed: the next slot is active and shows the fake caret.
export const ActiveSlot = () => <Field initial="12" autoFocus />;
