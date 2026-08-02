"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { Card } from "@/components/molecules/Card";
import { CardContentIngredient } from "@/components/molecules/CardContentIngredient";
import { CardContentStep } from "@/components/molecules/CardContentStep";
import { PortionStepper } from "@/components/molecules/PortionStepper";
import { formatQuantity } from "@/lib/recipes/units";
import type {
  RecipeCategoryRow,
  RecipeIngredientRow,
  RecipeWithIngredientsAndSteps,
} from "@/lib/recipes/types";
import { RecipePanel, type RecipePanelTarget } from "../RecipePanel";
import {
  createOwnIngredient,
  createRecipe,
  deleteRecipe,
  searchIngredients,
  updateRecipe,
  uploadRecipeThumbnail,
} from "../actions";

// #127 recipe detail route body — Figma "Recept/Mobile" (3778:5427) /
// "Recept/Desktop" (3778:5584), portion row 3953:9750/3778:5596, ingredient
// cards 3778:5437/3778:5600. Page-level composition of existing atoms/
// molecules (Card, Card-content/Ingredient, Card-content/Step, Button,
// Dropdown, #123's PortionStepper) — same non-mapped-component precedent as
// ReceptenBoard.tsx/RecipePanel.tsx, not added to design/figma-map.json. No
// new Ladle story: this is a full route body (like ReceptenBoard.tsx, which
// also ships without one), not a self-contained overlay like RecipePanel.tsx/
// CardDetailPanel.tsx. Every decision/deviation below: design/notes/
// RecipeDetailPage.md.

/** Buckets ingredients (already position-sorted) by `group_label`, preserving
 * each group's first-seen order — including one shared bucket for every
 * `null`-label row, rendered as a single untitled Card (decision, not a
 * "default" group name — see design/notes/RecipeDetailPage.md). */
interface IngredientGroup {
  groupLabel: string | null;
  ingredients: RecipeIngredientRow[];
}

function groupIngredients(ingredients: RecipeIngredientRow[]): IngredientGroup[] {
  const order: (string | null)[] = [];
  const byLabel = new Map<string | null, RecipeIngredientRow[]>();
  for (const ingredient of ingredients) {
    const key = ingredient.group_label;
    if (!byLabel.has(key)) {
      byLabel.set(key, []);
      order.push(key);
    }
    byLabel.get(key)!.push(ingredient);
  }
  return order.map((groupLabel) => ({ groupLabel, ingredients: byLabel.get(groupLabel)! }));
}

export interface RecipeDetailPageProps {
  recipe: RecipeWithIngredientsAndSteps;
  categories: RecipeCategoryRow[];
}

