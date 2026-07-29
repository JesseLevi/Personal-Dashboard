"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useDragDropMonitor } from "@dnd-kit/react";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/react";
import { BoardView, type BoardColumn } from "@/components/organisms/BoardView";
import { CardContentTicket } from "@/components/molecules/CardContentTicket";
import { Tag } from "@/components/atoms/Tag";
import { Button } from "@/components/atoms/Button";

// TEMPORARY — #117. See app/debug/drag/layout.tsx for what this route is and
// when to delete it. Every Dutch string below (card titles, UI labels, the
// instruction line) is a deliberate, scoped exception to CLAUDE.md's
// no-hardcoded-strings rule: this route is not reachable from the real app,
// carries no next-intl catalog entries, and is meant to be deleted whole —
// wiring it through messages/nl.json + en.json would just be more to delete.

type Level = "info" | "warn" | "danger" | "marker";

interface LogEntry {
  id: number;
  /** ms since the most recent pointerdown, or null before the first one. */
  t: number | null;
  text: string;
  level: Level;
}

const MAX_ENTRIES = 400;

const LEVEL_CLASS: Record<Level, string> = {
  info: "text-text",
  warn: "font-semibold text-tag-highlight",
  danger: "font-bold text-priority-urgent",
  marker: "font-semibold text-priority-low",
};

function formatT(t: number | null): string {
  if (t == null) return "[+—ms]";
  return `[+${Math.round(t)}ms]`;
}

// Own event log, independent of React state churn elsewhere: `log`/
// `updateEntry` are stable (empty deps, functional setState) so passing them
// to a memoized board never re-renders it just because the log grew.
function useEventLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const nextId = useRef(0);
  const originRef = useRef<number | null>(null);

  const resetOrigin = useCallback(() => {
    originRef.current = performance.now();
  }, []);

  const getElapsed = useCallback(() => {
    return originRef.current == null ? null : performance.now() - originRef.current;
  }, []);

  const log = useCallback((text: string, level: Level = "info") => {
    const id = nextId.current++;
    const t = originRef.current == null ? null : performance.now() - originRef.current;
    setEntries((prev) => {
      const next = [{ id, t, text, level }, ...prev];
      return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
    });
    return id;
  }, []);

  const updateEntry = useCallback((id: number, text: string) => {
    const t = originRef.current == null ? null : performance.now() - originRef.current;
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, text, t } : e)));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, log, updateEntry, clear, resetOrigin, getElapsed };
}

