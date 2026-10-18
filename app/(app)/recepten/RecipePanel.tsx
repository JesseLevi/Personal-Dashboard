"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { IngredientSearchPanel } from "@/components/organisms/IngredientSearchPanel";
import { StepIngredientPanel } from "@/components/organisms/StepIngredientPanel";
import { InputField } from "@/components/atoms/InputField";
import { Dropdown } from "@/components/atoms/Dropdown";
import { Button } from "@/components/atoms/Button";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import { ImageUploadField } from "@/components/molecules/ImageUploadField";
import { RecipeIngredientRow } from "@/components/molecules/RecipeIngredientRow";
import { isIconName } from "@/components/atoms/Icon";
import { UNIT_CODES, formatQuantity, magnitudeOf, type UnitCode } from "@/lib/recipes/units";
import {
  buildContentsPayload,
  keepsNeedsReview,
  moveRow,
  type IngredientRowState,
  type StepRowState,
} from "@/lib/recipes/panel-payload";
import { downscaleImageFile } from "@/lib/images/downscale-client";
import type {
  ActionResult,
  IngredientRow,
  IngredientSearchResult,
  RecipeCategoryRow,
  RecipeRow,
  RecipeWithIngredientsAndSteps,
} from "@/lib/recipes/types";

// Add/edit-recipe SidePanel content (#126, extended #149) — Figma
// "Add recipi/Mobile" (3777:3932, fields refreshed under 3717:2844 per the
// ticket's own brief v2 §A2) + "01: Main/Mobile" (3777:3918, the "+"
// trigger). Page-level composition of existing atoms/organisms exactly like
// CardDetailPanel.tsx/CategoryPanel.tsx — not a fetched Figma component
// itself, so (same precedent as those two) this is NOT added to
// design/figma-map.json. One component for create+edit (`target.mode`,
// analogous to #94 — no separate "Recept bewerken" node exists). Full
// field-by-field reasoning, every flagged deviation and open question:
// design/notes/RecipePanel.md.

export type RecipePanelTarget =
  | { mode: "create"; categoryId: string }
  | { mode: "edit"; recipe: RecipeWithIngredientsAndSteps };

// Fallback icon for a category whose stored icon isn't a real `IconName` —
// same gap and same fallback ReceptenBoard.tsx already applies.
const FALLBACK_CATEGORY_ICON = "FolderClosed";

// Personen options (InputField's `options` select variant, #149 — Figma
// models this field as the same Input-field component with a chevron, not a
// separate Dropdown; see design/notes/InputField.md). A fixed 1-12 range,
// unsourced from Figma/product like SidePanel's own drag thresholds
// (design/notes/SidePanel.md's #103 entry) — reasonable default, flagged
// rather than silently presented as design-sourced.
const SERVINGS_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const SERVINGS_SELECT_OPTIONS = SERVINGS_OPTIONS.map((value) => ({
  value: String(value),
  label: String(value),
}));

let rowIdCounter = 0;
function nextRowId(prefix: string): string {
  rowIdCounter += 1;
  return `${prefix}-${rowIdCounter}`;
}

function emptyIngredientRow(): IngredientRowState {
  return {
    localId: nextRowId("ingredient"),
    name: "",
    quantity: null,
    unit: "gram",
    ingredientId: null,
    sourceId: null,
    groupLabel: null,
    needsReview: false,
    link: null,
    loaded: null,
  };
}

function emptyStepRow(): StepRowState {
  return { localId: nextRowId("step"), instruction: "", ingredientLocalIds: [] };
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
    sourceId: row.id,
    groupLabel: row.group_label,
    needsReview: row.needs_review,
    link:
      row.ingredient_id && row.linkedIngredientName
        ? {
            name: row.linkedIngredientName,
            isNevo: row.referenceIngredientId !== null,
            kcalPer100g: row.nutrients.kcalPer100g,
            gramsPerUnit: row.unitMassGrams,
            unit: row.unit as UnitCode,
          }
        : null,
    loaded: { name: row.name, quantity: row.quantity, unit: row.unit as UnitCode, ingredientId: row.ingredient_id },
  }));
}

