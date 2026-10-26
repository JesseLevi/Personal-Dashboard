import { useState } from "react";
import { StoryIntro } from "@/.ladle/story-kit";
import { Button } from "../atoms/Button";
import { Toast } from "./Toast";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Panelen / Toast" } satisfies StoryDefault;

const noop = () => {};

// Static: stays on screen so the baseline is deterministic. The toast is fixed at the top centre.
export const Overview = () => (
  <>
    <StoryIntro what="A short status message that slides in at the top centre and leaves again." note="Toast" />
    <Toast message="Gedeeld met Youri" onDismiss={noop} durationMs={Infinity} />
  </>
);

export const Playground: Story<{ message: string }> = ({ message }) => (
  <Toast key={message} message={message} onDismiss={noop} durationMs={Infinity} />
);
Playground.args = { message: "Gedeeld met Youri" };
Playground.argTypes = { message: { control: { type: "text" } } };

// Press the button: the toast slides down, stays 3 s, slides up and calls onDismiss.
export const Interactive = () => {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <>
      <Button onClick={() => setMessage("Gedeeld met Youri")}>Show toast</Button>
      <Toast message={message} onDismiss={() => setMessage(null)} />
    </>
  );
};
