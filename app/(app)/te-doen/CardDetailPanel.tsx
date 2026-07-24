"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { InputField } from "@/components/atoms/InputField";
import { Dropdown } from "@/components/atoms/Dropdown";
import { Tag } from "@/components/atoms/Tag";
import { Button } from "@/components/atoms/Button";
import type { IconName } from "@/components/atoms/Icon";
import { PRIORITIES, SIZES, isPriority, isSize } from "@/lib/boards/enums";
import type { ActionResult, CardRow, CardWithLabels } from "@/lib/boards/types";

// Card-detail SidePanel content (#94) — Figma "Te doen/*/AddItem"
// (3779:4846 mobile, 3779:4938 desktop; same node SidePanel.tsx already
// claims for its chrome). Page-level composition of existing atoms/organisms
// exactly as Figma nests them, not a new atomic-design leaf, so — same
// precedent as TeDoenBoard.tsx — this isn't added to design/figma-map.json.
// One component for create+edit (`target.mode`); TeDoenBoard.tsx owns the
// panel's open/target state and supplies the real server actions + a
// post-mutation callback as props — this file imports neither "use server"
// code nor `next/navigation`, so it (and its Ladle stories, mocked actions)
// never needs a real Next.js request/router context. Full field-by-field
// reasoning, the Status-writes-column_id-via-moveCard wiring, and every
// flagged deviation: design/notes/CardDetailPanel.md.

export interface CardDetailPanelColumn {
  id: string;
  name: string;
  icon: IconName;
}

export type CardDetailPanelTarget =
  | { mode: "create"; columnId: string }
  | { mode: "edit"; card: CardWithLabels };

export interface CardDetailPanelProps {
  open: boolean;
  onClose: () => void;
  columns: CardDetailPanelColumn[];
  target: CardDetailPanelTarget;
  onCreateCard: (input: unknown) => Promise<ActionResult<CardRow>>;
  onUpdateCard: (input: unknown) => Promise<ActionResult>;
  onMoveCard: (input: unknown) => Promise<ActionResult<{ position: number }>>;
  onDeleteCard: (input: unknown) => Promise<ActionResult>;
  /** Fired after a successful create/update/move/delete, before `onClose` — TeDoenBoard.tsx wires this to `router.refresh()` (see its own file for why). Never fired on a plain close/cancel. */
  onMutated?: () => void;
}

// moveCard clamps any out-of-range targetIndex down to "after the last
// sibling" server-side (lib/boards/positioning.ts via actions.ts), so this
// only has to be "larger than any real column can hold," not an actual count.
const APPEND_AT_END_INDEX = Number.MAX_SAFE_INTEGER;

export function CardDetailPanel(props: CardDetailPanelProps) {
  const { target } = props;
  // Remounts the form whenever the *target* (not just open/closed) changes,
  // so switching from editing card A to creating in column X — or straight
  // to editing card B — always starts from fresh field state instead of
  // carrying over unsaved edits. Toggling `open` alone keeps the same key,
  // so SidePanel's own open/close transition still animates normally.
  const key = target.mode === "edit" ? `edit-${target.card.id}` : `create-${target.columnId}`;
  return <CardDetailPanelForm key={key} {...props} />;
}

