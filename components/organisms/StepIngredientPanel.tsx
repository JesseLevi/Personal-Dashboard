"use client";

// figma: node-id=3749:3241
import { useState } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "./SidePanel";
import { Card } from "../molecules/Card";
import { CardContentIngredient } from "../molecules/CardContentIngredient";
import { Button } from "../atoms/Button";

/**
 * Organism/StepIngredientPanel — Figma "Add recipi/ingredient/Mobile"
 * (3749:3091, panel 3749:3241): the per-step ingredient picker opened by a
 * step's "+ Ingrediënt" pill (#149). Purely presentational/client-side —
 * the recipe may not be saved yet, so it selects from `RecipePanel`'s own
 * local ingredient-row state, never a server action or Supabase query (same
 * "props in, callback out" contract `IngredientSearchPanel` already uses).
 * `level={2}` (`SidePanel.tsx`) so its scrim also dims `RecipePanel`,
 * matching the fetched node's full-screen overlay. No search field, no
 * visible title — the fetched node draws neither. Full reasoning:
 * design/notes/StepIngredientPanel.md.
 */
export interface StepIngredientPanelOption {
  /** `RecipePanel`'s own local ingredient-row id — never a database id, since the recipe (and its ingredients) may not be saved yet. */
  localId: string;
  name: string;
  /** Already-formatted "quantity + unit" tag text (e.g. "1250 Gram"), caller-formatted — this panel does no unit lookup/formatting itself. */
  quantityLabel: string;
}

export interface StepIngredientPanelProps {
  open: boolean;
  onClose: () => void;
  /** Rows with an empty `name` are never rendered — an unnamed row is not a real ingredient yet. */
  ingredients: StepIngredientPanelOption[];
  /** `localId`s currently linked to this step. */
  selectedIds: string[];
  /** Fired on Opslaan with the new full selection, before `onClose`. */
  onSave: (selectedIds: string[]) => void;
}

export function StepIngredientPanel({
  open,
  onClose,
  ingredients,
  selectedIds,
  onSave,
}: StepIngredientPanelProps) {
  const t = useTranslations("components.stepIngredientPanel");
  const tSidePanel = useTranslations("components.sidePanel");

  const [selected, setSelected] = useState<Set<string>>(() => new Set(selectedIds));
  // Reset-on-open (not remount-on-open), same convention as RecipePanel.tsx/
  // CardDetailPanel.tsx's own target-change reset — keeps this one persistent
  // DOM node for the panel's whole lifetime instead of losing its open/close
  // transition (design/notes/SidePanel.md's #103 "first-click animation" entry).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setSelected(new Set(selectedIds));
  }

  const visibleIngredients = ingredients.filter((ingredient) => ingredient.name.trim() !== "");

  function toggle(localId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(localId)) {
        next.delete(localId);
      } else {
        next.add(localId);
      }
      return next;
    });
  }

  function handleSave() {
    onSave([...selected]);
    onClose();
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={t("title")}
      closeLabel={tSidePanel("closeLabel")}
      level={2}
      // #153: footer row wrapper (matches RecipePanel.tsx/IngredientSearchPanel.tsx) —
      // a bare `grow basis-0` Button as SidePanel's flex-col footer's direct
      // child collapses to ~0 height (basis-0 applies on the column axis
      // instead of a row's). See design/notes/StepIngredientPanel.md.
      footer={
        <div className="flex gap-2">
          <Button variant="filled" icon="Save" className="grow basis-0" onClick={handleSave}>
            {t("saveLabel")}
          </Button>
        </div>
      }
    >
      {visibleIngredients.length > 0 && (
        <Card>
          {visibleIngredients.map((ingredient, index) => (
            <CardContentIngredient
              key={ingredient.localId}
              name={ingredient.name}
              quantity={ingredient.quantityLabel}
              checked={selected.has(ingredient.localId)}
              onCheckedToggle={() => toggle(ingredient.localId)}
              divider={index < visibleIngredients.length - 1}
            />
          ))}
        </Card>
      )}
    </SidePanel>
  );
}
