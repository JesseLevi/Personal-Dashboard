"use client";
import { useSyncExternalStore } from "react";

/** Mirrors the --blur-fade-* custom properties in app/globals.css. */
export const BLUR_FADE = {
  inMs: 420,
  outMs: 280,
  stepMs: 50,
  maxDelayMs: 400,
  reducedMs: 120,
} as const;

// Literal strings so Tailwind's scanner emits each arbitrary-property class.
const STAGGER = [
  "[--fade-index:0]",
  "[--fade-index:1]",
  "[--fade-index:2]",
  "[--fade-index:3]",
  "[--fade-index:4]",
  "[--fade-index:5]",
  "[--fade-index:6]",
  "[--fade-index:7]",
  "[--fade-index:8]",
  "[--fade-index:9]",
] as const;

/** Class setting the stagger index; indexes past 9 clamp (the delay caps at 400ms anyway). */
export function blurFadeStagger(index: number): string {
  const i = Number.isFinite(index) ? Math.trunc(index) : 0;
  return STAGGER[Math.min(Math.max(i, 0), STAGGER.length - 1)];
}

function delayMs(count: number, reduced: boolean): number {
  if (reduced || count <= 1) return 0;
  return Math.min((count - 1) * BLUR_FADE.stepMs, BLUR_FADE.maxDelayMs);
}

/** Time until the last of `count` staggered elements has finished fading out. */
export function blurOutTotalMs(count: number, reduced = false): number {
  return delayMs(count, reduced) + (reduced ? BLUR_FADE.reducedMs : BLUR_FADE.outMs);
}

/** Time until the last of `count` staggered elements has finished fading in. */
export function blurInTotalMs(count: number, reduced = false): number {
  return delayMs(count, reduced) + (reduced ? BLUR_FADE.reducedMs : BLUR_FADE.inMs);
}

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Live `prefers-reduced-motion: reduce`; false on the server. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
