// figma: node-id=3705:4446
import { useState } from "react";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { Button } from "./Button";
import { Dropdown } from "./Dropdown";
import { Tag } from "./Tag";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Invoer / Dropdown" } satisfies StoryDefault;

// Dev-only demo copy — not user-facing (real labels/option text come from
// next-intl catalogs at the call site).

// The first child is the current selection and stays visible; the others
// collapse. It is presentational: the single trigger button spans the row.
// Children must be a flat list, not a wrapping component: Dropdown splits off the first child.
const options = () => [
  <Button key="a" presentational variant="filled" icon="Plus" align="left">
    Categorie
  </Button>,
  <Button key="b" variant="white" icon="Plus" align="left">
    Categorie
  </Button>,
  <Button key="c" variant="white" icon="Plus" align="left">
    Categorie
  </Button>,
];

export const Overview = () => (
  <>
    <StoryIntro what="A labelled disclosure: the selected option stays visible, the rest fold away." note="Dropdown" />
    <Specimens>
      <Specimen label="closed" hint="only the selection and chevron">
        <div className="w-72">
          <Dropdown id="overview-closed" label="Field" defaultOpen={false}>
            {options()}
          </Dropdown>
        </div>
      </Specimen>
      <Specimen label="open" hint="all options, each full width">
        <div className="w-72">
          <Dropdown id="overview-open" label="Field" defaultOpen>
            {options()}
          </Dropdown>
        </div>
      </Specimen>
      <Specimen label="Tag as selection" hint="Prioriteit / Grootte: inert content in the trigger">
        <div className="w-72">
          <Dropdown id="overview-tag" label="Prioriteit" defaultOpen={false}>
            <Tag variant="urgent">Urgent</Tag>
            <Tag variant="medium">Gemiddeld</Tag>
            <Tag variant="low">Laag</Tag>
          </Dropdown>
        </div>
      </Specimen>
    </Specimens>
  </>
);

type PlaygroundProps = { label: string; defaultOpen: boolean };

export const Playground: Story<PlaygroundProps> = ({ label, defaultOpen }) => (
  <div className="w-72">
    <Dropdown key={String(defaultOpen)} id="playground" label={label} defaultOpen={defaultOpen}>
      {options()}
    </Dropdown>
  </div>
);
Playground.args = { label: "Field", defaultOpen: true };
Playground.argTypes = {
  label: { control: { type: "text" } },
  defaultOpen: { control: { type: "boolean" } },
};

const CHOICES = ["Urgent", "Gemiddeld", "Laag"] as const;
const VARIANT = { Urgent: "urgent", Gemiddeld: "medium", Laag: "low" } as const;

// Click the selection to open, pick another option (the list closes with it), Escape re-closes.
export const Interactive = () => {
  const [selected, setSelected] = useState<(typeof CHOICES)[number]>("Urgent");
  return (
    <div className="w-72">
      <Dropdown key={selected} id="interactive" label="Prioriteit" defaultOpen={false}>
        <Tag variant={VARIANT[selected]}>{selected}</Tag>
        {CHOICES.filter((c) => c !== selected).map((choice) => (
          <Button key={choice} variant="white" align="left" onClick={() => setSelected(choice)}>
            {choice}
          </Button>
        ))}
      </Dropdown>
    </div>
  );
};
