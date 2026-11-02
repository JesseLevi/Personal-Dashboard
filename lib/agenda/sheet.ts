import { DRAG_CLOSE_VELOCITY_PX_MS } from "@/lib/dom/use-sheet-drag";

/** The two stops of the Agenda's pull-up sheet below `lg` (#733): a strip at the bottom, or up to the header. */
export type AgendaSheetStop = "peek" | "full";

// A flick needs this much travel before its speed counts, like the day swipe's `SWIPE_FLICK_MIN_PX`.
export const SHEET_FLICK_MIN_PX = 20;

export interface SettleInput {
  /** The stop the drag started from. */
  from: AgendaSheetStop;
  /** Finger travel since the start, positive downward. */
  offsetPx: number;
  /** Distance between the two stops. */
  travelPx: number;
  /** Speed at release, positive downward. */
  velocityPxMs: number;
}

/**
 * The stop a released drag lands on. A flick (at least `DRAG_CLOSE_VELOCITY_PX_MS` and `SHEET_FLICK_MIN_PX`
 * of travel) goes the way the finger was moving, unless it runs against the pull: then the sheet returns to
 * where it started. A slow release takes the nearest stop.
 */
export function settleAgendaSheet({ from, offsetPx, travelPx, velocityPxMs }: SettleInput): AgendaSheetStop {
  if (Math.abs(velocityPxMs) >= DRAG_CLOSE_VELOCITY_PX_MS && Math.abs(offsetPx) >= SHEET_FLICK_MIN_PX) {
    if (Math.sign(velocityPxMs) !== Math.sign(offsetPx)) return from;
    return velocityPxMs > 0 ? "peek" : "full";
  }
  const start = from === "full" ? 0 : travelPx;
  const position = Math.min(travelPx, Math.max(0, start + offsetPx));
  return position > travelPx / 2 ? "peek" : "full";
}

/** Distance in px between the last card and the sheet's top edge in peek. */
export const SHEET_PEEK_GAP_PX = 64;

export interface PeekInput {
  /** The sheet's constant height (its top edge in full to the tab bar). */
  heightPx: number;
  /** The bottom of the last card (or of the empty-day line), measured from the sheet's top edge in full. */
  contentBottomPx: number;
  /** The least the sheet shows: grabber, strip and a sliver of the grid. */
  minPx: number;
}

/**
 * The visible height of the sheet in peek: its top edge rests `SHEET_PEEK_GAP_PX` under the cards, but it never
 * shows less than `minPx` (the cards then scroll) and never more than its own height.
 */
export function peekVisiblePx({ heightPx, contentBottomPx, minPx }: PeekInput): number {
  const wanted = heightPx - (contentBottomPx + SHEET_PEEK_GAP_PX);
  return Math.min(heightPx, Math.max(minPx, wanted));
}
