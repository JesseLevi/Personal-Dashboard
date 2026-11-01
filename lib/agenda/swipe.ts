// Day swipe tuning (#666): DISTANCE needs a deliberate stroke; RATIO keeps a slanted vertical scroll from
// counting; MAX_MS stays near the long-press drag (`AGENDA_LONG_PRESS_MS`, 350ms) so a slow drag never
// counts; EDGE leaves the screen edges to the browser's own back/forward gesture.
export const SWIPE_DISTANCE_PX = 50;
export const SWIPE_RATIO = 2;
export const SWIPE_MAX_MS = 600;
export const SWIPE_EDGE_PX = 24;

// A day-view slot spans the full width, so a swipe ends in the slot it started in and FullCalendar still
// fires `dateClick`; a press only counts as a tap when the pointer stayed within this many pixels.
export const TAP_SLOP_PX = 10;

export function isTap(start: { x: number; y: number }, end: { x: number; y: number }): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) <= TAP_SLOP_PX;
}

export interface SwipePoint {
  x: number;
  y: number;
  time: number;
}

/**
 * The day a horizontal swipe moves to: `1` (next, finger to the left), `-1` (previous) or `null`
 * when the stroke is too short, too slow, mostly vertical, or started on a screen edge.
 */
export function swipeStep(start: SwipePoint, end: SwipePoint, viewportWidth: number): 1 | -1 | null {
  if (start.x < SWIPE_EDGE_PX || start.x > viewportWidth - SWIPE_EDGE_PX) return null;
  if (end.time - start.time > SWIPE_MAX_MS) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < SWIPE_DISTANCE_PX || Math.abs(dx) < SWIPE_RATIO * Math.abs(dy)) return null;
  return dx < 0 ? 1 : -1;
}
