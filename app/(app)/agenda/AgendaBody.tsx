"use client";

// design: Claude-designed (#486, #529, #550, #713)
import { useCallback, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { useAgendaSwipe } from "./useAgendaSwipe";

export interface AgendaBodySwipe {
  /** The shown day, `YYYY-MM-DD`. */
  date: string;
  onStep: (step: 1 | -1) => void;
  /** A neighbour day is about to be drawn: load its data when it is outside the loaded window. */
  onPeek?: (step: 1 | -1) => void;
  /** The day beside the shown one, drawn while a drag is under way; the caller takes care of its data. */
  renderNeighbour: (step: 1 | -1) => ReactNode;
}

const ALIGN_FRAMES = 8;

// What scrolls inside a calendar: the time grid's scroller, found by overflow rather than by FullCalendar's classes.
function scrollers(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
    (el) => el.scrollHeight > el.clientHeight && /(auto|scroll)/.test(getComputedStyle(el).overflowY),
  );
}

// The shell gives its pages no definite height, so the calendar frame gets one
// from the viewport minus the chrome above it; the grid scrolls inside. The
// calendar fills the width. With `swipe` (below `lg`) the day follows the finger
// and the neighbour day waits beside it.
//
// The day cards (ADR-0059) take a 20rem column left of the planner once the container is
// 65rem wide: the 44rem week grid, the column and one gap. They scroll inside the body's
// height. Narrower, and below `lg`, they are a row above the planner.
export function AgendaBody({ children, swipe, cards }: { children: ReactNode; swipe?: AgendaBodySwipe; cards?: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const neighbourRef = useRef<HTMLDivElement>(null);

  // The neighbour shows the time of day the shown day is scrolled to, so the grids line up. FullCalendar
  // scrolls a freshly drawn grid to its own start time a frame or two later, hence the repeats.
  const alignFrame = useRef(0);
  const alignNeighbour = useCallback(() => {
    cancelAnimationFrame(alignFrame.current);
    let frames = 0;
    const align = () => {
      const neighbour = neighbourRef.current;
      const pane = paneRef.current;
      if (!neighbour || !pane) return;
      const shown = scrollers(pane).find((el) => !neighbour.contains(el));
      const target = scrollers(neighbour)[0];
      if (shown && target) target.scrollTop = shown.scrollTop;
      if ((frames += 1) < ALIGN_FRAMES) alignFrame.current = requestAnimationFrame(align);
    };
    align();
  }, []);

  const peek = useAgendaSwipe(viewportRef, paneRef, {
    enabled: !!swipe,
    date: swipe?.date ?? "",
    onStep: (step) => swipe?.onStep(step),
    onLock: (step) => {
      swipe?.onPeek?.(step);
      alignNeighbour();
    },
  });
  useLayoutEffect(alignNeighbour, [peek, alignNeighbour]);

  return (
    <div className="@container min-w-0 pr-page-right-equal">
      <div className={cn("flex min-w-0 flex-col gap-stack-lg", cards && "lg:@min-[65rem]:grid lg:@min-[65rem]:grid-cols-[20rem_minmax(0,1fr)] lg:@min-[65rem]:items-start")}>
        {cards && (
          <div className="min-w-0 lg:@min-[65rem]:h-[calc(100dvh-14rem)] lg:@min-[65rem]:min-h-[28rem] lg:@min-[65rem]:overflow-y-auto">{cards}</div>
        )}
        <div className="h-[calc(100dvh-20rem)] min-h-[28rem] min-w-0 lg:h-[calc(100dvh-14rem)]">
          <div ref={viewportRef} className={cn("h-full", swipe && "touch-pan-y touch-pinch-zoom overflow-x-clip")}>
            <div ref={paneRef} className="relative h-full">
              {children}
              {swipe && peek !== null && (
                <div
                  ref={neighbourRef}
                  data-agenda-peek=""
                  aria-hidden="true"
                  inert
                  className={cn("absolute top-0 h-full w-full", peek === 1 ? "left-[calc(100%+var(--spacing-inline-lg))]" : "right-[calc(100%+var(--spacing-inline-lg))]")}
                >
                  {swipe.renderNeighbour(peek)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