// Attaches every listener the ticket asks for in the capture phase, all
// passive, and never calls preventDefault — an instrument that changes the
// gesture it's measuring would be worthless. Registered on `window` (not a
// ref on the card) so it also sees Safari retargeting events onto `body` via
// setPointerCapture once dnd-kit's own handlers run, since `window` is an
// ancestor of `body` regardless of retargeting.
function useRawEventListeners({
  log,
  updateEntry,
  resetOrigin,
  getElapsed,
  onCancel,
}: {
  log: (text: string, level?: Level) => number;
  updateEntry: (id: number, text: string) => void;
  resetOrigin: () => void;
  getElapsed: () => number | null;
  onCancel: (elapsedMs: number | null) => void;
}) {
  useEffect(() => {
    let originX = 0;
    let originY = 0;
    let pointerMoveCount = 0;
    let pointerMaxDrift = 0;
    let pointerMoveEntryId: number | null = null;
    let touchMoveCount = 0;
    let touchMoveEntryId: number | null = null;
    let flushTimer: ReturnType<typeof setInterval> | null = null;
    let markerTimer: ReturnType<typeof setTimeout> | null = null;

    function flush() {
      if (pointerMoveEntryId != null) {
        updateEntry(
          pointerMoveEntryId,
          `pointermove — count=${pointerMoveCount} maxDrift=${pointerMaxDrift.toFixed(1)}px`,
        );
      }
      if (touchMoveEntryId != null) {
        updateEntry(touchMoveEntryId, `touchmove — count=${touchMoveCount}`);
      }
    }

    function stopFlushTimer() {
      if (flushTimer != null) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
    }

    function onPointerDown(e: PointerEvent) {
      resetOrigin();
      originX = e.clientX;
      originY = e.clientY;
      pointerMoveCount = 0;
      pointerMaxDrift = 0;
      touchMoveCount = 0;
      log(
        `pointerdown — pointerType=${e.pointerType} isPrimary=${e.isPrimary} button=${e.button}`,
        "info",
      );
      pointerMoveEntryId = log("pointermove — count=0 maxDrift=0.0px", "info");
      touchMoveEntryId = log("touchmove — count=0", "info");
      stopFlushTimer();
      flushTimer = setInterval(flush, 120);
      if (markerTimer != null) clearTimeout(markerTimer);
      markerTimer = setTimeout(() => {
        log("*** 2000ms-markering — hold had hier moeten activeren ***", "marker");
      }, 2000);
    }

    function onPointerMove(e: PointerEvent) {
      if (pointerMoveEntryId == null) return;
      pointerMoveCount++;
      const drift = Math.hypot(e.clientX - originX, e.clientY - originY);
      if (drift > pointerMaxDrift) pointerMaxDrift = drift;
    }

    function onPointerUp(e: PointerEvent) {
      flush();
      stopFlushTimer();
      log(`pointerup — pointerType=${e.pointerType}`, "info");
    }

    function onPointerCancel(e: PointerEvent) {
      flush();
      stopFlushTimer();
      const elapsed = getElapsed();
      log(`!!! POINTERCANCEL !!! pointerType=${e.pointerType}`, "danger");
      onCancel(elapsed);
    }

    function onTouchStart(e: TouchEvent) {
      log(`touchstart — touches=${e.touches.length}`, "info");
    }

    function onTouchMoveEvt() {
      touchMoveCount++;
    }

    function onTouchCancel(e: TouchEvent) {
      log(`touchcancel — touches=${e.touches.length}`, "danger");
    }

    function onTouchEnd(e: TouchEvent) {
      log(`touchend — touches=${e.touches.length}`, "info");
    }

    function onContextMenu() {
      log("contextmenu", "warn");
    }

    function onSelectStart() {
      log("selectstart", "warn");
    }

    const opts: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener("pointerdown", onPointerDown, opts);
    window.addEventListener("pointermove", onPointerMove, opts);
    window.addEventListener("pointerup", onPointerUp, opts);
    window.addEventListener("pointercancel", onPointerCancel, opts);
    window.addEventListener("touchstart", onTouchStart, opts);
    window.addEventListener("touchmove", onTouchMoveEvt, opts);
    window.addEventListener("touchcancel", onTouchCancel, opts);
    window.addEventListener("touchend", onTouchEnd, opts);
    window.addEventListener("contextmenu", onContextMenu, opts);
    window.addEventListener("selectstart", onSelectStart, opts);

    return () => {
      stopFlushTimer();
      if (markerTimer != null) clearTimeout(markerTimer);
      window.removeEventListener("pointerdown", onPointerDown, opts);
      window.removeEventListener("pointermove", onPointerMove, opts);
      window.removeEventListener("pointerup", onPointerUp, opts);
      window.removeEventListener("pointercancel", onPointerCancel, opts);
      window.removeEventListener("touchstart", onTouchStart, opts);
      window.removeEventListener("touchmove", onTouchMoveEvt, opts);
      window.removeEventListener("touchcancel", onTouchCancel, opts);
      window.removeEventListener("touchend", onTouchEnd, opts);
      window.removeEventListener("contextmenu", onContextMenu, opts);
      window.removeEventListener("selectstart", onSelectStart, opts);
    };
  }, [log, updateEntry, resetOrigin, getElapsed, onCancel]);
}

// Reads dnd-kit's own lifecycle without touching BoardView.tsx at all:
// `useDragDropMonitor` observes every drag on the manager from any
// descendant of BoardView's own `DragDropProvider` (per @dnd-kit/react's own
// docs — "anywhere within a DragDropProvider"), so mounting it once inside
// one card's `renderItem` output is enough; it is not scoped to that card.
// Renders nothing — purely an observer, same "don't interfere" rule as the
// raw listeners above.
function DragLifecycleMonitor({ log }: { log: (text: string, level?: Level) => number }) {
  useDragDropMonitor({
    onDragStart: (event: DragStartEvent) => {
      log(`dnd-kit onDragStart — source=${String(event.operation.source?.id ?? "?")}`, "marker");
    },
    onDragOver: (event: DragOverEvent) => {
      log(`dnd-kit onDragOver — target=${String(event.operation.target?.id ?? "?")}`, "info");
    },
    onDragEnd: (event: DragEndEvent) => {
      log(`dnd-kit onDragEnd — canceled=${event.canceled}`, event.canceled ? "warn" : "marker");
    },
  });
  return null;
}

interface InventedItem {
  id: string;
  title: string;
  priority: "low" | "medium" | "urgent";
  size?: string;
}

