// design: Claude-designed on request (#341)
import { NoteBacklinks } from "./NoteBacklinks";

// Fixture notes, not app data.
const backlinks = [
  { id: "11111111-1111-4111-8111-111111111111", title: "Boodschappen deze week", category_name: "Huis" },
  { id: "22222222-2222-4222-8222-222222222222", title: "Vergadering met het team over de planning van het derde kwartaal", category_name: "Werk" },
  { id: "33333333-3333-4333-8333-333333333333", title: "", category_name: "Ideeen" },
];

export const Default = () => (
  <div className="w-full max-w-prose">
    <NoteBacklinks backlinks={backlinks} />
  </div>
);

export const Single = () => (
  <div className="w-full max-w-prose">
    <NoteBacklinks backlinks={backlinks.slice(0, 1)} />
  </div>
);

// Empty renders nothing (the section is hidden), so there is no story for it.
