// Day swipe tuning (#666): DISTANCE needs a deliberate stroke; RATIO keeps a slanted vertical scroll from
// counting; MAX_MS stays near the long-press drag (`AGENDA_LONG_PRESS_MS`, 350ms) so a slow drag never
// counts; EDGE leaves the screen edges to the browser's own back/forward gesture. DISTANCE, RATIO and
// MAX_MS only judge the step-on-release fallback (`prefers-reduced-motion`).
export const SWIPE_DISTANCE_PX = 50;
export const SWIPE_RATIO = 2;
export const SWIPE_MAX_MS = 600;
export const SWIPE_EDGE_PX = 24;

// Follow-the-finger tuning (#713, codebase decision, design/notes/AgendaPage.md): LOCK is the travel that
// picks the axis; COMMIT_FRACTION of the pane width commits a slow drag; a flick commits sooner at
// FLICK_VELOCITY (the 0.5 px/ms of `lib/dom/use-sheet-drag.ts`) once it has moved FLICK_MIN_PX. Velocity
// is read over the last VELOCITY_WINDOW_MS, so a finger that paused before lifting reads as still.
export const SWIPE_LOCK_PX = 10;
export const SWIPE_COMMIT_FRACTION = 1 / 3;
export const SWIPE_FLICK_VELOCITY_PX_MS = 0.5;
export const SWIPE_FLICK_MIN_PX = 20;
export const SWIPE_VELOCITY_WINDOW_MS = 100;

export interface SwipePoint {
  x: number;
  y: number;
  time: number;
}

export interface SwipeSample {
  x: number;
  time: number;
}

/** False on the outer screen edges, which belong to the browser's back/forward gesture. */
export function swipeMayStart(x: number, viewportWidth: number): boolean {
  return x >= SWIPE_EDGE_PX && x <= viewportWidth - SWIPE_EDGE_PX;
}

/**
 * The day a horizontal swipe moves to: `1` (next, finger to the left), `-1` (previous) or `null`
 * when the stroke is too short, too slow, mostly vertical, or started on a screen edge.
 */
export function swipeStep(start: SwipePoint, end: SwipePoint, viewportWidth: number): 1 | -1 | null {
  if (!swipeMayStart(start.x, viewportWidth)) return null;
  if (end.time - start.time > SWIPE_MAX_MS) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < SWIPE_DISTANCE_PX || Math.abs(dx) < SWIPE_RATIO * Math.abs(dy)) return null;
  return dx < 0 ? 1 : -1;
}

/**
 * The axis a stroke locks to once it has travelled `SWIPE_LOCK_PX`: `x` when it is wider than tall,
 * otherwise `y`; `null` while still inside the slop. A lock is never revisited mid-gesture.
 */
export function swipeAxis(dx: number, dy: number): "x" | "y" | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_LOCK_PX) return null;
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}

/** The step a pull of `dx` reveals: finger to the left shows the next day. */
export function swipeDirection(dx: number): 1 | -1 {
  return dx < 0 ? 1 : -1;
}

/** The pane offset for a pull of `dx`: it follows the finger one-to-one, but never past the neighbour. */
export function swipeOffset(dx: number, width: number): number {
  return Math.max(-width, Math.min(width, dx));
}

/** Horizontal velocity in px/ms over the last `SWIPE_VELOCITY_WINDOW_MS` before `now`; 0 without two samples in it. */
export function swipeVelocity(samples: readonly SwipeSample[], now: number): number {
  const recent = samples.filter((sample) => now - sample.time <= SWIPE_VELOCITY_WINDOW_MS);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last || last.time <= first.time) return 0;
  return (last.x - first.x) / (last.time - first.time);
}

/**
 * Where a released pull settles: `1` or `-1` for the neighbour day, `0` for back to the current one.
 * Past a third of the width commits unless a fast flick goes back; a fast flick in the pull's own
 * direction commits sooner.
 */
export function swipeSettle(dx: number, velocity: number, width: number): 1 | -1 | 0 {
  const distance = Math.abs(dx);
  const fast = Math.abs(velocity) >= SWIPE_FLICK_VELOCITY_PX_MS;
  if (fast && Math.sign(velocity) !== Math.sign(dx)) return 0;
  if (distance >= width * SWIPE_COMMIT_FRACTION) return swipeDirection(dx);
  if (fast && distance >= SWIPE_FLICK_MIN_PX) return swipeDirection(dx);
  return 0;
}
