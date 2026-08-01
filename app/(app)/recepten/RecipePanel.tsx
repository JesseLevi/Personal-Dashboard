"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { IngredientSearchPanel } from "@/components/organisms/IngredientSearchPanel";
import { InputField } from "@/components/atoms/InputField";
import { Dropdown } from "@/components/atoms/Dropdown";
import { Button } from "@/components/atoms/Button";
import { Tag } from "@/components/atoms/Tag";
import { RecipeIngredientRow } from "@/components/molecules/RecipeIngredientRow";
import { isIconName } from "@/components/atoms/Icon";
import { UNIT_CODES, type UnitCode } from "@/lib/recipes/units";
import type {
  ActionResult,
  IngredientRow,
  IngredientSearchResult,
  RecipeCategoryRow,
  RecipeRow,
  RecipeWithIngredientsAndSteps,
} from "@/lib/recipes/types";

// Add/edit-recipe SidePanel content (#126) — Figma "Add recipi/Mobile"
// (3777:3932, fields refreshed under 3717:2844 per the ticket's own brief
// v2 §A2) + "01: Main/Mobile" (3777:3918, the "+" trigger). Page-level
// composition of existing atoms/organisms exactly like CardDetailPanel.tsx/
// CategoryPanel.tsx — not a fetched Figma component itself, so (same
// precedent as those two) this is NOT added to design/figma-map.json.
// One component for create+edit (`target.mode`, analogous to #94 — no
// separate "Recept bewerken" node exists). Full field-by-field reasoning,
// every flagged deviation and open question: design/notes/RecipePanel.md.

export type RecipePanelTarget =
  | { mode: "create"; categoryId: string }
  | { mode: "edit"; recipe: RecipeWithIngredientsAndSteps };

interface IngredientRowState {
  localId: string;
  name: string;
  quantity: number | null;
  unit: UnitCode | "";
  ingredientId: string | null;
}

interface StepRowState {
  localId: string;
  instruction: string;
}

// Fallback icon for a category whose stored icon isn't a real `IconName` —
// same gap and same fallback ReceptenBoard.tsx already applies.
const FALLBACK_CATEGORY_ICON = "FolderClosed";

// Personen options (Dropdown, decision (h) — the ticket asks for "the
// least-inventive interpretation" of the trailing chevron with no behaviour
// specified). A fixed 1-12 range, unsourced from Figma/product like
// SidePanel's own drag thresholds (design/notes/SidePanel.md's #103 entry)
// — reasonable default, flagged rather than silently presented as
// design-sourced.
const SERVINGS_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

let rowIdCounter = 0;
function nextRowId(prefix: string): string {
  rowIdCounter += 1;
  return `${prefix}-${rowIdCounter}`;
}

function emptyIngredientRow(): IngredientRowState {
  return { localId: nextRowId("ingredient"), name: "", quantity: null, unit: "gram", ingredientId: null };
}

function emptyStepRow(): StepRowState {
  return { localId: nextRowId("step"), instruction: "" };
}

function ingredientRowsFromRecipe(recipe: RecipeWithIngredientsAndSteps): IngredientRowState[] {
  const sorted = [...recipe.ingredients].sort((a, b) => a.position - b.position);
  if (sorted.length === 0) return [emptyIngredientRow()];
  return sorted.map((row) => ({
    localId: nextRowId("ingredient"),
    name: row.name,
    quantity: row.quantity,
    unit: row.unit as UnitCode,
    ingredientId: row.ingredient_id,
  }));
}

function stepRowsFromRecipe(recipe: RecipeWithIngredientsAndSteps): StepRowState[] {
  const sorted = [...recipe.steps].sort((a, b) => a.position - b.position);
  if (sorted.length === 0) return [emptyStepRow()];
  return sorted.map((row) => ({ localId: nextRowId("step"), instruction: row.instruction }));
}

export interface RecipePanelProps {
  open: boolean;
  onClose: () => void;
  target: RecipePanelTarget;
  categories: RecipeCategoryRow[];
  onCreateRecipe: (input: unknown) => Promise<ActionResult<RecipeRow>>;
  onUpdateRecipe: (input: unknown) => Promise<ActionResult>;
  onDeleteRecipe: (input: unknown) => Promise<ActionResult>;
  onSearchIngredients: (input: unknown) => Promise<IngredientSearchResult[]>;
  onCreateOwnIngredient: (input: unknown) => Promise<ActionResult<IngredientRow>>;
  /** Fired after a successful create/update/delete, before `onClose`. Never fired on a plain close/cancel. */
  onMutated?: () => void;
}

