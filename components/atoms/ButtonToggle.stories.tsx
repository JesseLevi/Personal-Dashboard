// figma: node-id=3623:4345
import { useState } from "react";
import { ButtonToggle } from "./ButtonToggle";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

// The Figma "Text" property defaults to "Categorie " — reproduced here from
// the message catalog (not hardcoded) since this specific default is
// user-facing (see the doc comment in ButtonToggle.tsx and messages/*.json).
const defaultLabelEn = en.components.buttonToggle.defaultLabel;
const defaultLabelNl = nl.components.buttonToggle.defaultLabel;

export const Default = () => (
  <ButtonToggle icon="Infinity">{defaultLabelEn}</ButtonToggle>
);

export const DefaultLabelNl = () => (
  <ButtonToggle icon="Infinity">{defaultLabelNl}</ButtonToggle>
);

export const Pressed = () => (
  <ButtonToggle icon="Infinity" aria-pressed>
    {defaultLabelEn}
  </ButtonToggle>
);

export const IconOnly = () => (
  <ButtonToggle icon="Croissant" aria-label="Croissant" />
);

export const TextOnly = () => (
  <ButtonToggle>{defaultLabelEn}</ButtonToggle>
);

// Approximates the fetched node's demo (5 category icons, one pressed) using
// independent ButtonToggle instances. Figma's own demo merges all 5 into one
// shared grey track (a single outer fill behind transparent buttons) — that
// grouped-track composition belongs to a future toggle-group molecule/
// organism, out of scope for this atom (CLAUDE.md: compose exactly as Figma
// nests, but don't invent a group component this ticket doesn't ask for).
// Each chip below keeps its own resting background, so the row reads as
// separate pills rather than one continuous track.
export const CategoryFilterRow = () => {
  const [active, setActive] = useState("all");
  const categories = [
    { key: "all", icon: "Infinity", label: "All" },
    { key: "breakfast", icon: "Croissant", label: "Breakfast" },
    { key: "lunch", icon: "Sandwich", label: "Lunch" },
    { key: "vegetable", icon: "Broccoli", label: "Vegetable" },
    { key: "dessert", icon: "CakeSlice", label: "Dessert" },
  ] as const;

  return (
    <div className="inline-flex gap-2">
      {categories.map((c) => (
        <ButtonToggle
          key={c.key}
          icon={c.icon}
          aria-label={c.label}
          aria-pressed={active === c.key}
          onClick={() => setActive(c.key)}
        />
      ))}
    </div>
  );
};
