"use client";

import { useCallback, useReducer } from "react";
import { Button } from "@/components/atoms/Button";
import { DELETE_CONFIRM_INITIAL, deleteConfirmReducer } from "@/lib/dom/delete-confirm";

// #288: the two-step delete confirmation shared by every panel/page that
// deletes (recipes, categories, notes, cards, the basket). Pure refactor of six
// verbatim copies — no Figma node exists for the confirm row, so the markup is
// the transient state those copies already shared (design/notes/NoteEditor.md).

export function useDeleteConfirm() {
  const [state, dispatch] = useReducer(deleteConfirmReducer, DELETE_CONFIRM_INITIAL);
  const ask = useCallback(() => dispatch("ask"), []);
  const cancel = useCallback(() => dispatch("cancel"), []);
  return { confirming: state.confirming, ask, cancel };
}

type DeleteConfirmProps = {
  // "stacked": side-panel footer (text row above two equal-width buttons).
  // "inline": page-header row (text beside two natural-width buttons).
  layout: "stacked" | "inline";
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  labels: { prompt: string; cancel: string; confirm: string; deleting: string };
};

export function DeleteConfirm({ layout, isPending, onCancel, onConfirm, labels }: DeleteConfirmProps) {
  const stacked = layout === "stacked";
  const grow = stacked ? "grow basis-0" : undefined;
  const buttons = (
    <>
      <Button variant="outline" className={grow} onClick={onCancel} disabled={isPending}>
        {labels.cancel}
      </Button>
      <Button variant="destructive" icon="Trash" className={grow} onClick={onConfirm} disabled={isPending}>
        {isPending ? labels.deleting : labels.confirm}
      </Button>
    </>
  );
  const prompt = <p className="text-base font-semibold text-text-primary">{labels.prompt}</p>;

  if (stacked) {
    return (
      <>
        {prompt}
        <div className="flex gap-inline-sm">{buttons}</div>
      </>
    );
  }
  return (
    // spacing-flag: gap-4 -- transient confirm-row state, no Figma node — design/notes/NoteEditor.md
    <div className="flex flex-wrap items-center justify-end gap-4">
      {prompt}
      {/* spacing-flag: gap-2 -- same transient confirm-row state — design/notes/NoteEditor.md */}
      <div className="flex items-center gap-2">{buttons}</div>
    </div>
  );
}
