"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { InputField } from "@/components/atoms/InputField";
import { Button } from "@/components/atoms/Button";
import type { ActionResult, BoardRow } from "@/lib/boards/types";

// Add/edit-board SidePanel content (#95 piece 3) — Figma "Te doen/Desktop/
// AddBoard" (3878:9060). Page-level composition of existing atoms/organisms,
// same precedent as CardDetailPanel.tsx (not added to design/figma-map.json).
// Deliberately Name-only: "A board has only a name — build NO icon/colour
// picker" (ticket text). The fetched node's footer also shows a Verwijderen
// (delete) button, NOT built here: the kanban migration's own comment on
// `boards.is_favorite` says reassigning a favourite after a board is deleted
// "is for the board-delete ticket to handle" — a forward reference to a
// ticket that isn't this one. Full reasoning: design/notes/TeDoenBoard.md.

export type BoardPanelTarget = { mode: "create" } | { mode: "edit"; board: BoardRow };

export interface BoardPanelProps {
  open: boolean;
  onClose: () => void;
  target: BoardPanelTarget;
  onCreateBoard: (input: unknown) => Promise<ActionResult<BoardRow>>;
  onRenameBoard: (input: unknown) => Promise<ActionResult>;
  /** Fired after a successful create with the new board's id (caller navigates to it) or after a successful rename (no id). */
  onCreated: (board: BoardRow) => void;
  onRenamed: () => void;
}

export function BoardPanel(props: BoardPanelProps) {
  // Remount on target change, same reasoning as CardDetailPanel's own `key`.
  const key = props.target.mode === "edit" ? `edit-${props.target.board.id}` : "create";
  return <BoardPanelForm key={key} {...props} />;
}

function BoardPanelForm({
  open,
  onClose,
  target,
  onCreateBoard,
  onRenameBoard,
  onCreated,
  onRenamed,
}: BoardPanelProps) {
  const t = useTranslations("components.boardPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("boards.errors");

  const [name, setName] = useState(target.mode === "edit" ? target.board.name : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const trimmed = name.trim();
      if (target.mode === "create") {
        const result = await onCreateBoard({ name: trimmed });
        if (!result.success) {
          setError(tErrors(result.error));
          return;
        }
        onCreated(result.data);
      } else {
        const result = await onRenameBoard({ boardId: target.board.id, name: trimmed });
        if (!result.success) {
          setError(tErrors(result.error));
          return;
        }
        onRenamed();
      }
      onClose();
    });
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={target.mode === "create" ? t("addTitle") : t("editTitle")}
      closeLabel={tSidePanel("closeLabel")}
      // #103: SidePanel's footer container is a column that already forces
      // this row full-width; `grow basis-0` makes the (single) button claim
      // all of it — same convention as CardDetailPanel.tsx's footer, kept
      // uniform even though a lone button would stretch via the container's
      // own cross-axis stretch regardless, so every footer call site reads
      // the same way at a glance.
      footer={
        <div className="flex gap-2">
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
      }
    >
      <InputField
        label={t("fields.nameLabel")}
        id="board-panel-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
    </SidePanel>
  );
}
