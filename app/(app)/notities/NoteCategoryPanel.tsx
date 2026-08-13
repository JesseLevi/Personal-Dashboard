"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { InputField } from "@/components/atoms/InputField";
import { Button } from "@/components/atoms/Button";
import type { IconName } from "@/components/atoms/Icon";
import type { ActionResult, NoteCategoryRow } from "@/lib/notes/types";

// Add/rename-category SidePanel content (#232). No Figma node of its own —
// `Pages/Notities/Breakpoints` (3934:32790) draws no category panel, only
// the overview/editor frames — so this is `app/(app)/recepten/CategoryPanel.tsx`
// reused one-to-one rather than a freshly invented shape (never build UI
// absent from Figma), and deliberately a Notities-owned copy rather than a
// shared generic component: motivation, icon-set reasoning, delete-flow
// precedent all in design/notes/NoteCategoryPanel.md. Reset-on-open follows
// CategoryPanel.tsx's own #105-derived pattern (not BoardPanel.tsx's older
// key-remount). Never imports "use server" code itself — the composer passes
// real actions as props so Ladle can mock them.

// General-purpose set for note categories, distinct from /recepten's
// food-specific 74-icon picker — reasoning in design/notes/NoteCategoryPanel.md.
// Every entry is already in Icon.tsx's IconName union; none was added for
// this ticket.
export const NOTE_CATEGORY_ICONS: IconName[] = [
  "FolderClosed",
  "Notebook",
  "Lightbulb",
  "Scroll",
  "Star",
  "Calendar",
  "Timer",
  "AlarmClockCheck",
  "CircleCheck",
  "ShoppingBasket",
  "BicepsFlexed",
  "User",
  "Shirt",
  "Image",
];

export type NoteCategoryPanelTarget =
  | { mode: "create" }
  | { mode: "edit"; category: NoteCategoryRow };

export interface NoteCategoryPanelProps {
  open: boolean;
  onClose: () => void;
  target: NoteCategoryPanelTarget;
  onCreateCategory: (input: unknown) => Promise<ActionResult<NoteCategoryRow>>;
  onRenameCategory: (input: unknown) => Promise<ActionResult>;
  onDeleteCategory: (input: unknown) => Promise<ActionResult>;
  /** Fired after a successful create/rename/delete, before `onClose`. */
  onMutated?: () => void;
}

export function NoteCategoryPanel({
  open,
  onClose,
  target,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onMutated,
}: NoteCategoryPanelProps) {
  const t = useTranslations("components.noteCategoryPanel");
  const tIconLabel = useTranslations("components.noteCategoryPanel.iconLabels");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("notes.errors");

  const category = target.mode === "edit" ? target.category : null;
  // Falls back to the curated list's first icon when a category's stored
  // icon isn't one of the offered ones (e.g. a seeded/legacy value outside
  // this list) — same "sane default over a blank/broken control" reasoning
  // CategoryPanel.tsx's own defaultIcon already uses.
  const defaultIcon =
    category && NOTE_CATEGORY_ICONS.includes(category.icon as IconName)
      ? (category.icon as IconName)
      : NOTE_CATEGORY_ICONS[0];

  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState<IconName>(defaultIcon);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset-on-open, not a `key`-per-target remount — CategoryPanel.tsx's own
  // #105-derived pattern, needed for the same reason: this panel is reachable
  // from two different triggers targeting the same entity (header "create",
  // any column's pencil "edit"), so a target-changing open is a real path.
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
        const result = await onRenameCategory({
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
  // design/notes/NoteCategoryPanel.md) — reuses CategoryPanel.tsx's own
  // two-step confirm verbatim (itself #94's precedent), and gates Save on a
  // non-empty trimmed name (createCategorySchema/renameCategorySchema's own
  // `min(1).max(200)`, lib/notes/schemas.ts), the same minimal client-side
  // mirror every other panel in this codebase already uses for its name field.
  const footer =
    target.mode === "edit" && deleteConfirming ? (
      <>
        <p className="text-base font-semibold text-text-primary">{t("deleteConfirmLabel")}</p>
        <div className="flex gap-inline-sm">
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
      <div className="flex gap-inline-sm">
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
        id="note-category-panel-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      {/* Same label+wrapping-row shape CategoryPanel.tsx uses for the
          identical Figma "Icons" frame pattern (SidePanel content, no new
          molecule) — reused rather than re-measured, since this panel has no
          fetched node of its own. See design/notes/NoteCategoryPanel.md. */}
      <div className="flex w-full flex-col gap-stack-sm">
        <p className="text-base font-semibold text-text-secondary">{t("fields.iconLabel")}</p>
        <div className="flex w-full flex-wrap gap-x-inline-md gap-y-stack-md">
          {NOTE_CATEGORY_ICONS.map((iconName) => (
            // No Selected state is drawn in Figma for this control anywhere
            // in this codebase — reuses Button's own aria-pressed Selected
            // semantics, same as CategoryPanel.tsx's icon picker.
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
