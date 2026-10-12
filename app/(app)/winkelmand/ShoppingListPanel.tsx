"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { InputField } from "@/components/atoms/InputField";
import { Button } from "@/components/atoms/Button";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import type { ActionResult, ShoppingListRow } from "@/lib/shopping/types";

// design: Claude-designed (#424), from Figma "Winkelmand/03" (4231:16736).
// Add/edit-basket SidePanel content: page-level composition of SidePanel +
// InputField + Button, same precedent as BoardPanel.tsx / CategoryPanel.tsx
// (not in design/figma-map.json). Only the Naam field here; the "Delen met
// persoon" field comes with the sharing ticket. Never imports "use server"
// code: the composer passes the actions as props so Ladle can mock them.
// Contract: design/notes/ShoppingListPanel.md.

/** A basket as the UI needs it: `name` is already the translated default for a null DB name. */
export interface ShoppingListOption {
  id: string;
  name: string;
  isDefault: boolean;
}

export type ShoppingListPanelTarget =
  | { mode: "create" }
  | { mode: "edit"; list: ShoppingListOption };

export interface ShoppingListPanelProps {
  open: boolean;
  onClose: () => void;
  target: ShoppingListPanelTarget;
  onCreateList: (input: unknown) => Promise<ActionResult<ShoppingListRow>>;
  onRenameList: (input: unknown) => Promise<ActionResult>;
  onDeleteList: (input: unknown) => Promise<ActionResult>;
  /** Fired after a successful create with the new basket (the caller navigates to it). */
  onCreated: (list: ShoppingListRow) => void;
  onRenamed: () => void;
  /** Fired after a successful delete (the caller navigates to the default basket). */
  onDeleted: () => void;
}

export function ShoppingListPanel({
  open,
  onClose,
  target,
  onCreateList,
  onRenameList,
  onDeleteList,
  onCreated,
  onRenamed,
  onDeleted,
}: ShoppingListPanelProps) {
  const t = useTranslations("components.shoppingListPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("shopping.errors");

  const list = target.mode === "edit" ? target.list : null;
  const [name, setName] = useState(list?.name ?? "");
  const { confirming: deleteConfirming, ask: askDelete, cancel: cancelDelete } = useDeleteConfirm();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset on open (CategoryPanel's #105 pattern, not a `key` remount, which
  // would destroy the already-painted closed frame the open transition needs).
  const targetKey = target.mode === "edit" ? `edit-${target.list.id}` : "create";
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevTargetKey, setPrevTargetKey] = useState(targetKey);
  if (prevOpen !== open || prevTargetKey !== targetKey) {
    const shouldReset = open && (!prevOpen || targetKey !== prevTargetKey);
    setPrevOpen(open);
    setPrevTargetKey(targetKey);
    if (shouldReset) {
      setName(list?.name ?? "");
      cancelDelete();
      setError(null);
    }
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const trimmed = name.trim();
      if (target.mode === "create") {
        const result = await onCreateList({ name: trimmed });
        if (!result.success) {
          setError(tErrors(result.error));
          return;
        }
        onCreated(result.data);
      } else {
        const result = await onRenameList({ listId: target.list.id, name: trimmed });
        if (!result.success) {
          setError(tErrors(result.error));
          return;
        }
        onRenamed();
      }
      onClose();
    });
  }

  function handleDelete() {
    if (!list) return;
    setError(null);
    startTransition(async () => {
      const result = await onDeleteList({ listId: list.id });
      if (!result.success) {
        setError(tErrors(result.error));
        cancelDelete();
        return;
      }
      onDeleted();
      onClose();
    });
  }

  // Delete is hidden for the default basket (it cannot be deleted, ADR-0035).
  const canDelete = target.mode === "edit" && !target.list.isDefault;

  const footer =
    canDelete && deleteConfirming ? (
      <DeleteConfirm
        layout="stacked"
        isPending={isPending}
        onCancel={cancelDelete}
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
        {canDelete && (
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
        id="shopping-list-panel-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
    </SidePanel>
  );
}
