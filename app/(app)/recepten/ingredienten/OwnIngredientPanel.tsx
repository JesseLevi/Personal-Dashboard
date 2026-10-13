"use client";

// design: Claude-designed on request (#325, #350), design/notes/IngredientAdminPage.md.
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { InputField } from "@/components/atoms/InputField";
import { Button } from "@/components/atoms/Button";
import { PanelSection, PanelTitle } from "./PanelSection";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import { UNITS } from "@/lib/recipes/units";
import type { AdminEigenIngredient, IngredientCategory } from "@/lib/recipes/ingredient-admin";
import type { ActionResult } from "@/lib/recipes/types";

export type OwnIngredientPanelTarget =
  | { mode: "create" }
  | { mode: "edit"; ingredient: AdminEigenIngredient };

export interface OwnIngredientPanelProps {
  open: boolean;
  onClose: () => void;
  target: OwnIngredientPanelTarget;
  /** Existing categories (NL/EN pairs); picking one sets both languages. */
  categories: IngredientCategory[];
  onCreate: (input: unknown) => Promise<ActionResult<unknown>>;
  onUpdate: (input: unknown) => Promise<ActionResult>;
  onDelete: (input: unknown) => Promise<ActionResult>;
  onMutated?: () => void;
}

// Weight per unit only applies to non-mass units; mirrors the zod schema.
const WEIGHABLE_UNITS = UNITS.filter((unit) => unit.magnitude !== "mass").map((unit) => unit.code);

const text = (value: string | null | undefined) => value ?? "";
// Select values besides a category's Dutch name.
const NO_CATEGORY = "";
const NEW_CATEGORY = "__new__";

const num = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

interface FormState {
  nameNl: string;
  nameEn: string;
  /** NO_CATEGORY, NEW_CATEGORY or an existing category's Dutch name. */
  category: string;
  /** Only used for NEW_CATEGORY. */
  categoryNl: string;
  categoryEn: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  unit: string;
  grams: string;
}

function formFor(ingredient: AdminEigenIngredient | null, categories: IngredientCategory[]): FormState {
  const current = ingredient?.categoryNl ?? ingredient?.categoryEn ?? null;
  const known = categories.some((category) => category.nl === ingredient?.categoryNl);
  return {
    nameNl: text(ingredient?.nameNl),
    nameEn: text(ingredient?.nameEn),
    category: current === null ? NO_CATEGORY : known ? ingredient!.categoryNl! : NEW_CATEGORY,
    categoryNl: text(ingredient?.categoryNl),
    categoryEn: text(ingredient?.categoryEn),
    kcal: num(ingredient?.kcal),
    protein: num(ingredient?.protein),
    carbs: num(ingredient?.carbs),
    fat: num(ingredient?.fat),
    fiber: num(ingredient?.fiber),
    unit: ingredient?.unitMass?.unit ?? "",
    grams: num(ingredient?.unitMass?.grams),
  };
}

