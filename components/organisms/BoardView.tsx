"use client";

// figma: node-id=3680:1442 (+3680:1435 mobile, 3878:10175 empty; drag
// annotations on I3881:13243/3882:14844/3882:14424/3882:14855)
import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable, isSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { CollisionPriority } from "@dnd-kit/abstract";
import { PointerSensor, PointerActivationConstraints } from "@dnd-kit/dom";
import { Carousel } from "./Carousel";
import { CardContainer } from "./CardContainer";
import { Card } from "../molecules/Card";
import { Button } from "../atoms/Button";
import type { IconName } from "../atoms/Icon";

/**
 * Organism/BoardView — generic Kanban board: `Carousel` of `CardContainer`
 * columns, each holding sortable `Card`s. Composes existing organisms/
 * molecules (`Carousel` -> `CardContainer` -> `Card` -> caller's
 * `renderItem`) rather than a new Figma node; drag mechanics come from
 * `@dnd-kit/react` + `@dnd-kit/helpers` per #90. No Te-Doen/Recipe fields
 * live here — `renderItem` owns all leaf content. Persists nothing; `onMove`
 * only reports the result. Full rationale, measurements, gaps:
 * design/notes/BoardView.md.
 */
export interface BoardColumn<TItem> {
  /** Stable column id — also the `group` dnd-kit sorts items within. */
  id: string;
  /** Figma `Name` prop, forwarded to `CardContainer`. */
  name: string;
  /** Figma column icon (page-instance override, see design/notes/CardContainer.md), forwarded to `CardContainer`. */
  icon: IconName;
  items: TItem[];
}

export interface BoardViewProps<TItem extends { id: string }> {
  columns: BoardColumn<TItem>[];
  /** Renders one item's content — typically a `Card-content/*` molecule (e.g. `CardContentTicket`). BoardView wraps the result in `Card`; keep column-specific fields (priority, due date, ...) out of this component and in the caller's own renderItem. */
  renderItem: (item: TItem) => ReactNode;
  /** Fired once a drag completes with a real change. Reporting only — this component writes nothing back itself (a separate ticket persists the move). */
  onMove?: (move: { itemId: string; toColumnId: string; toIndex: number }) => void;
  /** Fired on a genuine click (no drag) on an item's card — see the sensor tuning below for how the two are told apart. */
  onItemClick?: (item: TItem) => void;
  /** Forwarded to every column's `CardContainer.addLabel`. */
  addLabel: string;
  /** Forwarded to every column's `CardContainer.editLabel`. */
  editLabel: string;
  /** Label for the empty-column "add" button (composer-supplied, reuses the same string as `addLabel`'s sibling — see `CardContainer`'s `emptyState`). */
  emptyLabel: string;
  /** Fired with a column id from that column's add button (header, or its empty-state button). */
  onAddItem?: (columnId: string) => void;
  onEditColumn?: (columnId: string) => void;
  /** #95: disables both dragging and dropping everywhere (still renders the same DOM/DragDropProvider — only `useSortable`/`useDroppable`'s own `disabled` flips). Set by a caller whose current view is sorted rather than manual/position order, where a drop's resulting index would be meaningless against the stored `position`. See design/notes/TeDoenBoard.md for the full reasoning. */
  dragDisabled?: boolean;
  className?: string;
}

// Board columns measure 296px (mobile) / 320px (desktop) in the fetched
// nodes — a different fixed width than Carousel's own Recipe-sourced 280px
// default, hence the explicit override. See design/notes/Carousel.md.
const BOARD_COLUMN_WIDTH = "w-74 md:w-80";

