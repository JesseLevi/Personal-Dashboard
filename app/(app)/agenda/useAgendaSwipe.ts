"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  swipeAxis,
  swipeDirection,
  swipeMayStart,
  swipeOffset,
  swipeSettle,
  swipeStep,
  swipeVelocity,
  type SwipeSample,
} from "@/lib/agenda/swipe";
import { AGENDA_LONG_PRESS_MS } from "@/lib/ui/agenda-calendar";
import { usePrefersReducedMotion } from "@/lib/ui/blur-fade";

// While FullCalendar drags or selects, it shows a mirror or a highlight; such a stroke is never a swipe.
const CALENDAR_GESTURE = ".fc-event-mirror, .fc-event-dragging, .fc-highlight";

/**
 * Set on the viewport from the lock until the next touchstart: the finger is still over the slot it
 * started on, so FullCalendar would read the swipe as a tap or a long-press selection (#734).
 */
export const SWIPING_ATTRIBUTE = "data-agenda-swiping";

const SNAP_TRANSITION = "transform var(--duration-base) var(--ease-base)";
/** `--duration-base` plus slack: the settle ends here when `transitionend` never comes. */
const SNAP_FALLBACK_MS = 280;
/** The new day must be on screen by now; the pane is released either way. */
const COMMIT_FALLBACK_MS = 700;
const COMMIT_MAX_FRAMES = 40;
const SAMPLES_KEPT = 12;
/** The neighbour calendar stays mounted this long after a swipe: mounting it is the costly part of a drag. */
const KEEP_NEIGHBOUR_MS = 4000;

type Step = 1 | -1;
type Mode = "idle" | "pending" | "ignored" | "dragging" | "settling" | "committing";

export interface AgendaSwipeHost {
  /** The element that moves with the finger. */
  pane(): HTMLElement | null;
  viewportWidth(): number;
  /** FullCalendar is showing a drag mirror or a selection. */
  calendarBusy(): boolean;
  /** `prefers-reduced-motion`: nothing follows the finger, the day steps on release. */
  reduced(): boolean;
  /** Space between the shown day and the neighbour, in px. */
  gap(): number;
  /** A swipe has locked (`true`) or the next touch has begun (`false`); the calendar must not select meanwhile. */
  swiping(on: boolean): void;
  /** Draws the neighbour day beside the pane (`null` drops it at once). */
  peek(step: Step | null): void;
  /** The gesture is over: the neighbour may stay a while, since the next swipe usually follows. */
  release(): void;
  /** Moves the shown date; it changes once, after the snap. */
  step(step: Step): void;
  /** True once the calendar itself shows the new date. */
  ready(): boolean;
}

export interface AgendaSwipe {
  start(touches: number, x: number, y: number, time: number): void;
  move(touches: number, x: number, y: number, time: number): void;
  end(x: number, y: number, time: number): void;
  cancel(): void;
  /** The shown date changed: release the pane once the calendar has drawn it. */
  dateChanged(): void;
  destroy(): void;
}

/**
 * The day pane follows a horizontal stroke and snaps on release (#713). Imperative writes on the pane
 * (no React state per touchmove): `transform` follows the finger with the CSS transition off. The axis
 * locks once, after `SWIPE_LOCK_PX`, and only within the long-press time: a touch that rests that long
 * belongs to FullCalendar's own long-press drag or selection. A settle to a neighbour keeps the pane at
 * the neighbour until the calendar shows the new date, then resets the transform, so nothing flashes.
 */
