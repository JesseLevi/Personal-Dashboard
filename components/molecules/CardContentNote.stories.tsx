// figma: node-id=4067:18495
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { Story, StoryDefault } from "@ladle/react";
import { CardContentNote } from "./CardContentNote";
import { Card } from "./Card";

export default { title: "Basis / Kaarten / Card content note" } satisfies StoryDefault;

const SNIPPET = "Text from note that could be this long.";

// The relative-timestamp shapes of node 4067:19048; the caller, not this molecule, picks one.
export const Overview = () => (
  <>
    <StoryIntro what="A note in a list: title, timestamp and a two-line snippet." note="CardContentNote" />
    <Specimens>
      <Specimen label="default">
        <div className="w-72">
          <CardContentNote title="Note title" timestamp="12:24" snippet={SNIPPET} />
        </div>
      </Specimen>
      <Specimen label="in Card" hint="how it slots in (Card SLOT Type)">
        <Card>
          <CardContentNote title="Note title" timestamp="12:24" snippet={SNIPPET} />
        </Card>
      </Specimen>
      {["Gisteren", "12-03-2026"].map((timestamp) => (
        <Specimen key={timestamp} label={`timestamp ${timestamp}`}>
          <div className="w-72">
            <CardContentNote title="Note title" timestamp={timestamp} snippet={SNIPPET} />
          </div>
        </Specimen>
      ))}
    </Specimens>
  </>
);

// Title wraps (no truncation); snippet clamps to 2 lines with an ellipsis (#307, design/notes/CardContentNote.md).
export const LongText = () => (
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
