// figma: node-id=3670:1696
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { CardContentTicket } from "./CardContentTicket";
import { Tag } from "../atoms/Tag";
import { Card } from "./Card";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Kaarten / Card content ticket" } satisfies StoryDefault;

// The due date is a static stand-in for useFormatter().dateTime(...) in TeDoenBoard.
export const Overview = () => (
  <>
    <StoryIntro what="A Te-doen ticket: title with priority, size, due date and planned day." note="CardContentTicket" />
    <Specimens>
      <Specimen label="default">
        <div className="w-96">
          <CardContentTicket title="HBO Wachtwoord updaten">
            <Tag variant="medium">Medium</Tag>
            <Tag variant="neutral">S</Tag>
          </CardContentTicket>
        </div>
      </Specimen>
      <Specimen label="in Card" hint="how it slots in (Card SLOT Type)">
        <Card>
          <CardContentTicket title="HBO Wachtwoord updaten">
            <Tag variant="medium">Medium</Tag>
            <Tag variant="neutral">S</Tag>
          </CardContentTicket>
        </Card>
      </Specimen>
      <Specimen label="many labels" hint="SLOT wraps: pills go to a second line">
        <div className="w-72">
          <CardContentTicket title="Zorgverzekering vergelijken en overstappen">
            <Tag variant="urgent">Urgent</Tag>
            <Tag variant="neutral">M</Tag>
            <Tag variant="neutral">Verzekering</Tag>
            <Tag variant="neutral">Financieel</Tag>
          </CardContentTicket>
        </div>
      </Specimen>
      <Specimen label="with due date" hint="priority, size, deadline (#93)">
        <div className="w-80">
          <CardContentTicket title="Offertes opvragen voor het reinigen van de dakgoot">
            <Tag variant="low">Laag</Tag>
            <Tag variant="neutral">S</Tag>
            <Tag variant="neutral">01-04-2026</Tag>
          </CardContentTicket>
        </div>
      </Specimen>
      <Specimen label="with planned day" hint="shown compact after the deadline; not a deadline">
        <div className="w-80">
          <CardContentTicket title="Offertes opvragen voor het reinigen van de dakgoot" plannedLabel="za" plannedCaption="Gepland op">
            <Tag variant="low">Laag</Tag>
            <Tag variant="neutral">S</Tag>
            <Tag variant="neutral">01-04-2026</Tag>
          </CardContentTicket>
        </div>
      </Specimen>
      <Specimen label="with planned date">
        <div className="w-80">
          <CardContentTicket title="HBO Wachtwoord updaten" plannedLabel="3 nov" plannedCaption="Gepland op">
            <Tag variant="medium">Medium</Tag>
          </CardContentTicket>
        </div>
      </Specimen>
    </Specimens>
  </>
);