export function createAgendaSwipe(host: AgendaSwipeHost): AgendaSwipe {
  let mode: Mode = "idle";
  let originX = 0;
  let originY = 0;
  let originTime = 0;
  let pull = 0;
  let width = 0;
  /** Pane width plus the gap: how far the pane travels to the neighbour. */
  let travel = 0;
  let peeked: Step | null = null;
  let samples: SwipeSample[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;
  let cleanupSettle: (() => void) | undefined;

  function clearAsync() {
    clearTimeout(timer);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    cleanupSettle?.();
    cleanupSettle = undefined;
  }

  function reset() {
    clearAsync();
    const pane = host.pane();
    pane?.style.removeProperty("transition");
    pane?.style.removeProperty("transform");
    pane?.style.removeProperty("will-change");
    if (peeked !== null) host.release();
    peeked = null;
    samples = [];
    pull = 0;
    mode = "idle";
  }

  function setPeek(step: Step) {
    if (peeked === step) return;
    peeked = step;
    host.peek(step);
  }

  function settle(step: Step | 0) {
    const pane = host.pane();
    if (!pane) return reset();
    mode = "settling";
    pane.style.transition = SNAP_TRANSITION;
    pane.style.transform = `translate3d(${-step * travel}px, 0, 0)`;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearAsync();
      if (step === 0) return reset();
      mode = "committing";
      timer = setTimeout(reset, COMMIT_FALLBACK_MS);
      host.step(step);
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === pane && event.propertyName === "transform") finish();
    };
    pane.addEventListener("transitionend", onEnd);
    cleanupSettle = () => pane.removeEventListener("transitionend", onEnd);
    timer = setTimeout(finish, SNAP_FALLBACK_MS);
  }

  function drag(x: number, time: number) {
    const pane = host.pane();
    if (!pane) return;
    pull = x - originX;
    samples.push({ x, time });
    if (samples.length > SAMPLES_KEPT) samples.shift();
    pane.style.transform = `translate3d(${swipeOffset(pull, travel)}px, 0, 0)`;
    if (pull !== 0) setPeek(swipeDirection(pull));
  }

  function lock(x: number, time: number, pane: HTMLElement) {
    mode = "dragging";
    width = pane.offsetWidth;
    travel = width + host.gap();
    host.swiping(true);
    samples = [{ x: originX, time: originTime }];
    pane.style.transition = "none";
    pane.style.willChange = "transform";
    setPeek(swipeDirection(x - originX));
    drag(x, time);
  }

  return {
    start(touches, x, y, time) {
      if (mode === "settling" || mode === "committing") return;
      if (mode === "dragging") return settle(0);
      host.swiping(false);
      originX = x;
      originY = y;
      originTime = time;
      mode = touches === 1 && swipeMayStart(x, host.viewportWidth()) ? "pending" : "ignored";
    },
    move(touches, x, y, time) {
      if (mode === "dragging") {
        if (touches > 1) return settle(0);
        return drag(x, time);
      }
      if (mode !== "pending") return;
      if (touches > 1 || host.calendarBusy()) {
        mode = "ignored";
        return;
      }
      if (host.reduced()) return;
      const axis = swipeAxis(x - originX, y - originY);
      const restedLong = time - originTime >= AGENDA_LONG_PRESS_MS;
      if (axis === null) {
        if (restedLong) mode = "ignored";
        return;
      }
      const pane = host.pane();
      if (axis === "y" || restedLong || !pane) {
        mode = "ignored";
        return;
      }
      lock(x, time, pane);
    },
    end(x, y, time) {
      if (mode === "dragging") {
        samples.push({ x, time });
        return settle(swipeSettle(pull, swipeVelocity(samples, time), width));
      }
      if (mode === "pending" && host.reduced()) {
        const step = swipeStep({ x: originX, y: originY, time: originTime }, { x, y, time }, host.viewportWidth());
        if (step) {
          host.swiping(true);
          host.step(step);
        }
      }
      if (mode === "pending" || mode === "ignored") mode = "idle";
    },
    cancel() {
      if (mode === "dragging") return settle(0);
      if (mode === "pending" || mode === "ignored") mode = "idle";
    },
    dateChanged() {
      if (mode !== "committing") return;
      clearAsync();
      timer = setTimeout(reset, COMMIT_FALLBACK_MS);
      let frames = 0;
      const tick = () => {
        frames += 1;
        if (host.ready() || frames >= COMMIT_MAX_FRAMES) {
          // One more frame, so the calendar's own paint lands before the pane is released.
          frame = requestAnimationFrame(() => reset());
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    },
    destroy() {
      reset();
      host.swiping(false);
      host.peek(null);
    },
  };
}

export interface AgendaSwipeOptions {
  /** Off on layouts without the gesture (`lg` and up). */
  enabled: boolean;
  /** The shown day, `YYYY-MM-DD`; its change after a snap releases the pane. */
  date: string;
  onStep: (step: Step) => void;
  /** A drag has locked onto its axis and the neighbour is (about to be) on screen. */
  onLock?: (step: Step) => void;
}

/**
 * Binds the controller to `viewportRef` (passive touch listeners, so vertical scrolling and the
 * calendar's own long-press drag keep working) and moves `paneRef`. Returns the neighbour day to
 * draw beside the pane while a drag is under way.
 */
export function useAgendaSwipe(
  viewportRef: RefObject<HTMLElement | null>,
  paneRef: RefObject<HTMLElement | null>,
  { enabled, date, onStep, onLock }: AgendaSwipeOptions,
): Step | null {
  const reduced = usePrefersReducedMotion();
  const [peek, setPeek] = useState<Step | null>(null);
  const keep = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ onStep, onLock, date, reduced });
  useEffect(() => {
    latest.current = { onStep, onLock, date, reduced };
  });
  const controller = useRef<AgendaSwipe | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !enabled) return;
    const swipe = createAgendaSwipe({
      pane: () => paneRef.current,
      viewportWidth: () => window.innerWidth,
      calendarBusy: () => !!viewport.querySelector(CALENDAR_GESTURE),
      reduced: () => latest.current.reduced,
      gap: () => {
        const probe = document.createElement("div");
        probe.className = "invisible absolute w-inline-lg";
        viewport.appendChild(probe);
        const gap = probe.offsetWidth;
        probe.remove();
        return gap;
      },
      swiping: (on) => {
        if (on) viewport.setAttribute(SWIPING_ATTRIBUTE, "");
        else viewport.removeAttribute(SWIPING_ATTRIBUTE);
      },
      peek: (step) => {
        clearTimeout(keep.current);
        setPeek(step);
        if (step !== null) latest.current.onLock?.(step);
      },
      release: () => {
        clearTimeout(keep.current);
        keep.current = setTimeout(() => setPeek(null), KEEP_NEIGHBOUR_MS);
      },
      step: (step) => latest.current.onStep(step),
      ready: () =>
        Array.from(paneRef.current?.querySelectorAll(`[data-date="${latest.current.date}"]`) ?? []).some(
          (cell) => !cell.closest("[data-agenda-peek]"),
        ),
    });
    controller.current = swipe;

    function handleStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch) swipe.start(event.touches.length, touch.clientX, touch.clientY, event.timeStamp);
    }
    function handleMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch) swipe.move(event.touches.length, touch.clientX, touch.clientY, event.timeStamp);
    }
    function handleEnd(event: TouchEvent) {
      const touch = event.changedTouches[0];
      if (touch) swipe.end(touch.clientX, touch.clientY, event.timeStamp);
      else swipe.cancel();
    }

    viewport.addEventListener("touchstart", handleStart, { passive: true });
    viewport.addEventListener("touchmove", handleMove, { passive: true });
    viewport.addEventListener("touchend", handleEnd, { passive: true });
    viewport.addEventListener("touchcancel", swipe.cancel, { passive: true });
    return () => {
      viewport.removeEventListener("touchstart", handleStart);
      viewport.removeEventListener("touchmove", handleMove);
      viewport.removeEventListener("touchend", handleEnd);
      viewport.removeEventListener("touchcancel", swipe.cancel);
      swipe.destroy();
      clearTimeout(keep.current);
      controller.current = null;
    };
  }, [viewportRef, paneRef, enabled]);

  useEffect(() => {
    controller.current?.dateChanged();
  }, [date]);

  return peek;
}