// #115: dnd-kit calls this fresh on every pointerdown with the real event,
// so branching on `event.pointerType` — not a device-wide `matchMedia` read
// once at mount — gets hybrid devices (touch laptop, iPad + mouse) right
// per interaction. `touch` gets the long-press (#118: 750ms, a user decision
// after real-device testing, deviating from Figma node 3680:1442's 2s
// annotation — see design/notes/BoardView.md); mouse/pen
// get the #94 fine-pointer delay+distance. Exported for
// tests/board-view-sensors.test.ts.
//
// #116: touch `tolerance` must stay a number — `DelayConstraint` calls
// `exceedsDistance` unguarded, so `undefined` throws on the first
// pointermove. 16, not the old 5, kept as-is by #118's shorter window —
// deliberately more generous than strictly needed. Full reasoning:
// design/notes/BoardView.md.
export function boardCardActivationConstraints(event: PointerEvent) {
  return event.pointerType === "touch"
    ? [new PointerActivationConstraints.Delay({ value: 750, tolerance: 16 })]
    : [
        new PointerActivationConstraints.Delay({ value: 200, tolerance: 10 }),
        new PointerActivationConstraints.Distance({ value: 5 }),
      ];
}

function toItemsByColumn<TItem>(
  columns: BoardColumn<TItem>[],
): Record<string, TItem[]> {
  return Object.fromEntries(columns.map((c) => [c.id, c.items]));
}

// Whole card is the drag surface — Figma draws no separate handle
// (Dev Mode annotation: "Dragging with mouse" on the card itself, not a
// child). 40% opacity while dragging is the same annotation's spec. The same
// element also carries `onClick`: dnd-kit's PointerSensor already suppresses
// the trailing `click` once a drag activates, so no manual isDragging/onClick
// coordination is needed — see design/notes/BoardView.md for how that was
// verified and why the sensor tuning below is what actually matters here.
function SortableCard({
  id,
  index,
  columnId,
  disabled,
  onClick,
  children,
}: {
  id: string;
  index: number;
  columnId: string;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const { ref, isDragging } = useSortable({
    id,
    index,
    group: columnId,
    type: "item",
    accept: "item",
    disabled,
  });

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={clsx(
        "transition-opacity duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
        // #116: coarse pointers only, `touch-manipulation` not `touch-none`
        // — panning must work again (a scrolled column was the #115
        // regression), and `touch-manipulation` still permits pinch-zoom
        // (pan-x pan-y would not), only dropping the double-tap-zoom delay.
        // With panning restored, the browser owns the scroll-vs-hold call:
        // its own slop lets a still finger through and turns a real swipe
        // into a `pointercancel`, which dnd-kit's `handleCancel` already
        // aborts cleanly. `select-none`/`touch-callout-none` (iOS long-press
        // callout) are unchanged from #115. Fine pointers (mouse) untouched.
        // Reasoning: design/notes/BoardView.md.
        "[@media(any-pointer:coarse)]:touch-manipulation [@media(any-pointer:coarse)]:select-none touch-callout-none",
        disabled ? "cursor-default" : "cursor-grab",
        isDragging && "opacity-40",
      )}
    >
      <Card>{children}</Card>
    </div>
  );
}

