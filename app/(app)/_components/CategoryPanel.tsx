"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { InputField } from "@/components/atoms/InputField";
import { Button } from "@/components/atoms/Button";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import type { IconName } from "@/components/atoms/Icon";

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
// Shared by /recepten and /notities (#287): the icon set, i18n namespaces and
// server actions are props, everything else is identical for both callers.

// Structural subset of recipe_categories / note_categories rows.
export interface CategoryPanelCategory {
  id: string;
  name: string;
  icon: string;
}

// Structural subset of both domains' ActionResult.
export type CategoryPanelActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export type CategoryPanelTarget =
  | { mode: "create" }
  | { mode: "edit"; category: CategoryPanelCategory };

export interface CategoryPanelProps {
  open: boolean;
  onClose: () => void;
  target: CategoryPanelTarget;
  /** Icons offered in the picker; the first is the create-mode default and fallback. */
  icons: IconName[];
  /** next-intl namespace holding this panel's strings and `iconLabels.*`. */
  translationNamespace: string;
  /** next-intl namespace holding the domain's action error codes. */
  errorsNamespace: string;
  onCreateCategory: (input: unknown) => Promise<CategoryPanelActionResult<unknown>>;
  onUpdateCategory: (input: unknown) => Promise<CategoryPanelActionResult>;
  onDeleteCategory: (input: unknown) => Promise<CategoryPanelActionResult>;
  /** Fired after a successful create/rename/delete, before `onClose`. */
  onMutated?: () => void;
}

export function CategoryPanel({
  open,
  onClose,
  target,
  icons,
  translationNamespace,
  errorsNamespace,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onMutated,
}: CategoryPanelProps) {
  const t = useTranslations(translationNamespace);
  const tIconLabel = useTranslations(`${translationNamespace}.iconLabels`);
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations(errorsNamespace);

  const category = target.mode === "edit" ? target.category : null;
  // Falls back to the curated list's first icon when a category's stored
  // icon isn't one of the offered ones here (e.g. a future non-curated value) —
  // same "sane default over a blank/broken control" reasoning
  // ReceptenBoard.tsx's own isIconName fallback already uses.
  const defaultIcon =
    category && icons.includes(category.icon as IconName)
      ? (category.icon as IconName)
      : icons[0];

  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState<IconName>(defaultIcon);
  const { confirming: deleteConfirming, ask: askDelete, cancel: cancelDelete } = useDeleteConfirm();
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
      cancelDelete();
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
        cancelDelete();
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  // Delete step + name validation: no Figma/ticket source for either (see
  // design/notes/CategoryPanel.md) — reuses CardDetailPanel.tsx's
  // #94 two-step confirm precedent verbatim, and gates Save on a non-empty
  // trimmed name (createCategorySchema/updateCategorySchema's own
  // `min(1).max(200)`, lib/{recipes,notes}/schemas.ts), the same minimal client-side
  // mirror BoardPanel.tsx/CardDetailPanel.tsx already use for their own name
  // fields.
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
          text-text-secondary) reused directly since it's the same visual role. */}
      <div className="flex w-full flex-col gap-stack-sm">
        <p className="text-base font-semibold text-text-secondary">{t("fields.iconLabel")}</p>
        {/* Icon list (node 3891:18524 mobile / 3957:11544 desktop) binds two
            different tokens per axis: itemSpacing (row) -> spacing/inline/
            gap-md, counterAxisSpacing (wrap/column gap) -> spacing/stack/
            stack-md. Both resolve to 12px today, so a flat gap-3 was
            pixel-identical, but the axis rule calls for two distinct tokens
            here, not one — design/notes/CategoryPanel.md#219. */}
        <div className="flex w-full flex-wrap gap-x-inline-md gap-y-stack-md">
          {icons.map((iconName) => (
            // No Selected state is drawn in Figma (every one of the 8
            // instances is the same Style=Filled, State=Default) — see
            // design/notes/CategoryPanel.md. Reuses
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
