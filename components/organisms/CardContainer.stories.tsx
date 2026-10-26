// figma: node-id=3650:1297
import type { ReactNode } from "react";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { CardContainer } from "./CardContainer";
import { Card } from "../molecules/Card";
import { CardContentRecipe } from "../molecules/CardContentRecipe";
import { Button } from "../atoms/Button";
import { ALL_ICON_NAMES, type IconName } from "../atoms/Icon";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Kaarten / Card container" } satisfies StoryDefault;

// Dev-only placeholder photo — no fill of its own to reproduce on the
// `<img>`; ThumbnailBackdrop below supplies it. See
// design/notes/CardContentRecipe.md.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

// Backdrop behind the placeholder image, same size as the thumbnail. See
// design/notes/CardContentRecipe.md.
const ThumbnailBackdrop = ({ children }: { children: ReactNode }) => (
  <div className="grid">
    <div
      aria-hidden="true"
      className="col-start-1 row-start-1 h-24 w-24 rounded bg-surface-primary"
    />
    <div className="col-start-1 row-start-1">{children}</div>
  </div>
);

// Chrome text — sourced from the message catalog, not typed here directly.
const addLabelEn = en.components.cardContainer.addLabel;
const editLabelEn = en.components.cardContainer.editLabel;
const addItemLabelEn = en.components.cardContainer.addItemLabel;

const Recipe = ({ name, duration }: { name: string; duration: string }) => (
  <Card>
    <ThumbnailBackdrop>
      <CardContentRecipe imageUrl={PLACEHOLDER_IMAGE} name={name} duration={duration} />
    </ThumbnailBackdrop>
  </Card>
);

export const Overview = () => (
  <>
    <StoryIntro what="A named, counted group of cards with add and edit buttons." note="CardContainer" />
    <Specimens>
      <Specimen label="default" hint="matches the Figma Ontbijt sample">
        <div className="w-96">
          <CardContainer name="Ontbijt" count="4" addLabel={addLabelEn} editLabel={editLabelEn}>
            <Recipe name="Amandel Pasta" duration="20 min" />
            <Recipe name="Havermout" duration="10 min" />
          </CardContainer>
        </div>
      </Specimen>
      <Specimen label="icon" hint="page-instance override, Te-Doen Ideeën uses Lightbulb">
        <div className="w-96">
          <CardContainer name="Ideeën" count="2" icon="Lightbulb" addLabel={addLabelEn} editLabel={editLabelEn}>
            <Recipe name="Amandel Pasta" duration="20 min" />
          </CardContainer>
        </div>
      </Specimen>
    </Specimens>
  </>
);

type PlaygroundProps = { name: string; count: string; icon?: IconName };

export const Playground: Story<PlaygroundProps> = ({ name, count, icon }) => (
  <div className="w-96">
    <CardContainer name={name} count={count} icon={icon} addLabel={addLabelEn} editLabel={editLabelEn}>
      <Recipe name="Amandel Pasta" duration="20 min" />
    </CardContainer>
  </div>
);
Playground.args = { name: "Ontbijt", count: "1" };
Playground.argTypes = {
  name: { control: { type: "text" } },
  count: { control: { type: "text" } },
  icon: { control: { type: "select" }, options: ALL_ICON_NAMES },
};

// #87: `emptyState` slot (Figma "EmptyState" frame, node 3878:10175): a centred
// white `Button` with a Plus replaces `children`.
export const Empty = () => (
  <div className="w-96">
    <CardContainer
      name="Ideeën"
      count="0"
      icon="Lightbulb"
      addLabel={addLabelEn}
      editLabel={editLabelEn}
      emptyState={
        <Button variant="white" icon="Plus">
          {addItemLabelEn}
        </Button>
      }
    />
  </div>
);

export const Dutch = () => (
  <div className="w-96">
    <CardContainer
      name="Ontbijt"
      count="4"
      addLabel={nl.components.cardContainer.addLabel}
      editLabel={nl.components.cardContainer.editLabel}
    >
      <Recipe name="Amandel Pasta" duration="20 min" />
    </CardContainer>
  </div>
);