export function RecipePanel({
  open,
  onClose,
  target,
  categories,
  onCreateRecipe,
  onUpdateRecipe,
  onDeleteRecipe,
  onSearchIngredients,
  onCreateOwnIngredient,
  onMutated,
}: RecipePanelProps) {
  const t = useTranslations("components.recipePanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tUnits = useTranslations("recipes.units");
  const tErrors = useTranslations("recipes.errors");

  const recipe = target.mode === "edit" ? target.recipe : null;

  const [title, setTitle] = useState(recipe?.title ?? "");
  const [categoryId, setCategoryId] = useState(
    recipe?.category_id ?? (target.mode === "create" ? target.categoryId : ""),
  );
  const [servings, setServings] = useState(recipe?.servings ?? 4);
  const [timeMinutes, setTimeMinutes] = useState<number | "">(recipe?.time_minutes ?? "");
  const [ingredients, setIngredients] = useState<IngredientRowState[]>(() =>
    recipe ? ingredientRowsFromRecipe(recipe) : [emptyIngredientRow()],
  );
  const [steps, setSteps] = useState<StepRowState[]>(() =>
    recipe ? stepRowsFromRecipe(recipe) : [emptyStepRow()],
  );
  // Tags: local-only, see design/notes/RecipePanel.md — no query exists yet
  // for a user's existing tags, and createRecipeSchema/updateRecipeSchema
  // (lib/recipes/schemas.ts) accept no `tags` field, so nothing typed here
  // is persisted today. Flagged, not silently wired to a fake save.
  const [tags, setTags] = useState<string[]>([]);
  const [newTagDraft, setNewTagDraft] = useState("");

  const [ingredientSearch, setIngredientSearch] = useState<{ open: boolean; rowLocalId: string | null }>({
    open: false,
    rowLocalId: null,
  });
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset-on-open, not remount-on-target-change — same #105 pattern as
  // CardDetailPanel.tsx/CategoryPanel.tsx (see either file's own comment for
  // the full "why not a `key`" reasoning).
  const targetKey =
    target.mode === "edit" ? `edit-${target.recipe.id}` : `create-${target.categoryId}`;
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevTargetKey, setPrevTargetKey] = useState(targetKey);
  if (prevOpen !== open || prevTargetKey !== targetKey) {
    const shouldReset = open && (!prevOpen || targetKey !== prevTargetKey);
    setPrevOpen(open);
    setPrevTargetKey(targetKey);
    if (shouldReset) {
      setTitle(recipe?.title ?? "");
      setCategoryId(recipe?.category_id ?? (target.mode === "create" ? target.categoryId : ""));
      setServings(recipe?.servings ?? 4);
      setTimeMinutes(recipe?.time_minutes ?? "");
      setIngredients(recipe ? ingredientRowsFromRecipe(recipe) : [emptyIngredientRow()]);
      setSteps(recipe ? stepRowsFromRecipe(recipe) : [emptyStepRow()]);
      setTags([]);
      setNewTagDraft("");
      setIngredientSearch({ open: false, rowLocalId: null });
      setDeleteConfirming(false);
      setError(null);
    }
  }

  const unitOptions = UNIT_CODES.map((code) => ({ code, label: tUnits(code) }));

  function updateIngredientRow(localId: string, patch: Partial<IngredientRowState>) {
    setIngredients((current) =>
      current.map((row) => (row.localId === localId ? { ...row, ...patch } : row)),
    );
  }

  function handleAddIngredientRow() {
    setIngredients((current) => [...current, emptyIngredientRow()]);
  }

  function handleAddStepRow() {
    setSteps((current) => [...current, emptyStepRow()]);
  }

  function handleAddTag() {
    const trimmed = newTagDraft.trim();
    if (trimmed === "" || tags.includes(trimmed)) return;
    setTags((current) => [...current, trimmed]);
    setNewTagDraft("");
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags((current) => current.filter((tagValue) => tagValue !== tagToRemove));
  }

  const searchRow = ingredients.find((row) => row.localId === ingredientSearch.rowLocalId) ?? null;

  function handleIngredientSaved(selected: IngredientRow[]) {
    // Reuses #131's multi-select IngredientSearchPanel as a single-select
    // picker here — the first checked result wins, matching one row's one
    // name/ingredientId slot. See design/notes/RecipePanel.md.
    const picked = selected[0];
    if (picked && ingredientSearch.rowLocalId) {
      updateIngredientRow(ingredientSearch.rowLocalId, {
        name: picked.name,
        ingredientId: picked.id,
      });
    }
  }

  function buildIngredientsPayload() {
    return ingredients
      .filter((row) => row.name.trim() !== "")
      .map((row) => ({
        name: row.name.trim(),
        quantity: row.quantity,
        unit: row.unit || "gram",
        ingredientId: row.ingredientId,
      }));
  }

  function buildStepsPayload() {
    return steps
      .filter((row) => row.instruction.trim() !== "")
      .map((row) => ({ instruction: row.instruction.trim() }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const payload = {
        categoryId,
        title: title.trim(),
        servings,
        timeMinutes: timeMinutes === "" ? null : timeMinutes,
        ingredients: buildIngredientsPayload(),
        steps: buildStepsPayload(),
      };
      const result =
        target.mode === "create"
          ? await onCreateRecipe(payload)
          : await onUpdateRecipe({ recipeId: target.recipe.id, ...payload });
      if (!result.success) {
        setError(tErrors(result.error));
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  function handleDelete() {
    if (target.mode !== "edit") return;
    setError(null);
    startTransition(async () => {
      const result = await onDeleteRecipe({ recipeId: target.recipe.id });
      if (!result.success) {
        setError(tErrors(result.error));
        setDeleteConfirming(false);
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  const selectedCategory = categories.find((category) => category.id === categoryId) ?? categories[0];
  const otherCategories = categories.filter((category) => category.id !== selectedCategory?.id);

  // Verwijderen visibility (decision (i), no Figma source either way):
  // hidden on create, visible on edit — a new recipe has nothing to delete
  // yet, same reasoning as every other create/edit SidePanel in this
  // codebase never showing a delete affordance on its create branch.
  const footer =
    target.mode === "edit" && deleteConfirming ? (
      <>
        <p className="text-base font-semibold text-text">{t("deleteConfirmLabel")}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="grow basis-0"
            onClick={() => setDeleteConfirming(false)}
            disabled={isPending}
          >
            {t("cancelLabel")}
          </Button>
          <Button
            variant="destructive"
            icon="Trash"
            className="grow basis-0"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? t("deletingLabel") : t("deleteConfirmButtonLabel")}
          </Button>
        </div>
      </>
    ) : (
      <div className="flex gap-2">
        {target.mode === "edit" && (
          <Button
            variant="destructive"
            icon="Trash"
            className="grow basis-0"
            onClick={() => setDeleteConfirming(true)}
            disabled={isPending}
          >
            {t("deleteLabel")}
          </Button>
        )}
        <Button
          variant="filled"
          icon="Save"
          className="grow basis-0"
          onClick={handleSave}
          disabled={isPending || title.trim() === "" || !categoryId}
        >
          {isPending ? t("savingLabel") : t("saveLabel")}
        </Button>
      </div>
    );

  return (
    <>
      <SidePanel
        open={open}
        onClose={onClose}
        title={target.mode === "create" ? t("addTitle") : t("editTitle")}
        closeLabel={tSidePanel("closeLabel")}
        footer={footer}
      >
        <InputField
          label={t("fields.titleLabel")}
          id="recipe-panel-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        {selectedCategory && (
          <Dropdown
            key={selectedCategory.id}
            label={t("fields.categoryLabel")}
            id="recipe-panel-category"
            defaultOpen={false}
          >
            {/* Same trigger pattern as CardDetailPanel.tsx's Status Dropdown
                (a filled Button doubling as the disclosure trigger, #100) —
                least-inventive reuse for "select an entity with an icon". */}
            <Button variant="filled" icon={categoryIconOrFallback(selectedCategory.icon)} align="left">
              {selectedCategory.name}
            </Button>
            {otherCategories.map((category) => (
              <Button
                key={category.id}
                variant="white"
                icon={categoryIconOrFallback(category.icon)}
                align="left"
                onClick={() => setCategoryId(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </Dropdown>
        )}

        <Dropdown key={servings} label={t("fields.servingsLabel")} id="recipe-panel-servings" defaultOpen={false}>
          <button type="button" className="w-full rounded-lg text-left text-xl font-semibold text-text">
            {servings}
          </button>
          {SERVINGS_OPTIONS.filter((value) => value !== servings).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setServings(value)}
              className="flex w-full rounded-lg p-2 text-left text-base font-semibold text-text-muted transition-colors hover:bg-surface-hover"
            >
              {value}
            </button>
          ))}
        </Dropdown>

        {/* Tijd + Tags: user-ordered deviation from Figma (2026-07-29) — no
            node in 3777:3932/3717:2844 draws either field, but recipes need
            a category to land in a kanban column at all, and Tijd/Tags are
            "input fields or dropdowns, no new UI needed" per the user's own
            instruction. Composed entirely from existing atoms. See
            design/notes/RecipePanel.md. */}
        <InputField
          label={t("fields.timeLabel")}
          id="recipe-panel-time"
          type="number"
          inputMode="numeric"
          min={1}
          placeholder={t("fields.timePlaceholder")}
          value={timeMinutes}
          onChange={(event) => {
            const raw = event.target.value;
            setTimeMinutes(raw === "" ? "" : Number(raw));
          }}
        />

        <Dropdown label={t("fields.tagsLabel")} id="recipe-panel-tags" defaultOpen={false}>
          <button type="button" className="w-full rounded-lg text-left text-base font-semibold text-text">
            {tags.length > 0 ? tags.join(", ") : t("fields.tagsPlaceholder")}
          </button>
          <div className="flex flex-col gap-2 p-2">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tagValue) => (
                  <span key={tagValue} className="inline-flex items-center gap-1">
                    <Tag variant="neutral">{tagValue}</Tag>
                    <Button
                      variant="white"
                      size="compact"
                      icon="X"
                      aria-label={t("fields.tagsRemoveLabel", { tag: tagValue })}
                      onClick={() => handleRemoveTag(tagValue)}
                    />
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <InputField
                  id="recipe-panel-tags-new"
                  placeholder={t("fields.tagsAddPlaceholder")}
                  value={newTagDraft}
                  onChange={(event) => setNewTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
              </div>
              <Button
                variant="filled"
                icon="Plus"
                aria-label={t("fields.tagsAddLabel")}
                onClick={handleAddTag}
                disabled={newTagDraft.trim() === ""}
              />
            </div>
          </div>
        </Dropdown>

        <div className="flex w-full flex-col items-stretch gap-4">
          {ingredients.map((row, index) => (
            <div key={row.localId} className="flex w-full flex-col gap-4">
              {index > 0 && <div className="h-px w-full bg-border" aria-hidden="true" />}
              <RecipeIngredientRow
                id={row.localId}
                showLabels={index === 0}
                itemLabel={t("fields.ingredientNameLabel")}
                quantityLabel={t("fields.ingredientQuantityLabel")}
                unitLabel={t("fields.ingredientUnitLabel")}
                name={row.name}
                namePlaceholder={t("fields.ingredientNamePlaceholder")}
                onNameClick={() =>
                  setIngredientSearch({ open: true, rowLocalId: row.localId })
                }
                quantity={row.quantity}
                quantityPlaceholder={t("fields.ingredientQuantityPlaceholder")}
                onQuantityChange={(value) => updateIngredientRow(row.localId, { quantity: value })}
                unit={row.unit}
                unitPlaceholder={t("fields.ingredientUnitPlaceholder")}
                unitOptions={unitOptions}
                onUnitChange={(unit) => updateIngredientRow(row.localId, { unit })}
              />
            </div>
          ))}
        </div>
        <Button variant="filled" icon="Plus" onClick={handleAddIngredientRow}>
          {t("addRowLabel")}
        </Button>

        <div className="flex w-full flex-col items-stretch gap-4">
          {steps.map((row) => (
            <InputField
              key={row.localId}
              id={`recipe-panel-step-${row.localId}`}
              label={t("fields.stepLabel", { number: steps.indexOf(row) + 1 })}
              multiline
              placeholder={t("fields.stepPlaceholder")}
              value={row.instruction}
              onChange={(event) =>
                setSteps((current) =>
                  current.map((step) =>
                    step.localId === row.localId
                      ? { ...step, instruction: event.target.value }
                      : step,
                  ),
                )
              }
              button={
                // Figma annotation: the "Ingrediënt" pill opens a second
                // pull-up panel whose content is nowhere designed (screen
                // 03's own overlay, 3777:3984, is the closest candidate and
                // is itself unannotated). Deferred, not improvised — see
                // design/notes/RecipePanel.md. Rendered per Figma, disabled
                // so it reads as "not yet available" rather than a dead
                // click.
                <Button variant="filled" icon="Plus" disabled>
                  {t("stepIngredientPillLabel")}
                </Button>
              }
            />
          ))}
        </div>
        <Button variant="filled" icon="Plus" onClick={handleAddStepRow}>
          {t("addRowLabel")}
        </Button>

        {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
      </SidePanel>

      <IngredientSearchPanel
        open={ingredientSearch.open}
        onClose={() => setIngredientSearch({ open: false, rowLocalId: null })}
        onSearch={onSearchIngredients}
        onCreateOwnIngredient={onCreateOwnIngredient}
        onSave={handleIngredientSaved}
        initialQuery={searchRow?.name}
      />
    </>
  );
}

// Same gap/fallback as ReceptenBoard.tsx's own column-icon resolution —
// `recipe_categories.icon` is free-text at the schema layer.
function categoryIconOrFallback(icon: string) {
  return isIconName(icon) ? icon : FALLBACK_CATEGORY_ICON;
}
