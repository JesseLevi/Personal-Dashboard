"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { InputField } from "@/components/atoms/InputField";
import { Button } from "@/components/atoms/Button";
import type { IconName } from "@/components/atoms/Icon";
import type { ActionResult, RecipeCategoryRow } from "@/lib/recipes/types";

// Add/rename-category SidePanel content (#125) — Figma "Add column/Mobile"
// (3891:17997) + desktop pair (3957:11537, panel node — 3957:11962 on the
// same desktop frame is a stray duplicated "Add recipe" panel, unrelated
// scope, not built). Page-level composition of existing atoms/organisms,
// same precedent as BoardPanel.tsx/CardDetailPanel.tsx (not added to
// design/figma-map.json — no new atom). Reset-on-open follows
// CardDetailPanel.tsx's #105 pattern (not BoardPanel.tsx's older
// key-remount, which #103/#105 found breaks the first open transition on a
// target-changing SidePanel). Never imports "use server" code itself — the
// composer passes real actions as props so Ladle can mock them. Icon-picker
// curation, delete-confirm and validation decisions: design/notes/CategoryPanel.md.

// The 8-slot "Icon list" (3891:18524 mobile / 3957:11544 desktop) renders
// the SAME Icon/Sandwich placeholder in all 8 button instances — Figma
// specifies a slot count, not which icons. First pass shipped a curated
// 8-icon set for exactly that reason (see docs/open-questions.md#category-
// icon-picker-curated-set). Superseded 2026-08-01 by direct user
// instruction: show all 74 of lucide's "Food & beverage" category, not a
// curation. The 66 added beyond the original 8 are listed in Icon.tsx and
// were pulled from lucide-icons/lucide's own per-icon `categories`
// metadata via the GitHub API — lucide.dev's category page doesn't render
// its icon grid server-side, so the list was never guessed from the page
// text. `SidePanel`'s content area already scrolls (`overflow-y-auto`,
// footer pinned outside it) so 74 wrapped icon buttons need no new layout
// decision. See design/notes/CategoryPanel.md and design/notes/Icon.md.
export const CATEGORY_ICONS: IconName[] = [
  "Sandwich",
  "Croissant",
  "CakeSlice",
  "Broccoli",
  "Coffee",
  "Soup",
  "Pizza",
  "Cookie",
  "Amphora",
  "Apple",
  "Banana",
  "Barrel",
  "Bean",
  "BeanOff",
  "Beef",
  "BeefOff",
  "Beer",
  "BeerOff",
  "Blender",
  "BottleWine",
  "Cake",
  "Candy",
  "CandyCane",
  "CandyOff",
  "Carrot",
  "ChefHat",
  "Cherry",
  "Citrus",
  "CookingPot",
  "Cuboid",
  "CupSoda",
  "Dessert",
  "DnaOff",
  "Donut",
  "Drumstick",
  "Egg",
  "EggFried",
  "EggOff",
  "Fish",
  "FishOff",
  "FishSymbol",
  "GlassWater",
  "Grape",
  "Ham",
  "Hamburger",
  "HandPlatter",
  "Hop",
  "HopOff",
  "IceCreamBowl",
  "IceCreamCone",
  "LeafyGreen",
  "Lollipop",
  "Martini",
  "Microwave",
  "Milk",
  "MilkOff",
  "Nut",
  "NutOff",
  "PaperBag",
  "Popcorn",
  "Popsicle",
  "Refrigerator",
  "Salad",
  "Shell",
  "Snail",
  "Torus",
  "Tractor",
  "Utensils",
  "UtensilsCrossed",
  "Vegan",
  "Wheat",
  "WheatOff",
  "Wine",
  "WineOff",
];

export type CategoryPanelTarget =
  | { mode: "create" }
  | { mode: "edit"; category: RecipeCategoryRow };

export interface CategoryPanelProps {
  open: boolean;
  onClose: () => void;
  target: CategoryPanelTarget;
  onCreateCategory: (input: unknown) => Promise<ActionResult<RecipeCategoryRow>>;
  onUpdateCategory: (input: unknown) => Promise<ActionResult>;
  onDeleteCategory: (input: unknown) => Promise<ActionResult>;
  /** Fired after a successful create/rename/delete, before `onClose`. */
  onMutated?: () => void;
}

