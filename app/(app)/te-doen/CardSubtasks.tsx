"use client";

// design: Claude-designed (#694)
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Checkbox } from "@/components/atoms/Checkbox";
import { Dropdown } from "@/components/atoms/Dropdown";
import { Icon } from "@/components/atoms/Icon";
import { InputField } from "@/components/atoms/InputField";
import { useOutsidePress } from "@/lib/dom/use-outside-press";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";
import { MAX_SUBTASKS_PER_CARD } from "@/lib/boards/schemas";
import { SUBTASK_TITLE_MAX, splitPastedTitles, splitSubtasks, titlesThatFit } from "@/lib/boards/subtasks";
import type { ActionResult, SubtaskRow } from "@/lib/boards/types";
import { cn } from "@/lib/ui/cn";

// Subtasks section of the card panel (ADR-0053); contract: design/notes/CardDetailPanel.md.
// Saved subtasks write immediately through the actions; in create mode (`cardId` null) the
// titles are buffered in `draft` and CardDetailPanel writes them once the card exists.

export interface SubtaskActions {
  onListSubtasks: (input: unknown) => Promise<ActionResult<SubtaskRow[]>>;
  onAddSubtasks: (input: unknown) => Promise<ActionResult<SubtaskRow[]>>;
  onRenameSubtask: (input: unknown) => Promise<ActionResult>;
  onSetSubtaskDone: (input: unknown) => Promise<ActionResult>;
  onDeleteSubtask: (input: unknown) => Promise<ActionResult>;
  onPromoteSubtask: (input: unknown) => Promise<ActionResult<{ cardId: string }>>;
}

export interface CardSubtasksProps extends SubtaskActions {
  /** The saved card; null in create mode. */
  cardId: string | null;
  open: boolean;
  draft: string[];
  onDraftChange: (titles: string[]) => void;
  /** "Alles af" offer: set when a done column exists and the card is not in one. */
  moveOffer: { columnName: string; onMove: () => Promise<void> } | null;
  /** After every write that changes the card's progress or the board, so the board refreshes. */
  onMutated?: () => void;
  /** The panel's error line; null clears it. */
  onError: (message: string | null) => void;
}

interface Item {
  id: string;
  title: string;
  done: boolean;
  position: number;
}