// `ingredientRows` must be the exact array already assigned to the
// `ingredients` state (never a fresh `ingredientRowsFromRecipe(recipe)`
// call) — each row's `localId` is generated once by `nextRowId` and a
// second call would mint different ids, breaking the `sourceId` lookup
// below.
function stepRowsFromRecipe(
  recipe: RecipeWithIngredientsAndSteps,
  ingredientRows: IngredientRowState[],
): StepRowState[] {
  const sorted = [...recipe.steps].sort((a, b) => a.position - b.position);
  if (sorted.length === 0) return [emptyStepRow()];
  const localIdBySourceId = new Map(
    ingredientRows
      .filter((row): row is IngredientRowState & { sourceId: string } => row.sourceId !== null)
      .map((row) => [row.sourceId, row.localId]),
  );
  return sorted.map((row) => ({
    localId: nextRowId("step"),
    instruction: row.instruction,
    ingredientLocalIds: row.ingredientIds
      .map((id) => localIdBySourceId.get(id))
      .filter((localId): localId is string => localId !== undefined),
  }));
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
  /** `"use server"` action `confirmIngredientMatch` (#316/#318): called when the user fixes a "controleren" line through the ingredient picker. Optional so create-only hosts can omit it. */
  onConfirmIngredientMatch?: (input: unknown) => Promise<ActionResult>;
  /** `"use server"` action `uploadRecipeThumbnail` (`app/(app)/recepten/actions.ts`) — called before create/update whenever a new thumbnail file was picked (#149). */
  onUploadThumbnail: (formData: FormData) => Promise<ActionResult<{ path: string }>>;
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
  onConfirmIngredientMatch,
  onUploadThumbnail,
  onMutated,
}: RecipePanelProps) {
  const t = useTranslations("components.recipePanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tUnits = useTranslations("recipes.units");
  const tErrors = useTranslations("recipes.errors");
  const tLink = useTranslations("components.recipePanel.link");
  const tImageUpload = useTranslations("components.imageUploadField");

  const recipe = target.mode === "edit" ? target.recipe : null;

  const [title, setTitle] = useState(recipe?.title ?? "");
  const [categoryId, setCategoryId] = useState(
    recipe?.category_id ?? (target.mode === "create" ? target.categoryId : ""),
  );
  const [servings, setServings] = useState(recipe?.servings ?? 4);
  const [timeMinutes, setTimeMinutes] = useState<number | "">(recipe?.time_minutes ?? "");
  // Newly-picked thumbnail file, uploaded on save (#149) — `null` means "keep
  // whatever `recipes.thumbnail_path` already has" on edit, or "no photo" on
  // create. See handleSave's own comment for the upload-before-write order.
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [ingredients, setIngredients] = useState<IngredientRowState[]>(() =>
    recipe ? ingredientRowsFromRecipe(recipe) : [emptyIngredientRow()],
  );
  // Reads `ingredients` (the const just above, already resolved by this
  // point in the same render — not the state setter) rather than calling
  // ingredientRowsFromRecipe(recipe) a second time, so both states start
  // from the exact same `localId`s (see stepRowsFromRecipe's own comment).
  const [steps, setSteps] = useState<StepRowState[]>(() =>
    recipe ? stepRowsFromRecipe(recipe, ingredients) : [emptyStepRow()],
  );

  const [ingredientSearch, setIngredientSearch] = useState<{ open: boolean; rowLocalId: string | null }>({
    open: false,
    rowLocalId: null,
  });
  const [stepIngredientPanel, setStepIngredientPanel] = useState<{
    open: boolean;
    stepLocalId: string | null;
  }>({ open: false, stepLocalId: null });
  const { confirming: deleteConfirming, ask: askDelete, cancel: cancelDelete } = useDeleteConfirm();
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
      const nextIngredients = recipe ? ingredientRowsFromRecipe(recipe) : [emptyIngredientRow()];
      setTitle(recipe?.title ?? "");
      setCategoryId(recipe?.category_id ?? (target.mode === "create" ? target.categoryId : ""));
      setServings(recipe?.servings ?? 4);
      setTimeMinutes(recipe?.time_minutes ?? "");
      setThumbnailFile(null);
      setIngredients(nextIngredients);
      setSteps(recipe ? stepRowsFromRecipe(recipe, nextIngredients) : [emptyStepRow()]);
      setIngredientSearch({ open: false, rowLocalId: null });
      setStepIngredientPanel({ open: false, stepLocalId: null });
      cancelDelete();
      setError(null);
    }
  }

  const unitOptions = UNIT_CODES.map((code) => ({ code, label: tUnits(code) }));

  // Claude-designed on request (2026-10-07): what the nutrition calculator
  // uses for a row, so a wrong NEVO link or a missing one is visible here.
  // Grams per unit only while the unit is still the one it was loaded for.
  function linkInfo(row: IngredientRowState): string | undefined {
    if (!row.link) return row.name.trim() || row.ingredientId ? tLink("none") : undefined;
    const parts = [tLink(row.link.isNevo ? "nevo" : "own", { name: row.link.name })];
    if (row.link.kcalPer100g !== null) {
      parts.push(tLink("kcal", { kcal: Math.round(row.link.kcalPer100g) }));
    } else if (row.ingredientId === row.loaded?.ingredientId) {
      parts.push(tLink("noNutrition"));
    }
    if (row.link.gramsPerUnit !== null && row.unit !== "" && row.unit === row.link.unit && magnitudeOf(row.unit) !== "mass") {
      parts.push(
        tLink("unitMass", {
          unit: tUnits(row.unit).toLocaleLowerCase(),
          grams: Math.round(row.link.gramsPerUnit * 10) / 10,
        }),
      );
    }
    return parts.join(" · ");
  }

  function updateIngredientRow(localId: string, patch: Partial<IngredientRowState>) {
    setIngredients((current) =>
      current.map((row) => (row.localId === localId ? { ...row, ...patch } : row)),
    );
  }

  function handleAddIngredientRow() {
    setIngredients((current) => [...current, emptyIngredientRow()]);
  }

  // #166: every row carries a delete Button now (re-fetched node
  // 4025:10596 — only the separate label-only header row has none, and
  // that's not a data row). RecipeIngredientRow's own `removeDisabled`
  // keeps the list from ever going empty — see the render call below.
  function handleRemoveIngredientRow(localId: string) {
    setIngredients((current) => current.filter((row) => row.localId !== localId));
  }

  function handleAddStepRow() {
    setSteps((current) => [...current, emptyStepRow()]);
  }

  // Steps: delete and move up/down (ingredient-row delete pattern, #166). Saved
  // order is the array order: replace_recipe_contents renumbers positions from
  // the index on every save, so nothing else has to change.
  function handleRemoveStepRow(localId: string) {
    setSteps((current) => current.filter((row) => row.localId !== localId));
  }

  // A moved row's DOM node is reinserted, which drops focus in some browsers;
  // restore it on the same direction button (or the other one at the ends).
  const stepFocus = useRef<{ localId: string; direction: "up" | "down" } | null>(null);
  function handleMoveStepRow(localId: string, direction: "up" | "down") {
    stepFocus.current = { localId, direction };
    setSteps((current) =>
      moveRow(current, current.findIndex((row) => row.localId === localId), direction === "up" ? -1 : 1),
    );
  }
  useEffect(() => {
    const target = stepFocus.current;
    if (!target) return;
    stepFocus.current = null;
    const byDirection = (direction: "up" | "down") =>
      document.getElementById(`recipe-panel-step-${target.localId}-${direction}`) as HTMLButtonElement | null;
    const preferred = byDirection(target.direction);
    (preferred && !preferred.disabled ? preferred : byDirection(target.direction === "up" ? "down" : "up"))?.focus();
  }, [steps]);

  const searchRow = ingredients.find((row) => row.localId === ingredientSearch.rowLocalId) ?? null;
  const activeStepIngredientRow =
    steps.find((row) => row.localId === stepIngredientPanel.stepLocalId) ?? null;

  function handleIngredientSaved(selected: IngredientRow[], plainNames: string[]) {
    // Reuses #131's multi-select IngredientSearchPanel as a single-select
    // picker here — the first checked result wins, matching one row's one
    // name/ingredientId slot. See design/notes/RecipePanel.md.
    const picked = selected[0];
    if (picked && ingredientSearch.rowLocalId) {
      // #318: picking an ingredient for a still-flagged imported line confirms
      // it: the server clears needs_review and remembers the imported name as
      // an alias (confirmIngredientMatch). The pick itself is saved with the form.
      const flaggedRow = ingredients.find((row) => row.localId === ingredientSearch.rowLocalId);
      if (flaggedRow && keepsNeedsReview(flaggedRow) && flaggedRow.sourceId && onConfirmIngredientMatch) {
        void onConfirmIngredientMatch({ recipeIngredientId: flaggedRow.sourceId, ingredientId: picked.id }).then((result) => {
          if (!result.success) setError(tErrors(result.error));
        });
      }
      // A name of the user's own ("Selderij") stays when only the link
      // changes; a name that just mirrored the old link follows the new one.
      const keepName = flaggedRow !== undefined && flaggedRow.name.trim() !== "" && flaggedRow.name !== flaggedRow.link?.name;
      updateIngredientRow(ingredientSearch.rowLocalId, {
        name: keepName ? flaggedRow.name : picked.name,
        ingredientId: picked.id,
        needsReview: false,
        link: { name: picked.name, isNevo: picked.reference_id !== null, kcalPer100g: null, gramsPerUnit: null, unit: "" },
      });
    } else if (plainNames[0] && ingredientSearch.rowLocalId) {
      // #324 (ADR-0020 §5): a hand-typed name stays a recipe-only name,
      // ingredient_id null; nutrition leaves the line out (existing unlinked path).
      updateIngredientRow(ingredientSearch.rowLocalId, {
        name: plainNames[0],
        ingredientId: null,
        needsReview: false,
      });
    }
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      // Upload runs before the create/update call, not in parallel with it:
      // the resulting storage path is part of the same payload
      // (`thumbnailPath`), so create/update must wait for it. `undefined`
      // (no key sent) when no new file was picked — create defaults to no
      // photo, edit leaves the existing `thumbnail_path` untouched
      // (updateRecipeSchema's per-field-optional contract).
      let thumbnailPath: string | undefined;
      if (thumbnailFile) {
        // #174/#171 chunk 3: shrink the payload client-side before it ever
        // leaves the browser (megabytes -> a few hundred kB) -- sharp's
        // server-side re-encode (lib/recipes/thumbnail-processing.ts) stays
        // the authority regardless, since the client is never trusted, so a
        // resize failure here just means the original ships instead
        // (downscaleImageFile fails open, never throws). Awaited inside this
        // same `startTransition` block, so `isPending`/"Bezig met
        // opslaan..." already covers the decode/encode time -- no separate
        // loading state needed.
        const uploadFile = await downscaleImageFile(thumbnailFile);
        const formData = new FormData();
        formData.set("thumbnail", uploadFile);
        const uploadResult = await onUploadThumbnail(formData);
        if (!uploadResult.success) {
          setError(tErrors(uploadResult.error));
          return;
        }
        thumbnailPath = uploadResult.data.path;
      }
      const payload = {
        categoryId,
        title: title.trim(),
        servings,
        timeMinutes: timeMinutes === "" ? null : timeMinutes,
        ...(thumbnailPath !== undefined ? { thumbnailPath } : {}),
        ...buildContentsPayload(ingredients, steps),
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
        cancelDelete();
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  const selectedCategory = categories.find((category) => category.id === categoryId) ?? categories[0];
  const otherCategories = categories.filter((category) => category.id !== selectedCategory?.id);

  // Shown in the Afbeelding field while no new file has been picked yet
  // (#149) — `thumbnail_path` is a storage object path
  // (`<user_id>/<uuid>.<ext>`, lib/recipes/thumbnails.ts), not a stored
  // original filename, so this is the best available approximation of "the
  // existing thumbnail's file name."
  const existingThumbnailFileName = recipe?.thumbnail_path?.split("/").pop() ?? null;

  // Verwijderen visibility (decision (i), no Figma source either way):
  // hidden on create, visible on edit — a new recipe has nothing to delete
  // yet, same reasoning as every other create/edit SidePanel in this
  // codebase never showing a delete affordance on its create branch.
  const footer =
    target.mode === "edit" && deleteConfirming ? (
      <DeleteConfirm
        layout="stacked"
        isPending={isPending}
        onCancel={cancelDelete}
        onConfirm={handleDelete}
        labels={{ prompt: t("deleteConfirmLabel"), cancel: t("cancelLabel"), confirm: t("deleteConfirmButtonLabel"), deleting: t("deletingLabel") }}
      />
    ) : (
      <div className="flex gap-inline-sm">
        {target.mode === "edit" && (
          <Button
            variant="destructive"
            icon="Trash"
            className="grow basis-0"
            onClick={() => askDelete()}
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

        {/* Afbeelding (#149) — between Titel and Personen per Figma
            3777:3932's field order. Uploaded on save (handleSave), never
            eagerly, so a cancelled form never leaves an orphaned storage
            object behind. */}
        <ImageUploadField
          id="recipe-panel-thumbnail"
          name="thumbnail"
          placeholder={tImageUpload("selectImage")}
          ariaLabel={tImageUpload("selectImage")}
          selectedFileName={thumbnailFile?.name ?? existingThumbnailFileName}
          onFileSelect={setThumbnailFile}
        />

        {selectedCategory && (
          <Dropdown
            key={selectedCategory.id}
            label={t("fields.categoryLabel")}
            id="recipe-panel-category"
            defaultOpen={false}
          >
            {/* Presentational pill: Dropdown's own button is the trigger. */}
            <Button presentational variant="filled" icon={categoryIconOrFallback(selectedCategory.icon)} align="left">
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

        <InputField
          label={t("fields.servingsLabel")}
          id="recipe-panel-servings"
          options={SERVINGS_SELECT_OPTIONS}
          trailingIcon="ChevronDown"
          value={String(servings)}
          onChange={(event) => setServings(Number(event.target.value))}
        />

        {/* Tijd: user-ordered deviation from Figma (2026-07-29) — no node in
            3777:3932/3717:2844 draws it, but it was requested as "an input
            field, no new UI needed" per the user's own instruction. Tags
            (the field's original companion) was removed in #149 — see
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

        <div className="flex w-full flex-col items-stretch gap-stack-lg">
          {ingredients.map((row, index) => (
            <div key={row.localId} className="flex w-full flex-col gap-stack-lg">
              {index > 0 && <div className="h-px w-full bg-stroke-primary" aria-hidden="true" />}
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
                onRemove={() => handleRemoveIngredientRow(row.localId)}
                removeLabel={t("fields.removeIngredientLabel")}
                removeDisabled={ingredients.length <= 1}
                reviewLabel={keepsNeedsReview(row) ? t("fields.needsReviewLabel") : undefined}
                linkInfo={linkInfo(row)}
              />
            </div>
          ))}
        </div>
        <Button variant="filled" icon="Plus" onClick={handleAddIngredientRow}>
          {t("addRowLabel")}
        </Button>

        {/* spacing-flag: gap-4 — Stappen has no Figma node in either
            "Add recipi" frame (3717:2844 mobile / 3717:2493 desktop); their
            Pull-up panel lists Titel/Personen/Tijd fields, Ingredienten, and
            the footer only — no Stappen list — so unlike the Ingredienten
            wrapper just above (measured, node 3717:2925/3957:11670,
            spacing/stack/stack-lg), this value would be a guess-from-number,
            not a measurement — design/notes/RecipePanel.md#219. */}
        <div className="flex w-full flex-col items-stretch gap-4">
          {steps.map((row, index) => (
            <div key={row.localId} className="flex w-full items-start gap-inline-sm">
              <div className="min-w-0 flex-1">
                <InputField
                  id={`recipe-panel-step-${row.localId}`}
                  label={t("fields.stepLabel", { number: index + 1 })}
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
                    // Opens StepIngredientPanel (#149, Figma 3749:3091/3749:3241)
                    // for this step — no longer `disabled`, the panel is built.
                    // Label grows a "(count)" suffix once a selection exists,
                    // this codebase's own judgement call (no Figma count badge
                    // exists on this pill) — see design/notes/RecipePanel.md.
                    <Button
                      variant="filled"
                      icon="Plus"
                      onClick={() => setStepIngredientPanel({ open: true, stepLocalId: row.localId })}
                    >
                      {row.ingredientLocalIds.length > 0
                        ? t("stepIngredientPillLabelWithCount", { count: row.ingredientLocalIds.length })
                        : t("stepIngredientPillLabel")}
                    </Button>
                  }
                />
              </div>
              {/* Controls column: the spacer consumes the label block the
                  InputField draws above its box, so the buttons sit beside the
                  box (same trick as RecipeIngredientRow's delete). */}
              <div className="flex shrink-0 flex-col gap-stack-sm self-stretch">
                <span aria-hidden="true" className="invisible text-base font-semibold">
                  &nbsp;
                </span>
                <Button
                  id={`recipe-panel-step-${row.localId}-up`}
                  icon="ArrowUp"
                  aria-label={t("fields.moveStepUpLabel", { number: index + 1 })}
                  className="disabled:opacity-40"
                  onClick={() => handleMoveStepRow(row.localId, "up")}
                  disabled={index === 0}
                />
                <Button
                  id={`recipe-panel-step-${row.localId}-down`}
                  icon="ArrowDown"
                  aria-label={t("fields.moveStepDownLabel", { number: index + 1 })}
                  className="disabled:opacity-40"
                  onClick={() => handleMoveStepRow(row.localId, "down")}
                  disabled={index === steps.length - 1}
                />
                <Button
                  variant="destructive"
                  icon="Trash"
                  aria-label={t("fields.removeStepLabel", { number: index + 1 })}
                  className="disabled:opacity-40"
                  onClick={() => handleRemoveStepRow(row.localId)}
                  disabled={steps.length <= 1}
                />
              </div>
            </div>
          ))}
        </div>
        <Button variant="filled" icon="Plus" onClick={handleAddStepRow}>
          {t("addRowLabel")}
        </Button>

        {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
      </SidePanel>

      <IngredientSearchPanel
        level={2}
        open={ingredientSearch.open}
        onClose={() => setIngredientSearch({ open: false, rowLocalId: null })}
        onSearch={onSearchIngredients}
        onCreateOwnIngredient={onCreateOwnIngredient}
        onSave={handleIngredientSaved}
        initialQuery={searchRow?.name}
      />

      <StepIngredientPanel
        open={stepIngredientPanel.open}
        onClose={() => setStepIngredientPanel({ open: false, stepLocalId: null })}
        ingredients={ingredients.map((row) => ({
          localId: row.localId,
          name: row.name,
          quantityLabel: formatQuantity(row.quantity, row.unit ? tUnits(row.unit) : null),
        }))}
        selectedIds={activeStepIngredientRow?.ingredientLocalIds ?? []}
        onSave={(selectedIds) => {
          const stepLocalId = stepIngredientPanel.stepLocalId;
          if (!stepLocalId) return;
          setSteps((current) =>
            current.map((step) =>
              step.localId === stepLocalId ? { ...step, ingredientLocalIds: selectedIds } : step,
            ),
          );
        }}
      />
    </>
  );
}

// Same gap/fallback as ReceptenBoard.tsx's own column-icon resolution —
// `recipe_categories.icon` is free-text at the schema layer.
function categoryIconOrFallback(icon: string) {
  return isIconName(icon) ? icon : FALLBACK_CATEGORY_ICON;
}