export function CategoryPanel({
  open,
  onClose,
  target,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onMutated,
}: CategoryPanelProps) {
  const t = useTranslations("components.categoryPanel");
  const tIconLabel = useTranslations("components.categoryPanel.iconLabels");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("recipes.errors");

  const category = target.mode === "edit" ? target.category : null;
  // Falls back to the curated list's first icon when a category's stored
  // icon isn't one of the 8 offered here (e.g. a future non-curated value) —
  // same "sane default over a blank/broken control" reasoning
  // ReceptenBoard.tsx's own isIconName fallback already uses.
  const defaultIcon =
    category && CATEGORY_ICONS.includes(category.icon as IconName)
      ? (category.icon as IconName)
      : CATEGORY_ICONS[0];

  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState<IconName>(defaultIcon);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset-on-open, not a `key`-per-target remount (CardDetailPanel.tsx's
  // #105 fix, deliberately NOT BoardPanel.tsx's older pattern — #103/#105
  // found that remounting SidePanel on a target change destroys its
  // already-mounted (closed) dialog node, so the very next open has no
  // previously-painted closed frame to animate from and jumps straight to
  // open). This panel is reachable from two different triggers targeting the
  // same entity (header "create", any column's pencil "edit") — a
  // target-changing open (edit column A, close, edit column B) is a real,
  // easy-to-hit path here, not just a create/edit toggle, so this fix
  // matters more here than it did for BoardPanel's create-only case.
  const targetKey = target.mode === "edit" ? `edit-${target.category.id}` : "create";
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevTargetKey, setPrevTargetKey] = useState(targetKey);
  if (prevOpen !== open || prevTargetKey !== targetKey) {
    const shouldReset = open && (!prevOpen || targetKey !== prevTargetKey);
    setPrevOpen(open);
    setPrevTargetKey(targetKey);
    if (shouldReset) {
      setName(category?.name ?? "");
      setIcon(defaultIcon);
      setDeleteConfirming(false);
      setError(null);
    }
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const trimmed = name.trim();
      if (target.mode === "create") {
        const result = await onCreateCategory({ name: trimmed, icon });
        if (!result.success) {
          setError(tErrors(result.error));
          return;
        }
      } else {
        const result = await onUpdateCategory({
          categoryId: target.category.id,
          name: trimmed,
          icon,
        });
        if (!result.success) {
          setError(tErrors(result.error));
          return;
        }
      }
      onMutated?.();
      onClose();
    });
  }

  function handleDelete() {
    if (!category) return;
    setError(null);
    startTransition(async () => {
      const result = await onDeleteCategory({ categoryId: category.id });
      if (!result.success) {
        setError(tErrors(result.error));
        setDeleteConfirming(false);
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  // Delete step + name validation: no Figma/ticket source for either (see
  // docs/open-questions.md#category-delete-no-confirm-designed and
  // #category-name-no-validation-designed) — reuses CardDetailPanel.tsx's
  // #94 two-step confirm precedent verbatim, and gates Save on a non-empty
  // trimmed name (createCategorySchema/updateCategorySchema's own
  // `min(1).max(200)`, lib/recipes/schemas.ts), the same minimal client-side
  // mirror BoardPanel.tsx/CardDetailPanel.tsx already use for their own name
  // fields.
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
          disabled={isPending || name.trim() === ""}
        >
          {isPending ? t("savingLabel") : t("saveLabel")}
        </Button>
      </div>
    );

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={target.mode === "create" ? t("addTitle") : t("editTitle")}
      closeLabel={tSidePanel("closeLabel")}
      footer={footer}
    >
      <InputField
        label={t("fields.nameLabel")}
        id="category-panel-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      {/* Figma's "Icons" frame (3957:11251/3957:11542): label + wrapping row,
          gap 8px between them, row itself gap 12px — no dedicated molecule,
          InputField's own label styling (text-base font-semibold
          text-text-muted) reused directly since it's the same visual role. */}
      <div className="flex w-full flex-col gap-2">
        <p className="text-base font-semibold text-text-muted">{t("fields.iconLabel")}</p>
        <div className="flex w-full flex-wrap gap-3">
          {CATEGORY_ICONS.map((iconName) => (
            // No Selected state is drawn in Figma (every one of the 8
            // instances is the same Style=Filled, State=Default) — see
            // docs/open-questions.md#category-icon-no-selected-state. Reuses
            // Button's own aria-pressed Selected semantics (design-tokens.md:
            // Filled's Selected only darkens text, no fill change) rather
            // than inventing new styling, so the picker still shows which
            // icon is chosen without adding a class this atom doesn't
            // already have.
            <Button
              key={iconName}
              variant="filled"
              icon={iconName}
              aria-pressed={icon === iconName}
              aria-label={tIconLabel(iconName)}
              onClick={() => setIcon(iconName)}
            />
          ))}
        </div>
      </div>
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
    </SidePanel>
  );
}
