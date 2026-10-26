// figma: node-id=3779:4846
import { useState } from "react";
import { SidePanel } from "./SidePanel";
import { Button } from "../atoms/Button";
import { InputField } from "../atoms/InputField";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Panelen / Side panel" } satisfies StoryDefault;

// Chrome text — sourced from the message catalog, not typed here directly.
const closeLabelEn = en.components.sidePanel.closeLabel;
const closeLabelNl = nl.components.sidePanel.closeLabel;

// Both shapes come from the SAME markup via `md:` classes — there is no
// separate "Mobile"/"Desktop" story, resize the actual browser to see the
// bottom-sheet below `md` vs. the side-drawer at/above it. This workbench's
// screenshot gate (a single fixed-viewport chromium project) only ever
// baselines the wide (desktop) shape — see design/notes/SidePanel.md.

// `min-h-screen` wrapper: SidePanel's overlay/panel are `position: fixed`,
// so they contribute 0 to their ancestors' flow height — without this, the
// Provider div (which tests/visual/screenshot-override.css crops the
// baseline to) would collapse to near-zero and the screenshot would miss
// almost the entire panel. Not needed by real app usage (the real page
// around SidePanel already has its own height), only by this harness.

// Figma's fetched "AddItem" sample: Naam/Omschrijving/Status/Prioriteit
// fields + Verwijderen(destructive)/Opslaan(filled) footer. #103: footer
// buttons share a row (`flex gap-2`) with `grow basis-0` each, the same
// full-width convention CardDetailPanel.tsx/BoardPanel.tsx use — SidePanel's
// own footer container only stretches whatever row(s) the caller nests
// inside it, so every multi-button footer (including this demo) must supply
// its own row wrapper or its buttons stack one-per-line instead of sharing one.
export const AddItem = () => (
  <div className="min-h-screen">
    <SidePanel
      open
      onClose={() => {}}
      title="Item toevoegen"
      closeLabel={closeLabelEn}
      footer={
        <div className="flex gap-2">
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
  </div>
);

// Figma's fetched "AddBoard" sample: a single name field, one Opslaan
// action — no destructive footer button. NL catalog check for closeLabel.
export const AddBoard = () => (
  <div className="min-h-screen">
    <SidePanel
      open
      onClose={() => {}}
      title="Bord toevoegen"
      closeLabel={closeLabelNl}
      footer={
        <div className="flex gap-2">
          <Button variant="filled" icon="Plus" className="grow basis-0">
            Opslaan
          </Button>
        </div>
      }
    >
      <InputField label="Naam" id="side-panel-demo-board-name" />
    </SidePanel>
  </div>
);

// Exercises the real open/close cycle — trigger click, overlay click,
// Escape, and focus returning to this same trigger. Not screenshot-stable
// by design (starts closed); use `pnpm ladle` to drive it by hand.
export const Interactive = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen p-4">
      <Button variant="filled" onClick={() => setOpen(true)}>
        Open panel
      </Button>
      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Item toevoegen"
        closeLabel={closeLabelEn}
        footer={
          <div className="flex gap-2">
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
