import type { AgendaEventRef } from "@/lib/agenda/links";
import { EventLinkLine } from "./EventLinkLine";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Agenda / Event link line" } satisfies StoryDefault;

const event = (id: string, title: string, startsAt: string, allDay = false): AgendaEventRef => ({
  id,
  title,
  startsAt,
  allDay,
});

const dentist = event("e1", "Tandarts", "2026-01-14T08:00:00Z");
const dinner = event("e2", "Etentje met Marie", "2026-01-16T17:30:00Z");
const holiday = event("e3", "Vakantie", "2026-02-02T00:00:00Z", true);
const party = event("e4", "Verjaardag opa", "2026-02-20T00:00:00Z", true);

export const Overview = () => (
  <div>
    <StoryIntro what="One line under a card or note listing the events it is linked to, with a count when they do not fit." note="EventLinkLine" />
    <Specimens>
      <Specimen label="One">
        <div className="w-72">
          <EventLinkLine events={[dentist]} />
        </div>
      </Specimen>
      <Specimen label="Several">
        <div className="w-72">
          <EventLinkLine events={[dentist, dinner, holiday]} />
        </div>
      </Specimen>
      <Specimen label="Overflow" hint="four events">
        <div className="w-72">
          <EventLinkLine events={[dentist, dinner, holiday, party]} />
        </div>
      </Specimen>
    </Specimens>
  </div>
);

export const One = () => (
  <div className="w-72">
    <EventLinkLine events={[dentist]} />
  </div>
);

export const Several = () => (
  <div className="w-72">
    <EventLinkLine events={[dentist, dinner, holiday]} />
  </div>
);

export const Overflow = () => (
  <div className="w-72">
    <EventLinkLine events={[dentist, dinner, holiday, party]} />
  </div>
);

export const None = () => (
  <div className="w-72 text-sm text-text-secondary">
    <EventLinkLine events={[]} />
    Geen regel zonder koppelingen.
  </div>
);