function CardDetailPanelForm({
  open,
  onClose,
  columns,
  target,
  onCreateCard,
  onUpdateCard,
  onMoveCard,
  onDeleteCard,
  onMutated,
}: CardDetailPanelProps) {
  const t = useTranslations("components.cardDetailPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tPriority = useTranslations("boards.priority");
  const tErrors = useTranslations("boards.errors");
  const format = useFormatter();

  const card = target.mode === "edit" ? target.card : null;

  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [columnId, setColumnId] = useState(
    card?.column_id ?? (target.mode === "create" ? target.columnId : ""),
  );
  const [priority, setPriority] = useState(
    card && isPriority(card.priority) ? card.priority : "medium",
  );
  const [size, setSize] = useState(card?.size && isSize(card.size) ? card.size : null);
  const [dueAtText, setDueAtText] = useState(() =>
    card?.due_at
      ? format.dateTime(new Date(card.due_at), {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "",
  );
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function buildFieldPayload() {
    const trimmedDescription = description.trim();
    const trimmedDueAt = dueAtText.trim();
    return {
      title: title.trim(),
      description: trimmedDescription === "" ? null : trimmedDescription,
      priority,
      size,
      dueAt: trimmedDueAt === "" ? null : trimmedDueAt,
    };
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const fields = buildFieldPayload();
      if (target.mode === "create") {
        const result = await onCreateCard({ columnId, ...fields });
        if (!result.success) {
          setError(tErrors(result.error));
          return;
        }
      } else {
        const result = await onUpdateCard({ cardId: target.card.id, ...fields });
        if (!result.success) {
          setError(tErrors(result.error));
          return;
        }
        // updateCard has no column_id field on purpose (position needs
        // recomputing, not just overwriting) — a real Status change is a
        // move, so it goes through moveCard, the action already built for
        // that. See design/notes/CardDetailPanel.md.
        if (columnId !== target.card.column_id) {
          const moveResult = await onMoveCard({
            cardId: target.card.id,
            columnId,
            targetIndex: APPEND_AT_END_INDEX,
          });
          if (!moveResult.success) {
            setError(tErrors(moveResult.error));
            return;
          }
        }
      }
      onMutated?.();
      onClose();
    });
  }

  function handleDelete() {
    if (!card) return;
    setError(null);
    startTransition(async () => {
      const result = await onDeleteCard({ cardId: card.id });
      if (!result.success) {
        setError(tErrors(result.error));
        setDeleteConfirming(false);
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  const selectedColumn = columns.find((column) => column.id === columnId) ?? columns[0];
  const otherColumns = columns.filter((column) => column.id !== selectedColumn?.id);
  const otherPriorities = PRIORITIES.filter((value) => value !== priority);
  const otherSizes = SIZES.filter((value) => value !== size);

  const footer =
    target.mode === "edit" && deleteConfirming ? (
      <>
        <span className="flex-1 text-base font-semibold text-text">
          {t("deleteConfirmLabel")}
        </span>
        <Button variant="outline" onClick={() => setDeleteConfirming(false)} disabled={isPending}>
          {t("cancelLabel")}
        </Button>
        <Button variant="destructive" icon="Trash" onClick={handleDelete} disabled={isPending}>
          {isPending ? t("deletingLabel") : t("deleteConfirmButtonLabel")}
        </Button>
      </>
    ) : (
      <>
        {target.mode === "edit" && (
          <Button
            variant="destructive"
            icon="Trash"
            onClick={() => setDeleteConfirming(true)}
            disabled={isPending}
          >
            {t("deleteLabel")}
          </Button>
        )}
        <Button
          variant="filled"
          icon="Save"
          onClick={handleSave}
          disabled={isPending || title.trim() === ""}
        >
          {isPending ? t("savingLabel") : t("saveLabel")}
        </Button>
      </>
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
        id="card-detail-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      <InputField
        label={t("fields.descriptionLabel")}
        id="card-detail-description"
        multiline
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      {selectedColumn && (
        <Dropdown
          key={selectedColumn.id}
          label={t("fields.statusLabel")}
          id="card-detail-status"
          defaultOpen={false}
        >
          <Button variant="filled" icon={selectedColumn.icon}>
            {selectedColumn.name}
          </Button>
          {otherColumns.map((column) => (
            <Button
              key={column.id}
              variant="white"
              icon={column.icon}
              onClick={() => setColumnId(column.id)}
            >
              {column.name}
            </Button>
          ))}
        </Dropdown>
      )}
      <Dropdown
        key={priority}
        label={t("fields.priorityLabel")}
        id="card-detail-priority"
        defaultOpen={false}
      >
        <Tag variant={priority}>{tPriority(priority)}</Tag>
        {otherPriorities.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setPriority(value)}
            className="flex w-full rounded-lg text-left transition-colors hover:bg-surface-hover"
          >
            <Tag variant={value}>{tPriority(value)}</Tag>
          </button>
        ))}
      </Dropdown>
      <Dropdown
        key={size ?? "none"}
        label={t("fields.sizeLabel")}
        id="card-detail-size"
        defaultOpen={false}
      >
        <Tag variant="neutral">{size ? size.toUpperCase() : t("fields.sizePlaceholder")}</Tag>
        {otherSizes.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSize(value)}
            className="flex w-full rounded-lg text-left transition-colors hover:bg-surface-hover"
          >
            <Tag variant="neutral">{value.toUpperCase()}</Tag>
          </button>
        ))}
      </Dropdown>
      <InputField
        label={t("fields.dateLabel")}
        id="card-detail-due-at"
        leadingIcon="Calendar"
        trailingIcon="Pencil"
        placeholder={t("fields.datePlaceholder")}
        value={dueAtText}
        onChange={(event) => setDueAtText(event.target.value)}
      />
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
    </SidePanel>
  );
}
