import { useState } from "react";
import { AgendaDayStrip } from "./AgendaDayStrip";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Agenda / Agenda day strip" } satisfies StoryDefault;

const TODAY = "2026-10-20";

export const Overview = () => (
  <div>
    <StoryIntro
      what="The mobile day picker in the agenda header: Monday to Sunday, swipe to move a week, the shown day in a tile."
      note="AgendaPage"
    />
    <Specimens>
      <Specimen label="Today" hint="today is red">
        <div className="w-96">
          <AgendaDayStrip date={TODAY} today={TODAY} onSelect={() => {}} />
        </div>
      </Specimen>
      <Specimen label="Other day selected">
        <div className="w-96">
          <AgendaDayStrip date="2026-10-23" today={TODAY} onSelect={() => {}} />
        </div>
      </Specimen>
    </Specimens>
  </div>
);

// The strip lives in the header below `lg`; a phone-wide frame shows it on its own.
export const Today = () => (
  <div className="w-96">
    <AgendaDayStrip date={TODAY} today={TODAY} onSelect={() => {}} />
  </div>
);

export const OtherDaySelected = () => (
  <div className="w-96">
    <AgendaDayStrip date="2026-10-23" today={TODAY} onSelect={() => {}} />
  </div>
);

// Not screenshot-stable by design: swipe to snap to the next or previous week.
export const Interactive = () => {
  const [date, setDate] = useState(TODAY);
  return (
    <div className="w-96">
      <AgendaDayStrip date={date} today={TODAY} onSelect={setDate} />
      <p className="text-sm text-text-secondary">{date}</p>
    </div>
  );
};