export function OwnIngredientPanel({
  open,
  onClose,
  target,
  categories,
  onCreate,
  onUpdate,
  onDelete,
  onMutated,
}: OwnIngredientPanelProps) {
  const t = useTranslations("recipes.ingredientAdmin.ownPanel");
  const tUnits = useTranslations("recipes.units");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("recipes.errors");
  const locale = useLocale();

  const ingredient = target.mode === "edit" ? target.ingredient : null;
  const [form, setForm] = useState<FormState>(() => formFor(ingredient, categories));
  const { confirming, ask, cancel } = useDeleteConfirm();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset-on-open, same technique as CategoryPanel (no keyed remount).
  const targetKey = ingredient ? `edit-${ingredient.id}` : "create";
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevTargetKey, setPrevTargetKey] = useState(targetKey);
  if (prevOpen !== open || prevTargetKey !== targetKey) {
    const shouldReset = open && (!prevOpen || targetKey !== prevTargetKey);
    setPrevOpen(open);
    setPrevTargetKey(targetKey);
    if (shouldReset) {
      setForm(formFor(ingredient, categories));
      cancel();
      setError(null);
    }
  }

  const set = (field: keyof FormState) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  function categoryPayload() {
    if (form.category === NEW_CATEGORY) return { categoryNl: form.categoryNl, categoryEn: form.categoryEn };
    const picked = categories.find((category) => category.nl === form.category);
    return { categoryNl: picked?.nl ?? null, categoryEn: picked?.en ?? null };
  }

  function payload() {
    return {
      nameNl: form.nameNl,
      nameEn: form.nameEn,
      ...categoryPayload(),
      kcal: form.kcal,
      protein: form.protein,
      carbs: form.carbs,
      fat: form.fat,
      fiber: form.fiber,
      unitMass: form.unit === "" ? null : { unit: form.unit, grams: form.grams },
    };
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = ingredient
        ? await onUpdate({ ingredientId: ingredient.id, ...payload() })
        : await onCreate(payload());
      if (!result.success) {
        setError(tErrors(result.error));
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  function handleDelete() {
    if (!ingredient) return;
    setError(null);
    startTransition(async () => {
      const result = await onDelete({ ingredientId: ingredient.id });
      if (!result.success) {
        setError(tErrors(result.error));
        cancel();
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  const hasUnit = form.unit !== "";
  const isNewCategory = form.category === NEW_CATEGORY;
  const canSave =
    !isPending &&
    form.nameNl.trim() !== "" &&
    (!isNewCategory || form.categoryNl.trim() !== "") &&
    (!hasUnit || form.grams.trim() !== "");

  const categoryLabel = (category: IngredientCategory) =>
    locale === "en" && category.en ? category.en : category.nl;
  const categoryOptions = [
    { value: NO_CATEGORY, label: t("categoryNone") },
    ...categories
      .map((category) => ({ value: category.nl, label: categoryLabel(category) }))
      .sort((a, b) => a.label.localeCompare(b.label, locale)),
    { value: NEW_CATEGORY, label: t("categoryNew") },
  ];

  const footer =
    ingredient && confirming ? (
      <DeleteConfirm
        layout="stacked"
        isPending={isPending}
        onCancel={cancel}
        onConfirm={handleDelete}
        labels={{
          prompt: t("deleteConfirmLabel"),
          cancel: t("cancelLabel"),
          confirm: t("deleteConfirmButtonLabel"),
          deleting: t("deletingLabel"),
        }}
      />
    ) : (
      <div className="flex gap-inline-sm">
        {ingredient && (
          <Button variant="destructive" icon="Trash" onClick={ask} disabled={isPending}>
            {t("deleteLabel")}
          </Button>
        )}
        <Button variant="filled" icon="Save" className="grow basis-0" onClick={handleSave} disabled={!canSave}>
          {isPending ? t("savingLabel") : t("saveLabel")}
        </Button>
      </div>
    );

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={ingredient ? t("editTitle") : t("addTitle")}
      closeLabel={tSidePanel("closeLabel")}
      footer={footer}
    >
      <PanelTitle>{ingredient ? t("editTitle") : t("addTitle")}</PanelTitle>

      <PanelSection heading={t("namesHeading")}>
        <InputField label={t("nameNlLabel")} id="own-name-nl" value={form.nameNl} onChange={set("nameNl")} required />
        <InputField label={t("nameEnLabel")} id="own-name-en" value={form.nameEn} onChange={set("nameEn")} />
      </PanelSection>

      <PanelSection heading={t("categoryLabel")} hint={isNewCategory ? t("categoryNewHint") : undefined}>
        <InputField
          aria-label={t("categoryLabel")}
          id="own-category"
          trailingIcon="ChevronDown"
          value={form.category}
          onChange={set("category")}
          options={categoryOptions}
        />
        {isNewCategory && (
          <>
            <InputField label={t("categoryNlLabel")} id="own-category-nl" value={form.categoryNl} onChange={set("categoryNl")} required />
            <InputField label={t("categoryEnLabel")} id="own-category-en" value={form.categoryEn} onChange={set("categoryEn")} />
          </>
        )}
      </PanelSection>

      <PanelSection heading={t("nutrientsLabel")} hint={t("nutrientsHint")}>
        <div className="grid grid-cols-2 gap-x-inline-sm gap-y-stack-md">
          <InputField label={t("kcalLabel")} id="own-kcal" inputMode="decimal" value={form.kcal} onChange={set("kcal")} />
          <InputField label={t("proteinLabel")} id="own-protein" inputMode="decimal" value={form.protein} onChange={set("protein")} />
          <InputField label={t("carbsLabel")} id="own-carbs" inputMode="decimal" value={form.carbs} onChange={set("carbs")} />
          <InputField label={t("fatLabel")} id="own-fat" inputMode="decimal" value={form.fat} onChange={set("fat")} />
          <InputField label={t("fiberLabel")} id="own-fiber" inputMode="decimal" value={form.fiber} onChange={set("fiber")} />
        </div>
      </PanelSection>

      <PanelSection heading={t("weightLabel")} hint={t("weightHint")}>
        <div className="grid grid-cols-2 gap-x-inline-sm">
          <InputField
            label={t("unitLabel")}
            id="own-unit"
            trailingIcon="ChevronDown"
            value={form.unit}
            onChange={set("unit")}
            options={[
              { value: "", label: t("unitNone") },
              ...WEIGHABLE_UNITS.map((unit) => ({ value: unit, label: tUnits(unit) })),
            ]}
          />
          {hasUnit && (
            <InputField label={t("gramsLabel")} id="own-grams" inputMode="decimal" value={form.grams} onChange={set("grams")} />
          )}
        </div>
      </PanelSection>
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
    </SidePanel>
  );
}
