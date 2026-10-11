import { useState } from "react";
import { Button } from "../atoms/Button";
import { blurFadeStagger } from "../../lib/ui/blur-fade";

const ROWS = [0, 1, 2, 3, 4, 5];

function StaggerList({ mode }: { mode: "in" | "out" }) {
  return (
    <ul className="flex w-80 flex-col gap-3">
      {ROWS.map((i) => (
        <li
          key={i}
          className={`rounded-xl bg-surface-secondary p-4 text-text-secondary ${blurFadeStagger(i)} ${mode === "in" ? "animate-blur-in" : "animate-blur-out"}`}
        >
          Row {i + 1}
        </li>
      ))}
    </ul>
  );
}

export const Enter = () => <StaggerList mode="in" />;

export const Exit = () => <StaggerList mode="out" />;

// Remounting via `key` replays both animations.
export const ExitThenEnter = () => {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <Button onClick={() => setRun((n) => n + 1)}>Replay</Button>
      <div key={run} className="flex gap-8">
        <StaggerList mode="out" />
        <StaggerList mode="in" />
      </div>
    </div>
  );
};