// `useDroppable` (not just `useSortable` on the cards) so an empty column,
// or the empty space below the last card, is still a valid drop target.
// `CollisionPriority.Low` lets individual card collisions win over the
// column's own — dnd-kit's own guidance for this exact multi-column shape.
function BoardColumnView<TItem extends { id: string }>({
  column,
  items,
  renderItem,
  addLabel,
  editLabel,
  emptyLabel,
  dragDisabled,
  onAddItem,
  onEditColumn,
  onItemClick,
}: {
  column: BoardColumn<TItem>;
  items: TItem[];
  renderItem: (item: TItem) => ReactNode;
  addLabel: string;
  editLabel: string;
  emptyLabel: string;
  dragDisabled?: boolean;
  onAddItem?: (columnId: string) => void;
  onEditColumn?: (columnId: string) => void;
  onItemClick?: (item: TItem) => void;
}) {
  const { ref: dropRef } = useDroppable({
    id: column.id,
    accept: "item",
    collisionPriority: CollisionPriority.Low,
    disabled: dragDisabled,
  });
  const isEmpty = items.length === 0;
  const handleAdd = onAddItem ? () => onAddItem(column.id) : undefined;

  return (
    <CardContainer
      name={column.name}
      count={String(items.length)}
      icon={column.icon}
      addLabel={addLabel}
      editLabel={editLabel}
      onAdd={handleAdd}
      onEdit={onEditColumn ? () => onEditColumn(column.id) : undefined}
      emptyState={
        isEmpty ? (
          // `flex-1` fills the whole (otherwise near-empty) column body, not
          // just the button's own footprint — a bigger droppable hit-region
          // than the visible control, matching the ticket's Jira/Trello
          // callout, with no visual change (still centered by CardContainer's
          // own `items-center`).
          <div ref={dropRef} className="flex w-full flex-1 items-center justify-center">
            <Button variant="white" icon="Plus" onClick={handleAdd}>
              {emptyLabel}
            </Button>
          </div>
        ) : undefined
      }
    >
      {!isEmpty && (
        // Owns its own `gap-2` — CardContainer's Content slot only spaces
        // *this* wrapper from siblings (there are none), not the cards
        // inside it, since drag needs a real (non-`display:contents`) box
        // here for `useDroppable`'s bounding-rect hit-test to work at all.
        <div ref={dropRef} className="flex w-full flex-col gap-2">
          {items.map((item, index) => (
            <SortableCard
              key={item.id}
              id={item.id}
              index={index}
              columnId={column.id}
              disabled={dragDisabled}
              onClick={onItemClick ? () => onItemClick(item) : undefined}
            >
              {renderItem(item)}
            </SortableCard>
          ))}
        </div>
      )}
    </CardContainer>
  );
}

export function BoardView<TItem extends { id: string }>({
  columns,
  renderItem,
  onMove,
  addLabel,
  editLabel,
  emptyLabel,
  dragDisabled,
  onAddItem,
  onEditColumn,
  onItemClick,
  className,
}: BoardViewProps<TItem>) {
  const [itemsByColumn, setItemsByColumn] = useState(() =>
    toItemsByColumn(columns),
  );
  // Never persisted here (#90) — `columns` stays the composer's own source
  // of truth. Re-synced whenever it changes, except mid-drag (would yank
  // the card from under the pointer); a canceled drag reverts to `snapshot`.
  const dragging = useRef(false);
  const snapshot = useRef(itemsByColumn);

  useEffect(() => {
    if (!dragging.current) setItemsByColumn(toItemsByColumn(columns));
  }, [columns]);

  return (
    <DragDropProvider
      // Mobile long-press (750ms, #118) vs. desktop click-through — see
      // boardCardActivationConstraints above for the per-interaction branch.
      sensors={(defaults) =>
        defaults.map((sensor) =>
          sensor === PointerSensor
            ? PointerSensor.configure({
                activationConstraints: boardCardActivationConstraints,
              })
            : sensor,
        )
      }
      onDragStart={() => {
        dragging.current = true;
        snapshot.current = itemsByColumn;
      }}
      onDragOver={(event) => {
        setItemsByColumn((current) => move(current, event));
      }}
      onDragEnd={(event) => {
        dragging.current = false;
        if (event.canceled) {
          setItemsByColumn(snapshot.current);
          return;
        }
        const { source } = event.operation;
        if (isSortable(source) && source.group != null) {
          onMove?.({
            itemId: String(source.id),
            toColumnId: String(source.group),
            toIndex: source.index,
          });
        }
      }}
    >
      <Carousel columnWidthClassName={BOARD_COLUMN_WIDTH} className={className}>
        {columns.map((column) => (
          <BoardColumnView
            key={column.id}
            column={column}
            items={itemsByColumn[column.id] ?? []}
            renderItem={renderItem}
            addLabel={addLabel}
            editLabel={editLabel}
            emptyLabel={emptyLabel}
            dragDisabled={dragDisabled}
            onAddItem={onAddItem}
            onEditColumn={onEditColumn}
            onItemClick={onItemClick}
          />
        ))}
      </Carousel>
    </DragDropProvider>
  );
}
