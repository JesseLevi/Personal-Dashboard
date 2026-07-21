// figma: node-id=3628:67
import type { ReactNode } from "react";
import type { Story } from "@ladle/react";
import { CardContentRecipe } from "./CardContentRecipe";
import { Card } from "./Card";

// Dev-only placeholder photo (inline data URI, no network dependency for the
// Ladle build) — a real call site supplies a stored recipe photo URL. Shape
// only, no colour baked in (a 1x1 transparent SVG): the thumbnail's visual
// footprint is conveyed by the `bg-surface-muted` backdrop below instead, so
// this file carries no hex, encoded or otherwise.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

// Renders a `bg-surface-muted` box the same size as the thumbnail (h-24 w-24,
// matching CardContentRecipe's own sizing) behind the story's render, so the
// intentionally-transparent placeholder image still reads as a photo slot in
// the Ladle workbench.
const ThumbnailBackdrop = ({ children }: { children: ReactNode }) => (
  <div className="grid">
    <div
      aria-hidden="true"
      className="col-start-1 row-start-1 h-24 w-24 rounded bg-surface-muted"
    />
    <div className="col-start-1 row-start-1">{children}</div>
  </div>
);

// Dev-only demo copy — not user-facing (real recipe data comes from the
// database at the call site, same pattern as Card's `title`).
export const Default = () => (
  <ThumbnailBackdrop>
    <CardContentRecipe
      imageUrl={PLACEHOLDER_IMAGE}
      name="Amandel Pasta"
      duration="20 min"
    />
  </ThumbnailBackdrop>
);

// Composed inside the Card molecule the way it slots in production (Card's
// SLOT "Type").
export const InCard = () => (
  <Card>
    <ThumbnailBackdrop>
      <CardContentRecipe
        imageUrl={PLACEHOLDER_IMAGE}
        name="Amandel Pasta"
        duration="20 min"
      />
    </ThumbnailBackdrop>
  </Card>
);

type PlaygroundProps = {
  name: string;
  duration: string;
};

export const Playground: Story<PlaygroundProps> = ({ name, duration }) => (
  <ThumbnailBackdrop>
    <CardContentRecipe
      imageUrl={PLACEHOLDER_IMAGE}
      name={name}
      duration={duration}
    />
  </ThumbnailBackdrop>
);

Playground.args = {
  name: "Amandel Pasta",
  duration: "20 min",
};

Playground.argTypes = {
  name: { control: { type: "text" } },
  duration: { control: { type: "text" } },
};
