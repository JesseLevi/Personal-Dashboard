"use client";

import { useState, useTransition } from "react";
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
import { UNIT_CODES, formatQuantity, type UnitCode } from "@/lib/recipes/units";
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

interface IngredientRowState {
  localId: string;
  name: string;
  quantity: number | null;
  unit: UnitCode | "";
  ingredientId: string | null;
  /** The `recipe_ingredients.id` this row was loaded from (edit mode only) — used once, at construction, to seed a step's `ingredientLocalIds` from the recipe's own `steps[].ingredientIds` (#149). Never sent in the save payload; `null` for a freshly typed/added row. */
  sourceId: string | null;
}

interface StepRowState {
  localId: string;
  instruction: string;
  /** Selected ingredient rows for this step, by their local `IngredientRowState.localId` — translated into payload `ingredientRefs` (indexes) at save time, never sent as-is. See `buildContentsPayload` below. */
  ingredientLocalIds: string[];
}

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
  onUploadThumbnail,
  onMutated,
}: RecipePanelProps) {
  const t = useTranslations("components.recipePanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tUnits = useTranslations("recipes.units");
  const tErrors = useTranslations("recipes.errors");
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

  const searchRow = ingredients.find((row) => row.localId === ingredientSearch.rowLocalId) ?? null;
  const activeStepIngredientRow =
    steps.find((row) => row.localId === stepIngredientPanel.stepLocalId) ?? null;

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

  // Ingredients/steps are built together, not by two independent filters
  // (#149): a step's `ingredientRefs` are indexes into the payload's
  // `ingredients` array, and that array only contains rows that survive the
  // empty-name filter — so the index map must be built from the FILTERED
  // list, never the raw `ingredients` state (an index computed before
  // filtering would point at the wrong row, or at a row that got dropped
  // entirely). See `lib/recipes/schemas.ts`'s `ingredientRefs` comment for
  // the receiving end of this contract.
  function buildContentsPayload() {
    const filteredIngredients = ingredients.filter((row) => row.name.trim() !== "");
    const indexByLocalId = new Map(filteredIngredients.map((row, index) => [row.localId, index]));
    return {
      ingredients: filteredIngredients.map((row) => ({
        name: row.name.trim(),
        quantity: row.quantity,
        unit: row.unit || "gram",
        ingredientId: row.ingredientId,
      })),
      steps: steps
        .filter((row) => row.instruction.trim() !== "")
        .map((row) => ({
          instruction: row.instruction.trim(),
          ingredientRefs: row.ingredientLocalIds
            .map((localId) => indexByLocalId.get(localId))
            .filter((index): index is number => index !== undefined),
        })),
    };
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
        ...buildContentsPayload(),
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
