// design: Claude-designed on request (#342)
import { NoteTableOfContents } from "./NoteTableOfContents";

// Fixture headings, not app data.
const items = [
  { id: "h1", level: 1, text: "Weekplanning" },
  { id: "h2", level: 2, text: "Boodschappen" },
  { id: "h3", level: 3, text: "Groente en fruit" },
  { id: "h4", level: 3, text: "Vlees, vis en een heel lange kop die afgekapt moet worden" },
  { id: "h5", level: 2, text: "Koken" },
  { id: "h6", level: 1, text: "Verbouwing" },
];

const noop = () => {};

// The rail is 11rem wide in the app (w-44): a sticky aside right of the reading column.
export const Default = () => (
  <div className="w-44">
    <NoteTableOfContents items={items} activeId="h3" onSelect={noop} />
  </div>
);

export const FirstActive = () => (
  <div className="w-44">
    <NoteTableOfContents items={items.slice(0, 3)} activeId="h1" onSelect={noop} />
  </div>
);
