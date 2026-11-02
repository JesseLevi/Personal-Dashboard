"use client";

import { useEffect, type RefObject } from "react";

// Height changes under half a pixel are layout rounding, not content changes.
const HEIGHT_EPSILON_PX = 0.5;

export interface HeightTransitionInput {
  /** The content height at the last observation; null before the first. */
  previous: number | null;
  /** The content height now. */
  next: number;
  /** The wrapper's rendered height while an earlier transition is still running, else null. */
  inFlight: number | null;
}

/** The pixel range to animate, or null when the change should simply take effect (first sizing, rounding noise). */
export function planHeightTransition({ previous, next, inFlight }: HeightTransitionInput): { from: number; to: number } | null {
  if (previous === null) return null;
  const from = inFlight ?? previous;
  if (Math.abs(next - from) < HEIGHT_EPSILON_PX) return null;
  return { from, to: next };
}

function transitionSeconds(element: HTMLElement) {
  return Number.parseFloat(getComputedStyle(element).transitionDuration) || 0;
}

/** True while a CSS keyframe animation (a sheet slide) runs on the element; its own transitions don't count. */
function isKeyframing(element: HTMLElement) {
  if (typeof element.getAnimations !== "function" || typeof CSSAnimation === "undefined") return false;
  return element.getAnimations().some((animation) => animation instanceof CSSAnimation);
}

/**
 * Animates a wrapper to the height of its content whenever that changes (a bottom sheet whose rows swap).
 * The wrapper sizes to its content (`height: auto`) and carries `overflow-hidden` plus a CSS transition on
 * `height`; `content` is its only child and owns any max-height cap. On a change the hook pins the old pixel
 * height, forces a reflow and sets the new one, then hands back to `auto` when the transition ends.
 *
 * No animation for the first sizing, while a keyframe animation (open or exit slide) runs on the wrapper, or
 * when the wrapper's `transition-duration` computes to 0 (reduced motion, or a drag, which zeroes it inline).
 */
export function useAnimatedHeight(wrapperRef: RefObject<HTMLElement | null>, contentRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content || typeof ResizeObserver === "undefined") return;

    let previous: number | null = null;
    let timer: number | undefined;

    function settle() {
      window.clearTimeout(timer);
      wrapper?.style.removeProperty("height");
    }

    function onTransitionEnd(event: TransitionEvent) {
      if (event.target === wrapper && event.propertyName === "height") settle();
    }
    wrapper.addEventListener("transitionend", onTransitionEnd);

    const observer = new ResizeObserver((entries) => {
      const next = entries[entries.length - 1]?.contentRect.height;
      if (next === undefined || !wrapper) return;
      const inFlight = wrapper.style.height !== "" ? wrapper.getBoundingClientRect().height : null;
      const plan = planHeightTransition({ previous, next, inFlight });
      previous = next;
      if (!plan) return settle();
      const seconds = transitionSeconds(wrapper);
      if (seconds === 0 || isKeyframing(wrapper)) return settle();
      window.clearTimeout(timer);
      wrapper.style.height = `${plan.from}px`;
      void wrapper.offsetHeight;
      wrapper.style.height = `${plan.to}px`;
      // transitionend is not guaranteed (interrupted, display change): never leave a stale pixel height behind.
      timer = window.setTimeout(settle, seconds * 1000 + 100);
    });
    observer.observe(content);

    return () => {
      observer.disconnect();
      wrapper.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(timer);
      wrapper.style.removeProperty("height");
    };
  }, [wrapperRef, contentRef]);
}
