// figma: node-id=3779:4846
import { useState } from "react";
import { PanelFrame, StoryIntro } from "@/.ladle/story-kit";
import { SidePanel } from "./SidePanel";
import { Button } from "../atoms/Button";
import { InputField } from "../atoms/InputField";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Panelen / Side panel" } satisfies StoryDefault;

// Chrome text — sourced from the message catalog, not typed here directly.
const closeLabelEn = en.components.sidePanel.closeLabel;
const closeLabelNl = nl.components.sidePanel.closeLabel;

// One markup, two shapes via `md:` classes: a bottom sheet below `md`, a side drawer from `md` up.
// The panel is `position: fixed`, so variants cannot sit side by side: Overview shows the
// Figma "AddItem" sample open, the other shapes are separate stories. The `min-h-screen`
// wrapper keeps the baseline crop tall enough (the fixed panel adds no flow height).
// Footer buttons share a row with `grow basis-0` each, the CardDetailPanel/BoardPanel convention.
export const Overview = () => (
  <PanelFrame>
    <StoryIntro what="A pull-up panel for forms: a side drawer on desktop, a bottom sheet on mobile." note="SidePanel" />
    <SidePanel
      open
      onClose={() => {}}
      title="Item toevoegen"
      closeLabel={closeLabelEn}
      footer={
        <div className="flex gap-inline-sm">
          <Button variant="destructive" icon="Trash" className="grow basis-0">
            Verwijderen
          </Button>
          <Button variant="filled" icon="Plus" className="grow basis-0">
            Opslaan
          </Button>
        </div>
      }
    >
      <InputField label="Naam" id="side-panel-demo-name" defaultValue="HBO Wachtwoord updaten" />
      <InputField label="Omschrijving" id="side-panel-demo-description" />
    </SidePanel>
  </PanelFrame>
);

type PlaygroundProps = { title: string; withFooter: boolean; level: 1 | 2 };

export const Playground: Story<PlaygroundProps> = ({ title, withFooter, level }) => (
  <PanelFrame>
    <SidePanel
      open
      onClose={() => {}}
      title={title}
      closeLabel={closeLabelEn}
      level={level}
      footer={
        withFooter ? (
          <div className="flex gap-inline-sm">
            <Button variant="filled" icon="Plus" className="grow basis-0">
              Opslaan
            </Button>
          </div>
        ) : undefined
      }
    >
      <InputField label="Naam" id="side-panel-playground-name" />
    </SidePanel>
  </PanelFrame>
);
Playground.args = { title: "Item toevoegen", withFooter: true, level: 1 };
Playground.argTypes = {
  title: { control: { type: "text" } },
  withFooter: { control: { type: "boolean" } },
  level: { control: { type: "inline-radio" }, options: [1, 2] },
};

// Real open/close cycle: trigger click, overlay click, Escape, and focus returning to
// the trigger. Starts closed, so it is not screenshot-stable by design.
export const Interactive = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen p-component-md [contain:layout]">
      <Button variant="filled" onClick={() => setOpen(true)}>
        Open panel
      </Button>
      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Item toevoegen"
        closeLabel={closeLabelEn}
        footer={
          <div className="flex gap-inline-sm">
            <Button variant="filled" icon="Plus" className="grow basis-0">
              Opslaan
            </Button>
          </div>
        }
      >
        <InputField label="Naam" id="side-panel-demo-interactive-name" />
      </SidePanel>
    </div>
  );
};

// Figma "AddBoard": one name field, one Opslaan action, no destructive button; NL close label.
export const Dutch = () => (
  <PanelFrame>
    <SidePanel
      open
      onClose={() => {}}
      title="Bord toevoegen"
      closeLabel={closeLabelNl}
      footer={
        <div className="flex gap-inline-sm">
          <Button variant="filled" icon="Plus" className="grow basis-0">
            Opslaan
          </Button>
        </div>
      }
    >
      <InputField label="Naam" id="side-panel-demo-board-name" />
    </SidePanel>
  </PanelFrame>
);
