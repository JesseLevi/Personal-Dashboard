"use client";

// design: Claude-designed (#733, #744)
import { useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { useIsNarrow } from "@/components/organisms/AgendaCalendar";
import { peekVisiblePx, type AgendaSheetStop } from "@/lib/agenda/sheet";
import { useSheetSnap } from "@/lib/dom/use-sheet-snap";
import { cn } from "@/lib/ui/cn";

export interface AgendaDaySheetProps {
  stop: AgendaSheetStop;
  onStopChange: (stop: AgendaSheetStop) => void;
  /** The week strip, in the drag zone under the grabber. */
  strip: ReactNode;
  /** The pane that holds the planner; `AgendaBody` measures its width. */
  plannerRef: RefObject<HTMLDivElement | null>;
  /** The day cards region: the sheet's top edge in full and its peek stop are measured from it. */
  cardsRef: RefObject<HTMLElement | null>;
  /** The element that carries `--agenda-peek`, shared with the cards region's bottom space. */
  scopeRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const NARROW = "(max-width: 1023.98px)";

// A custom property that holds a length, read as px.
function cssPx(panel: HTMLElement, property: string): number {
  const probe = document.createElement("div");
  probe.style.height = `var(${property})`;
  panel.append(probe);
  const height = probe.offsetHeight;
  probe.remove();
  return height;
}

/**
 * The planner. From `lg` it is the plain pane right of the cards. Below `lg` it is a fixed sheet above the
 * tab bar that rests on two stops, only ever moved by `transform`: its height stays constant, so FullCalendar
 * never re-measures on a stop change. In full its top edge is the top of the first card; in peek it sits
 * 64px under the last card, and never shows less than `--agenda-peek-min`.
 */
export function AgendaDaySheet({ stop, onStopChange, strip, plannerRef, cardsRef, scopeRef, children }: AgendaDaySheetProps) {
  const t = useTranslations("agenda.sheet");
  const narrow = useIsNarrow();
  const gridId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const grabberRef = useRef<HTMLButtonElement>(null);
  const measureRef = useRef<() => void>(() => {});
  const full = stop === "full";

  const snap = useSheetSnap({
    getPanel: () => panelRef.current,
    canStart: () => !!panelRef.current && window.matchMedia(NARROW).matches,
    getStop: () => stop,
    getTravel: () => {
      const panel = panelRef.current;
      return panel ? Math.max(0, panel.offsetHeight - cssPx(panel, "--agenda-peek")) : 0;
    },
    // Flushed, so the class change and the end of the inline drag position land in one style recalc.
    onSettle: (next) => {
      flushSync(() => onStopChange(next));
      requestAnimationFrame(() => measureRef.current());
    },
  });

  // The top edge in full is where the cards region starts at scroll 0; the visible height in peek follows the
  // bottom of its last card. Both come from layout, never from the transform, and not while dragging.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const cards = cardsRef.current;
    if (!panel || !cards) return;
    const query = window.matchMedia(NARROW);
    let first = true;
    const measure = () => {
      // The scope is an ancestor: its ref is set after this effect's first run, so it is read per measurement.
      const scope = scopeRef.current;
      if (!scope || snap.isDragging()) return;
      if (!query.matches) {
        panel.style.removeProperty("--agenda-sheet-top");
        scope.style.removeProperty("--agenda-peek");
        return;
      }
      const rect = cards.getBoundingClientRect();
      const top = Math.round(rect.top + window.scrollY);
      panel.style.setProperty("--agenda-sheet-top", `${top}px`);
      const visible = peekVisiblePx({
        heightPx: panel.offsetHeight,
        contentBottomPx: rect.bottom + window.scrollY - parseFloat(getComputedStyle(cards).paddingBottom) - top,
        minPx: cssPx(panel, "--agenda-peek-min"),
      });
      if (first) {
        // The first measurement is the start position, not a move.
        first = false;
        panel.style.transitionDuration = "0s";
        requestAnimationFrame(() => panel.style.removeProperty("transition-duration"));
      }
      scope.style.setProperty("--agenda-peek", `${Math.round(visible)}px`);
    };
    measureRef.current = measure;
    // Observing delivers a first measurement before the first paint.
    const observer = new ResizeObserver(measure);
    observer.observe(cards);
    const main = panel.closest("main");
    if (main) observer.observe(main);
    window.addEventListener("resize", measure);
    query.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      query.removeEventListener("change", measure);
    };
  }, [cardsRef, scopeRef, snap]);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !full || !narrow || event.defaultPrevented) return;
    event.stopPropagation();
    onStopChange("peek");
    grabberRef.current?.focus();
  }

  return (
    <section
      ref={panelRef}
      aria-label={t("label")}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex min-w-0 flex-col lg:h-[calc(100dvh-14rem)] lg:min-h-[28rem]",
        // Below lg: fixed between the first card and the tab bar (none from md, where the sidebar takes the left edge).
        // spacing-flag: top/bottom/left offsets and the 5.5rem fallback -- design/notes/AgendaPage.md
        "max-lg:fixed max-lg:top-[var(--agenda-sheet-top,calc(env(safe-area-inset-top)+5.5rem))] max-lg:right-0 max-lg:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-lg:left-0 max-lg:z-20 md:max-lg:bottom-0 md:max-lg:left-[var(--shell-sidebar,198px)]",
        // Same look as SidePanel's mobile sheet. spacing-flag: `rounded-tl-2xl` (#205), design/notes/AgendaPage.md
        "max-lg:overflow-hidden max-lg:rounded-tl-2xl max-lg:rounded-tr-control-outer max-lg:border-t max-lg:border-stroke-primary max-lg:bg-surface-highlight-white",
        "max-lg:transition-transform max-lg:duration-[var(--duration-base)] max-lg:ease-[var(--sheet-ease)] motion-reduce:transition-none",
        full ? "max-lg:[transform:translateY(0)]" : "max-lg:[transform:translateY(calc(100%_-_var(--agenda-peek)))]",
      )}
    >
      <div
        className="shrink-0 lg:hidden"
        onPointerDown={snap.onPointerDown}
        onPointerMove={snap.onPointerMove}
        onPointerUp={snap.onPointerUp}
        onPointerCancel={snap.onPointerCancel}
      >
        <button
          ref={grabberRef}
          type="button"
          aria-expanded={full}
          aria-controls={gridId}
          aria-label={full ? t("collapse") : t("expand")}
          onClick={() => {
            if (!snap.consumeClick()) onStopChange(full ? "peek" : "full");
          }}
          className="flex h-8 w-full touch-none items-center justify-center outline-none focus-visible:bg-surface-secondary-hover"
        >
          <span aria-hidden="true" className="h-1 w-12 rounded-full bg-stroke-primary" />
        </button>
        <div className="touch-pan-x pb-component-xs">{strip}</div>
      </div>
      <div
        id={gridId}
        ref={plannerRef}
        // Flush with the sheet below `lg`: the calendar's own frame (rounded, bordered) would be a card in a card.
        className="relative min-h-0 flex-1 max-lg:border-t max-lg:border-stroke-lines max-lg:[&_.rounded-card]:rounded-none max-lg:[&_.rounded-card]:border-0"
      >
        <div inert={narrow && !full} className="h-full">
          {children}
        </div>
        {!full && (
          // Taps on the sliver of the grid open the sheet; the grabber is the accessible control.
          <button type="button" aria-hidden="true" tabIndex={-1} onClick={() => onStopChange("full")} className="absolute inset-0 lg:hidden" />
        )}
      </div>
      {!full && (
        // The fade ends where the sheet's peek ends. spacing-flag: offsets from `--agenda-peek` -- design/notes/AgendaPage.md
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[calc(var(--agenda-peek)_-_3rem)] h-12 bg-gradient-to-b from-transparent to-surface-highlight-white lg:hidden"
        />
      )}
    </section>
  );
}
