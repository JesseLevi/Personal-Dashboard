// figma: node-id=4067:18495
import type { Story, StoryDefault } from "@ladle/react";
import { CardContentNote } from "./CardContentNote";
import { Card } from "./Card";

export default { title: "Basis / Kaarten / Card content note" } satisfies StoryDefault;

const SNIPPET = "Text from note that could be this long.";

export const Default = () => (
  <div className="w-72">
    <CardContentNote title="Note title" timestamp="12:24" snippet={SNIPPET} />
  </div>
);

// Composed inside the Card molecule the way it slots in production (Card's
// SLOT "Type").
export const InCard = () => (
  <Card>
    <CardContentNote title="Note title" timestamp="12:24" snippet={SNIPPET} />
  </Card>
);

// The four relative-timestamp shapes observed on node 4067:19048 — the
// caller (not this molecule) decides which one applies.
export const TimestampForms = () => (
  <div className="flex w-72 flex-col gap-stack-md">
    <CardContentNote title="Note title" timestamp="12:24" snippet={SNIPPET} />
    <CardContentNote title="Note title" timestamp="Gisteren" snippet={SNIPPET} />
    <CardContentNote title="Note title" timestamp="12-03-2026" snippet={SNIPPET} />
    <CardContentNote title="Note title" timestamp="10-03-2026" snippet={SNIPPET} />
  </div>
);

// Title wraps (Figma: no truncation); snippet is clamped to 2 lines with an
// ellipsis per product decision #307 — see design/notes/CardContentNote.md.
export const LongTitleAndSnippet = () => (
  <div className="w-72">
    <CardContentNote
      title="A note title that is much longer than the sample and has to wrap"
      timestamp="10-03-2026"
      snippet="A much longer snippet of note text that keeps going well past what fits on a single line, to show the 2-line clamp."
    />
  </div>
);

type PlaygroundProps = {
  title: string;
  timestamp: string;
  snippet: string;
};

export const Playground: Story<PlaygroundProps> = ({ title, timestamp, snippet }) => (
  <div className="w-72">
    <CardContentNote title={title} timestamp={timestamp} snippet={snippet} />
  </div>
);

Playground.args = {
  title: "Note title",
  timestamp: "12:24",
  snippet: SNIPPET,
};

Playground.argTypes = {
  title: { control: { type: "text" } },
  timestamp: { control: { type: "text" } },
  snippet: { control: { type: "text" } },
};
