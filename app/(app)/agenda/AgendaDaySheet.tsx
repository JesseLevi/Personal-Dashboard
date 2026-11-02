"use client";

// design: Claude-designed (#733)
import { useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { useIsNarrow } from "@/components/organisms/AgendaCalendar";
import type { AgendaSheetStop } from "@/lib/agenda/sheet";
import { useSheetSnap } from "@/lib/dom/use-sheet-snap";
import { cn } from "@/lib/ui/cn";

export interface AgendaDaySheetProps {
  stop: AgendaSheetStop;
  onStopChange: (stop: AgendaSheetStop) => void;
  /** The week strip, in the drag zone under the grabber. */
  strip: ReactNode;
  /** The pane that holds the planner; `AgendaBody` measures its width. */
  plannerRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

// The visible height of the sheet in peek is `--agenda-peek` (set by AgendaBody); the probe turns it into px.
function peekPx(panel: HTMLElement): number {
  const probe = document.createElement("div");
  probe.style.height = "var(--agenda-peek)";
  panel.append(probe);
  const height = probe.offsetHeight;
  probe.remove();
  return height;
}

/**
 * The planner. From `lg` it is the plain pane right of the cards. Below `lg` it is a fixed sheet above the
 * tab bar that rests on two stops, only ever moved by `transform`: its height stays constant, so FullCalendar
 * never re-measures on a stop change. Its top edge follows the bottom of the sticky page header.
 */
export function AgendaDaySheet({ stop, onStopChange, strip, plannerRef, children }: AgendaDaySheetProps) {
  const t = useTranslations("agenda.sheet");
  const narrow = useIsNarrow();
  const gridId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const grabberRef = useRef<HTMLButtonElement>(null);
  const full = stop === "full";

  // The header is sticky and its bottom moves for the first pixels of scroll, so the top edge is measured, not assumed.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const header = panel?.closest("main")?.querySelector("header");
    if (!panel || !header) return;
    let last = -1;
    const update = () => {
      const bottom = Math.round(header.getBoundingClientRect().bottom);
      if (bottom === last) return;
      last = bottom;
      panel.style.setProperty("--agenda-sheet-top", `${bottom}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const snap = useSheetSnap({
    getPanel: () => panelRef.current,
    canStart: () => !!panelRef.current && window.matchMedia("(max-width: 1023.98px)").matches,
    getStop: () => stop,
    getTravel: () => {
      const panel = panelRef.current;
      return panel ? Math.max(0, panel.offsetHeight - peekPx(panel)) : 0;
    },
    // Flushed, so the class change and the end of the inline drag position land in one style recalc.
    onSettle: (next) => flushSync(() => onStopChange(next)),
  });

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
        // Below lg: fixed between the header and the tab bar (none from md, where the sidebar takes the left edge).
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