export function CardSubtasks({
  cardId,
  open,
  draft,
  onDraftChange,
  moveOffer,
  onMutated,
  onError,
  onListSubtasks,
  onAddSubtasks,
  onRenameSubtask,
  onSetSubtaskDone,
  onDeleteSubtask,
  onPromoteSubtask,
}: CardSubtasksProps) {
  const t = useTranslations("components.cardDetailPanel.subtasks");
  const tErrors = useTranslations("boards.errors");

  // Keyed by card so a previous card's list never shows under the next one.
  const [loaded, setLoaded] = useState<{ cardId: string; rows: SubtaskRow[] } | null>(null);
  const openCardId = open ? cardId : null;
  useEffect(() => {
    if (!openCardId) return;
    let cancelled = false;
    void onListSubtasks({ cardId: openCardId }).then((result) => {
      if (cancelled) return;
      if (result.success) setLoaded({ cardId: openCardId, rows: result.data });
      else onError(tErrors(result.error));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on open only; the callbacks are stable per render of the board
  }, [openCardId]);

  const rows = cardId && loaded?.cardId === cardId ? loaded.rows : null;
  const items: Item[] = cardId
    ? (rows ?? [])
    : draft.map((title, index) => ({ id: String(index), title, done: false, position: index }));
  const { open: openItems, done: doneItems } = splitSubtasks(items);

  const [expandedChoice, setExpandedChoice] = useState<boolean | null>(null);
  const expanded = expandedChoice ?? openItems.length === 0;
  const [newTitle, setNewTitle] = useState("");
  const [movePending, setMovePending] = useState(false);
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  function updateRows(update: (current: SubtaskRow[]) => SubtaskRow[]) {
    setLoaded((current) => (current && current.cardId === cardId ? { cardId: current.cardId, rows: update(current.rows) } : current));
  }

  // Optimistic: `apply` shows the change, `revert` undoes it when the write fails.
  async function write(apply: () => void, revert: () => void, call: () => Promise<ActionResult<unknown>>) {
    onError(null);
    apply();
    const result = await call();
    if (!result.success) {
      revert();
      onError(tErrors(result.error));
      return false;
    }
    onMutated?.();
    return true;
  }

  function addTitles(titles: string[]) {
    const fitting = titlesThatFit(titles, items.length);
    if (fitting.length === 0) return;
    setNewTitle("");
    if (!cardId) {
      onDraftChange([...draft, ...fitting]);
      return;
    }
    onError(null);
    // Chained so quick successive adds keep their order.
    writes.current = writes.current.then(async () => {
      const result = await onAddSubtasks({ cardId, titles: fitting });
      if (!result.success) {
        onError(tErrors(result.error));
        return;
      }
      updateRows((current) => [...current, ...result.data]);
      onMutated?.();
    });
  }

  function rename(item: Item, title: string) {
    const next = title.trim();
    if (next === "" || next === item.title) return;
    if (!cardId) {
      onDraftChange(draft.map((existing, index) => (String(index) === item.id ? next : existing)));
      return;
    }
    void write(
      () => updateRows((current) => current.map((row) => (row.id === item.id ? { ...row, title: next } : row))),
      () => updateRows((current) => current.map((row) => (row.id === item.id ? { ...row, title: item.title } : row))),
      () => onRenameSubtask({ id: item.id, title: next }),
    );
  }

  function setDone(item: Item, done: boolean) {
    if (!cardId) return;
    const set = (value: boolean) => updateRows((current) => current.map((row) => (row.id === item.id ? { ...row, done: value } : row)));
    void write(
      () => set(done),
      () => set(!done),
      () => onSetSubtaskDone({ id: item.id, done }),
    );
  }

  function remove(item: Item) {
    if (!cardId) {
      onDraftChange(draft.filter((_, index) => String(index) !== item.id));
      return;
    }
    void write(
      () => updateRows((current) => current.filter((row) => row.id !== item.id)),
      () => updateRows((current) => [...current, items.find((row) => row.id === item.id) as SubtaskRow]),
      () => onDeleteSubtask({ id: item.id }),
    );
  }

  async function promote(item: Item) {
    if (!cardId) return;
    onError(null);
    const result = await onPromoteSubtask({ id: item.id });
    if (!result.success) {
      onError(tErrors(result.error));
      return;
    }
    updateRows((current) => current.filter((row) => row.id !== item.id));
    onMutated?.();
  }

  async function move() {
    if (!moveOffer) return;
    setMovePending(true);
    await moveOffer.onMove();
    setMovePending(false);
  }

  const total = items.length;
  const doneCount = doneItems.length;
  const atLimit = total >= MAX_SUBTASKS_PER_CARD;
  const showOffer = Boolean(cardId) && moveOffer !== null && total > 0 && openItems.length === 0;

  function renderRow(item: Item) {
    return (
      <SubtaskRowItem
        key={item.id}
        item={item}
        buffered={!cardId}
        onToggle={(done) => setDone(item, done)}
        onRename={(title) => rename(item, title)}
        onPromote={() => void promote(item)}
        onDelete={() => remove(item)}
      />
    );
  }

  return (
    <section className="flex flex-col gap-stack-sm" aria-labelledby="card-detail-subtasks-title">
      <div className="flex items-baseline gap-inline-sm text-sm font-semibold text-text-secondary">
        <h3 id="card-detail-subtasks-title">{t("title")}</h3>
        {total > 0 && (
          <span>
            {doneCount}/{total}
          </span>
        )}
      </div>
      {openItems.length > 0 && <ul className="flex flex-col">{openItems.map(renderRow)}</ul>}
      {doneItems.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpandedChoice(!expanded)}
            className="flex h-10 items-center gap-inline-xs self-start text-sm font-semibold text-text-secondary hover:text-text-primary"
          >
            <Icon name="ChevronDown" size={16} className={cn("transition-transform", !expanded && "-rotate-90")} />
            {t("doneToggle", { count: doneItems.length })}
          </button>
          {expanded && <ul className="flex flex-col">{doneItems.map(renderRow)}</ul>}
        </>
      )}
      {showOffer && moveOffer && (
        <div className="flex items-center justify-between gap-inline-sm rounded-control border border-stroke-primary bg-surface-highlight-white p-component-sm">
          <p className="text-sm font-semibold text-text-primary">{t("allDone", { column: moveOffer.columnName })}</p>
          <Button variant="outline" size="small" disabled={movePending} onClick={() => void move()}>
            {t("moveLabel")}
          </Button>
        </div>
      )}
      <InputField
        aria-label={t("addLabel")}
        placeholder={t("addLabel")}
        value={newTitle}
        maxLength={SUBTASK_TITLE_MAX}
        disabled={atLimit}
        onChange={(event) => setNewTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          addTitles(splitPastedTitles(newTitle));
        }}
        onPaste={(event) => {
          const text = event.clipboardData.getData("text");
          if (!/\r?\n/.test(text.trim())) return;
          event.preventDefault();
          addTitles(splitPastedTitles(text));
        }}
      />
      {atLimit && <p className="text-sm text-text-secondary">{t("limitHint", { max: MAX_SUBTASKS_PER_CARD })}</p>}
    </section>
  );
}

