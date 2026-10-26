import { useState } from "react";
import type { AgendaColor } from "../../lib/agenda/colors";
import nl from "../../messages/nl.json";
import { ColorSwatches } from "./ColorSwatches";
import type { StoryDefault } from "@ladle/react";

export default { title: "Agenda / Color swatches" } satisfies StoryDefault;

const label = nl.components.agendaCalendarsPanel.colorLabel;

// Width of the settings panel's content column.
const Panel = ({ children }: { children: React.ReactNode }) => <div className="w-96">{children}</div>;

const Controlled = ({ initial }: { initial: AgendaColor }) => {
  const [value, setValue] = useState(initial);
  return (
    <Panel>
      <ColorSwatches value={value} onChange={setValue} label={label} />
    </Panel>
  );
};

export const Default = () => <Controlled initial="blue" />;

export const OtherSelection = () => <Controlled initial="orange" />;

export const Disabled = () => (
  <Panel>
    <ColorSwatches value="violet" onChange={() => {}} label={label} disabled />
  </Panel>
);
