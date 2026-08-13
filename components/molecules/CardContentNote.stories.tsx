// figma: node-id=4067:18495
import type { Story } from "@ladle/react";
import { CardContentNote } from "./CardContentNote";
import { Card } from "./Card";

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

// Fetched node has textTruncation DISABLED on both title and snippet — long
// text wraps onto extra lines (growing the card) rather than being clipped
// or ellipsized; no line-clamp exists in the design. This story shows that.
export const LongTitleAndSnippet = () => (
  <div className="w-72">
    <CardContentNote
      title="A note title that is much longer than the sample and has to wrap"
      timestamp="10-03-2026"
      snippet="A much longer snippet of note text that keeps going well past what fits on a single line, to show it wraps instead of truncating."
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
