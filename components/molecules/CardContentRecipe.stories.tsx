// figma: node-id=3628:67
import type { Story } from "@ladle/react";
import { CardContentRecipe } from "./CardContentRecipe";
import { Card } from "./Card";

// Dev-only placeholder photo (inline data URI, no network dependency for the
// Ladle build) — a real call site supplies a stored recipe photo URL.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' fill='%23A8A29E'/%3E%3C/svg%3E";

// Dev-only demo copy — not user-facing (real recipe data comes from the
// database at the call site, same pattern as Card's `title`).
export const Default = () => (
  <CardContentRecipe
    imageUrl={PLACEHOLDER_IMAGE}
    name="Amandel Pasta"
    duration="20 min"
  />
);

// Composed inside the Card molecule the way it slots in production (Card's
// SLOT "Type").
export const InCard = () => (
  <Card>
    <CardContentRecipe
      imageUrl={PLACEHOLDER_IMAGE}
      name="Amandel Pasta"
      duration="20 min"
    />
  </Card>
);

type PlaygroundProps = {
  name: string;
  duration: string;
};

export const Playground: Story<PlaygroundProps> = ({ name, duration }) => (
  <CardContentRecipe
    imageUrl={PLACEHOLDER_IMAGE}
    name={name}
    duration={duration}
  />
);

Playground.args = {
  name: "Amandel Pasta",
  duration: "20 min",
};

Playground.argTypes = {
  name: { control: { type: "text" } },
  duration: { control: { type: "text" } },
};
