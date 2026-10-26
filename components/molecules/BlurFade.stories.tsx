import { useState } from "react";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { Button } from "../atoms/Button";
import { blurFadeStagger } from "../../lib/ui/blur-fade";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Fundament / Blur fade" } satisfies StoryDefault;

function StaggerList({ mode, rows = 6 }: { mode: "in" | "out"; rows?: number }) {
  return (
    <ul className="flex w-80 flex-col gap-stack-sm">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className={`rounded-card bg-surface-secondary p-component-md text-text-secondary ${blurFadeStagger(i)} ${mode === "in" ? "animate-blur-in" : "animate-blur-out"}`}
        >
          Row {i + 1}
        </li>
      ))}
    </ul>
  );
}

export const Overview = () => (
  <>
    <StoryIntro what="Staggered blur-and-fade for lists that appear or leave; rows start 50 ms apart." note="BlurFade" />
    <Specimens>
      <Specimen label="animate-blur-in" hint="enter">
        <StaggerList mode="in" />
      </Specimen>
      <Specimen label="animate-blur-out" hint="exit">
        <StaggerList mode="out" />
      </Specimen>
    </Specimens>
  </>
);

export const Playground: Story<{ mode: "in" | "out"; rows: number }> = ({ mode, rows }) => (
  <StaggerList key={`${mode}-${rows}`} mode={mode} rows={rows} />
);
Playground.args = { mode: "in", rows: 6 };
Playground.argTypes = {
  mode: { control: { type: "inline-radio" }, options: ["in", "out"] },
  rows: { control: { type: "range" }, min: 1, max: 10, step: 1 },
};

// Remounting via `key` replays both animations.
export const Interactive = () => {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col gap-stack-md">
      <div>
        <Button onClick={() => setRun((n) => n + 1)}>Replay</Button>
      </div>
      <div key={run} className="flex gap-inline-xl">
        <StaggerList mode="out" />
        <StaggerList mode="in" />
      </div>
    </div>
  );
};
