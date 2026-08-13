"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { InputField } from "@/components/atoms/InputField";
import { Dropdown } from "@/components/atoms/Dropdown";
import { Tag } from "@/components/atoms/Tag";
import { Button } from "@/components/atoms/Button";
import type { IconName } from "@/components/atoms/Icon";
import { PRIORITIES, SIZES, isPriority, isSize, type Size } from "@/lib/boards/enums";
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

export function CardDetailPanel({
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

  // Reset-on-open, not remount-on-target-change (#105, and the #103 first-
  // click animation bug this used to cause). Before: an outer `key`
  // (`edit-<id>` / `create-<columnId>`) forced React to fully remount
  // SidePanel whenever `target` changed, which reset stale field state but
  // also destroyed SidePanel's own dialog `<div>` — its very first paint
  // under the new key was already `open`, with no previously-painted closed
  // frame for the CSS transition to interpolate from. Verified in a real
  // browser (Playwright, card-detail-panel--interactive story): sampling
  // `getBoundingClientRect().y` frame-by-frame across a target-changing open
  // showed the value jump straight to its final position with zero
  // intermediate frames — on every target change, not only the very first
  // one (the ticket's own "first click" framing undersells the scope).
  //
  // This block is the React-documented "adjust state while rendering"
  // pattern (comparing against state snapshotted from the previous render,
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // instead of a `useEffect` — it resets synchronously within the same
  // render/commit, so there is no extra painted frame showing stale fields
  // before the reset lands (a `useEffect`-based reset would commit the stale
  // values first, then reset a frame later). It reproduces every case the
  // old remount covered, without ever destroying SidePanel's DOM node:
  // - a fresh open (any target) → reset, including opening "create" twice in
  //   the same column (#105's own bug — same `targetKey` both times, so a
  //   *target*-keyed effect alone would have missed this; it fires on every
  //   open regardless of whether the key changed).
  // - a target switch while already open (e.g. clicking card B while card
  //   A's panel is open, without closing first) → reset, replacing #94's old
  //   accepted "remounts entirely" trade-off with the same visible outcome
  //   minus the remount.
  // - typing in an open panel, with no `open`/`target` change → untouched,
  //   never resets mid-edit.
  const targetKey = target.mode === "edit" ? `edit-${target.card.id}` : `create-${target.columnId}`;
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevTargetKey, setPrevTargetKey] = useState(targetKey);
  if (prevOpen !== open || prevTargetKey !== targetKey) {
    const shouldReset = open && (!prevOpen || targetKey !== prevTargetKey);
    setPrevOpen(open);
    setPrevTargetKey(targetKey);
    if (shouldReset) {
      setTitle(card?.title ?? "");
      setDescription(card?.description ?? "");
      setColumnId(card?.column_id ?? (target.mode === "create" ? target.columnId : ""));
      setPriority(card && isPriority(card.priority) ? card.priority : "medium");
      setSize(card?.size && isSize(card.size) ? card.size : null);
      setDueAtText(
        card?.due_at
          ? format.dateTime(new Date(card.due_at), {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "",
      );
      setDeleteConfirming(false);
      setError(null);
    }
  }

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
  const otherSizes: (Size | null)[] = [null, ...SIZES].filter((value) => value !== size);

  // Footer width (#103): SidePanel's footer container is a column, so this
  // row of buttons is already forced full-width; each Button opts into an
  // equal share of it via `grow basis-0` (never `flex-1` — that shorthand
  // also sets `flex-shrink`, which would land on the same CSS property as
  // Button's own `shrink-0` and make the outcome depend on emission-order
  // specificity, the exact trap docs/design-tokens.md's Outline/Selected
  // history already warns about; `grow`+`basis-0` only touches flex-grow/
  // flex-basis, disjoint from `shrink-0`, so order can never matter). The
  // delete-confirm text is its own full-width row above the button row (the
  // user's 2026-07-25 decision, no Figma node models it) — "n buttons =
  // 100/n" per the ticket, so the text doesn't count as a column.
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
          disabled={isPending || title.trim() === ""}
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
          <Button variant="filled" icon={selectedColumn.icon} align="left">
            {selectedColumn.name}
          </Button>
          {otherColumns.map((column) => (
            <Button
              key={column.id}
              variant="white"
              icon={column.icon}
              align="left"
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
        {/* Selected item doubles as the disclosure trigger (#100) — Tag has
            no interactive semantics of its own, so this plain <button>
            supplies the click target; Dropdown clones aria-expanded/
            aria-controls/onClick onto it and renders its own trailing
            chevron alongside it (#112), rather than wrapping it in a second
            <button>. */}
        {/* spacing-flag: rounded-lg — this wrapper is a code-only click
            target (no Figma node of its own); it hugs Tag exactly, and
            Tag's own rounded-lg is measured `radius/control` (node
            3626:4515, design/notes/Tag.md #205), but that is Tag's binding,
            not this button's — design/notes/CardDetailPanel.md #219. */}
        <button type="button" className="inline-flex w-fit items-center rounded-lg">
          <Tag variant={priority}>{tPriority(priority)}</Tag>
        </button>
        {otherPriorities.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setPriority(value)}
            // spacing-flag: rounded-lg — same wrapper pattern, see the flag
            // above — design/notes/CardDetailPanel.md#219.
            className="flex w-full rounded-lg text-left transition-colors hover:bg-surface-highlight-white-selected"
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
        {/* Same trigger pattern as Prioriteit above — see that comment. */}
        {/* spacing-flag: rounded-lg — same wrapper pattern as the Priority
            trigger above — design/notes/CardDetailPanel.md#219. */}
        <button type="button" className="inline-flex w-fit items-center rounded-lg">
          <Tag variant="neutral">{size ? size.toUpperCase() : t("fields.sizePlaceholder")}</Tag>
        </button>
        {otherSizes.map((value) => (
          <button
            key={value ?? "none"}
            type="button"
            onClick={() => setSize(value)}
            // spacing-flag: rounded-lg — same wrapper pattern, see the flag
            // above — design/notes/CardDetailPanel.md#219.
            className="flex w-full rounded-lg text-left transition-colors hover:bg-surface-highlight-white-selected"
          >
            <Tag variant="neutral">{value ? value.toUpperCase() : t("fields.sizePlaceholder")}</Tag>
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