interface SubtaskRowItemProps {
  item: Item;
  /** Create mode: not saved yet, so it cannot be checked or promoted. */
  buffered: boolean;
  onToggle: (done: boolean) => void;
  onRename: (title: string) => void;
  onPromote: () => void;
  onDelete: () => void;
}

function SubtaskRowItem({ item, buffered, onToggle, onRename, onPromote, onDelete }: SubtaskRowItemProps) {
  const t = useTranslations("components.cardDetailPanel.subtasks");
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);
  const titleId = `subtask-${item.id}-title`;

  function finish(value: string) {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    onRename(value);
  }

  return (
    <li className="flex min-h-10 items-center gap-inline-xs">
      {/* The ::after widens the 32 px box to a 40 px tap target. */}
      <Checkbox
        checked={item.done}
        disabled={buffered}
        aria-labelledby={editing ? undefined : titleId}
        aria-label={editing ? item.title : undefined}
        onClick={() => onToggle(!item.done)}
        className="relative after:absolute after:-inset-1 after:content-['']"
      />
      {editing ? (
        <InputField
          className="min-w-0 flex-1"
          aria-label={t("editLabel")}
          defaultValue={item.title}
          maxLength={SUBTASK_TITLE_MAX}
          autoFocus
          onBlur={(event) => finish(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              // Escape cancels the edit, not the panel.
              event.stopPropagation();
              cancelled.current = true;
              event.currentTarget.blur();
            }
          }}
        />
      ) : (
        <button
          type="button"
          id={titleId}
          onClick={() => setEditing(true)}
          className={cn(
            "min-h-10 min-w-0 flex-1 break-words text-left text-base font-semibold",
            item.done ? "text-text-secondary line-through" : "text-text-primary",
          )}
        >
          {item.title}
        </button>
      )}
      <SubtaskMenu title={item.title} canPromote={!buffered} onPromote={onPromote} onDelete={onDelete} />
    </li>
  );
}

function visibleItems(root: HTMLElement | null): HTMLElement[] {
  return Array.from(root?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
}

// The row's "⋯" menu, built like AgendaMoreMenu but placed inside the panel's own scroll area.
function SubtaskMenu({ title, canPromote, onPromote, onDelete }: { title: string; canPromote: boolean; onPromote: () => void; onDelete: () => void }) {
  const t = useTranslations("components.cardDetailPanel.subtasks");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popover = usePopoverPosition(wrapperRef, popoverRef, { open, anchor: "right", prefer: "below" });
  const placed = popover.style.visibility !== "hidden";

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) wrapperRef.current?.querySelector("button")?.focus();
  }

  useOutsidePress([wrapperRef, popoverRef], () => {
    if (open) close(false);
  });

  useEffect(() => {
    if (open && placed) visibleItems(popoverRef.current)[0]?.focus();
  }, [open, placed]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const menuItems = visibleItems(event.currentTarget);
    const index = menuItems.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? (index + 1) % menuItems.length : (index - 1 + menuItems.length) % menuItems.length;
    event.preventDefault();
    menuItems[next]?.focus();
  }

  function choose(action: () => void) {
    close();
    action();
  }

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <Button
        variant="transparent"
        icon="EllipsisVertical"
        aria-label={t("moreLabel", { title })}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      />
      {open && (
        <div ref={popoverRef} className="absolute z-[999] w-64" style={popover.style} onKeyDown={handleKeyDown}>
          <Dropdown className="shadow-sm" role="menu" aria-label={t("moreLabel", { title })}>
            {canPromote && (
              <Button role="menuitem" variant="white" align="left" icon="ArrowRight" onClick={() => choose(onPromote)}>
                {t("promoteLabel")}
              </Button>
            )}
            <Button role="menuitem" variant="white" align="left" icon="Trash" onClick={() => choose(onDelete)}>
              {t("deleteLabel")}
            </Button>
          </Dropdown>
        </div>
      )}
    </span>
  );
}