// Invented data only (#117 requires this: no Supabase, no auth, no real
// content on an unauthenticated route) — same shape TeDoenBoard.tsx feeds
// BoardView, so the same CSS classes and useSortable/useDroppable wiring end
// up under the finger as in the real board.
const COLUMNS: BoardColumn<InventedItem>[] = [
  {
    id: "col-todo",
    name: "Te doen",
    icon: "Croissant",
    items: [
      { id: "card-1", title: "Was ophangen", priority: "medium" },
      { id: "card-2", title: "Boodschappen doen", priority: "urgent", size: "m" },
      { id: "card-3", title: "Planten water geven", priority: "low" },
    ],
  },
  {
    id: "col-done",
    name: "Klaar",
    icon: "CircleCheck",
    items: [{ id: "card-4", title: "Afwas doen", priority: "low" }],
  },
];

// Whichever card mounts the (invisible) DragLifecycleMonitor — arbitrary,
// since the monitor observes the whole board, not just this card.
const MONITOR_ANCHOR_ID = "card-1";

// Memoized on a stable `log` reference (see useEventLog) so log churn during
// a hold — pointermove throttled updates, the 2000ms marker — never
// re-renders BoardView's subtree. `COLUMNS` is a module constant for the
// same reason: a fresh array each render would retrigger BoardView's own
// `useEffect(..., [columns])` resync on every keystroke of the log.
const DiagnosticBoard = memo(function DiagnosticBoard({
  log,
}: {
  log: (text: string, level?: Level) => number;
}) {
  return (
    <BoardView
      columns={COLUMNS}
      addLabel="Toevoegen"
      editLabel="Bewerken"
      emptyLabel="Kaart toevoegen"
      onMove={(move) =>
        log(`onMove — item=${move.itemId} -> column=${move.toColumnId} index=${move.toIndex}`, "marker")
      }
      onItemClick={(item) => log(`onItemClick — "${item.title}"`, "info")}
      renderItem={(item) => (
        <>
          {item.id === MONITOR_ANCHOR_ID && <DragLifecycleMonitor log={log} />}
          <CardContentTicket title={item.title}>
            <Tag variant={item.priority}>{item.priority}</Tag>
            {item.size && <Tag variant="neutral">{item.size.toUpperCase()}</Tag>}
          </CardContentTicket>
        </>
      )}
    />
  );
});

const LogPanel = memo(function LogPanel({
  entries,
  lastCancel,
  onClear,
}: {
  entries: LogEntry[];
  lastCancel: { count: number; t: number | null } | null;
  onClear: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex h-[42vh] flex-col border-t-2 border-border bg-surface md:h-[36vh]">
      <div className="flex items-center justify-between gap-3 border-b border-border-muted px-3 py-2">
        <p className="text-sm font-semibold text-text-muted">Log ({entries.length})</p>
        <Button variant="outline" size="compact" icon="Trash" aria-label="Wis log" onClick={onClear} />
      </div>
      {/* The single most important line this tool can show — kept pinned
          above the scrolling list (not buried in it) and visually loud on
          purpose, per #117. */}
      {lastCancel && (
        <div className="border-b-2 border-priority-urgent bg-priority-urgent-bg px-3 py-2">
          <p className="text-sm font-bold text-priority-urgent">
            !!! pointercancel ×{lastCancel.count} — laatst na {formatT(lastCancel.t)} !!!
          </p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs leading-relaxed">
        {entries.length === 0 ? (
          <p className="text-text-muted">Nog geen events — raak een kaart hierboven aan.</p>
        ) : (
          entries.map((entry) => (
            <p key={entry.id} className={LEVEL_CLASS[entry.level]}>
              {formatT(entry.t)} {entry.text}
            </p>
          ))
        )}
      </div>
    </div>
  );
});

export function DragDiagnostic() {
  const { entries, log, updateEntry, clear, resetOrigin, getElapsed } = useEventLog();
  const [lastCancel, setLastCancel] = useState<{ count: number; t: number | null } | null>(null);

  const onCancel = useCallback((elapsedMs: number | null) => {
    setLastCancel((prev) => ({ count: (prev?.count ?? 0) + 1, t: elapsedMs }));
  }, []);

  useRawEventListeners({ log, updateEntry, resetOrigin, getElapsed, onCancel });

  const handleClear = useCallback(() => {
    clear();
    setLastCancel(null);
  }, [clear]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface-muted text-text">
      <div className="flex flex-col gap-4 p-4 pb-[44vh] md:pb-[38vh]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-text">Drag-diagnose (#117)</h1>
            <p className="max-w-prose text-base text-text-muted">
              Houd een kaart hieronder ~2 seconden ingedrukt en lees het log
              onderaan af. Test ook kort tikken en vegen — het log toont alle
              drie.
            </p>
          </div>
        </div>
        <DiagnosticBoard log={log} />
      </div>
      <LogPanel entries={entries} lastCancel={lastCancel} onClear={handleClear} />
    </div>
  );
}