export function RecipeDetailPage({ recipe, categories }: RecipeDetailPageProps) {
  const t = useTranslations("components.recipeDetailPage");
  const tUnits = useTranslations("recipes.units");
  const tPortion = useTranslations("components.portionStepper");
  const tErrors = useTranslations("recipes.errors");
  const router = useRouter();

  // Display-only: #128 owns rescaling recipe_ingredients.quantity against
  // this value. See design/notes/RecipeDetailPage.md.
  const [portions, setPortions] = useState(recipe.servings);
  const [editOpen, setEditOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Same click-outside-closes convention as TeDoenHeader.tsx's board-
  // switcher/sort dropdowns — reused for the mobile Ellipsis overflow menu.
  const overflowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!overflowOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) {
        setOverflowOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [overflowOpen]);

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteRecipe({ recipeId: recipe.id });
      if (!result.success) {
        setDeleteError(tErrors(result.error));
        setDeleteConfirming(false);
        return;
      }
      router.push("/recepten");
    });
  }

  const ingredientGroups = groupIngredients(
    [...recipe.ingredients].sort((a, b) => a.position - b.position),
  );
  const steps = [...recipe.steps].sort((a, b) => a.position - b.position);
  const editTarget: RecipePanelTarget = { mode: "edit", recipe };

  return (
    <div className="flex w-full flex-col items-stretch gap-6 pr-4 md:pr-32">
      <div className="flex w-full items-center justify-between gap-4">
        <Button
          icon="ArrowLeft"
          aria-label={t("backLabel")}
          onClick={() => router.push("/recepten")}
        />

        {deleteConfirming ? (
          <div className="flex flex-wrap items-center justify-end gap-4">
            <p className="text-base font-semibold text-text">{t("deleteConfirmLabel")}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirming(false)}
                disabled={isPending}
              >
                {t("cancelLabel")}
              </Button>
              <Button
                variant="destructive"
                icon="Trash"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? t("deletingLabel") : t("deleteConfirmButtonLabel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-4">
            {/* Rendered, deliberately non-functional in Phase 4 — #29 (Phase
                5) wires a real handler. See design/notes/RecipeDetailPage.md. */}
            <Button icon="ShoppingBasket" disabled>
              {t("addToBasketLabel")}
            </Button>

            <div className="hidden items-center gap-5 md:flex">
              <Button variant="filled" icon="Pencil" onClick={() => setEditOpen(true)}>
                {t("editLabel")}
              </Button>
              <Button variant="destructive" icon="Trash" onClick={() => setDeleteConfirming(true)}>
                {t("deleteLabel")}
              </Button>
            </div>

            {/* Mobile Ellipsis overflow — undesigned node, built from Button +
                Dropdown exactly like TeDoenHeader.tsx's own menus. See
                design/notes/RecipeDetailPage.md. */}
            <div ref={overflowRef} className="relative md:hidden">
              <Button
                icon="Ellipsis"
                aria-label={t("overflowMenuLabel")}
                aria-expanded={overflowOpen}
                onClick={() => setOverflowOpen((open) => !open)}
              />
              {overflowOpen && (
                <div className="absolute top-full right-0 z-[999] mt-2 w-[209px]">
                  <Dropdown className="shadow-sm">
                    <Button
                      variant="white"
                      align="left"
                      icon="Pencil"
                      onClick={() => {
                        setOverflowOpen(false);
                        setEditOpen(true);
                      }}
                    >
                      {t("editLabel")}
                    </Button>
                    <Button
                      variant="destructive"
                      align="left"
                      icon="Trash"
                      onClick={() => {
                        setOverflowOpen(false);
                        setDeleteConfirming(true);
                      }}
                    >
                      {t("deleteLabel")}
                    </Button>
                  </Dropdown>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {deleteError && (
        <p className="text-base font-semibold text-priority-urgent">{deleteError}</p>
      )}

      {/* recipes.thumbnail_path is never resolved to a signed URL yet (see
          design/notes/RecipeDetailPage.md) — same placeholder-fill
          CardContentRecipe already renders for a photo-less recipe. */}
      <div
        aria-hidden="true"
        className="h-[146.4px] w-full rounded-xl bg-surface-muted md:h-[440px]"
      />

      <div className="flex w-full flex-col items-center gap-6 py-4">
        <h1 className="w-full text-center text-4xl font-semibold text-text">{recipe.title}</h1>
        <PortionStepper
          portions={portions}
          label={tPortion("count", { count: portions })}
          decrementLabel={tPortion("decrementLabel")}
          incrementLabel={tPortion("incrementLabel")}
          onChange={setPortions}
        />
      </div>

      <div className="flex w-full flex-col gap-6 md:flex-row">
        {ingredientGroups.map((group) => (
          <Card
            key={group.groupLabel ?? "__ungrouped"}
            title={group.groupLabel ?? undefined}
            className="md:flex-1"
          >
            {group.ingredients.map((ingredient) => (
              <CardContentIngredient
                key={ingredient.id}
                name={ingredient.name}
                quantity={formatQuantity(ingredient.quantity, tUnits(ingredient.unit))}
                divider
              />
            ))}
          </Card>
        ))}
      </div>

      <div className="flex w-full flex-col gap-6">
        {steps.map((step, index) => (
          <Card key={step.id} step={index + 1} title={index === 0 ? t("stepsTitle") : undefined}>
            {/* No per-step ingredient tags: recipe_steps carries no link to
                specific ingredients anywhere in the schema — see
                design/notes/RecipeDetailPage.md. */}
            <CardContentStep text={step.instruction} withIngredientTags={false} />
          </Card>
        ))}
      </div>

      <RecipePanel
        open={editOpen}
        onClose={() => setEditOpen(false)}
        target={editTarget}
        categories={categories}
        onCreateRecipe={createRecipe}
        onUpdateRecipe={updateRecipe}
        onDeleteRecipe={async (input) => {
          const result = await deleteRecipe(input);
          if (result.success) router.push("/recepten");
          return result;
        }}
        onSearchIngredients={searchIngredients}
        onCreateOwnIngredient={createOwnIngredient}
        onUploadThumbnail={uploadRecipeThumbnail}
        onMutated={() => router.refresh()}
      />
    </div>
  );
}
