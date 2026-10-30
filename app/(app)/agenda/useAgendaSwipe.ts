"use client";

import { useEffect, useRef, type RefObject } from "react";
import { swipeStep, type SwipePoint } from "@/lib/agenda/swipe";

// While FullCalendar drags or selects, it shows a mirror or a highlight; such a stroke is never a swipe.
const CALENDAR_GESTURE = ".fc-event-mirror, .fc-event-dragging, .fc-highlight";

/**
 * Runs `onStep` for a horizontal swipe on `ref` (passive touch listeners, so vertical scrolling and
 * the calendar's own long-press drag keep working). Off while `enabled` is false.
 */
export function useAgendaSwipe(ref: RefObject<HTMLElement | null>, enabled: boolean, onStep: (step: 1 | -1) => void) {
  const latest = useRef(onStep);
  useEffect(() => {
    latest.current = onStep;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    let start: SwipePoint | null = null;

    function handleStart(event: TouchEvent) {
      const touch = event.touches[0];
      start = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY, time: event.timeStamp } : null;
    }
    function handleMove(event: TouchEvent) {
      if (event.touches.length > 1 || element?.querySelector(CALENDAR_GESTURE)) start = null;
    }
    function handleEnd(event: TouchEvent) {
      const touch = event.changedTouches[0];
      const from = start;
      start = null;
      if (!from || !touch) return;
      const step = swipeStep(from, { x: touch.clientX, y: touch.clientY, time: event.timeStamp }, window.innerWidth);
      if (step) latest.current(step);
    }
    function handleCancel() {
      start = null;
    }

    element.addEventListener("touchstart", handleStart, { passive: true });
    element.addEventListener("touchmove", handleMove, { passive: true });
    element.addEventListener("touchend", handleEnd, { passive: true });
    element.addEventListener("touchcancel", handleCancel, { passive: true });
    return () => {
      element.removeEventListener("touchstart", handleStart);
      element.removeEventListener("touchmove", handleMove);
      element.removeEventListener("touchend", handleEnd);
      element.removeEventListener("touchcancel", handleCancel);
    };
  }, [ref, enabled]);
}
