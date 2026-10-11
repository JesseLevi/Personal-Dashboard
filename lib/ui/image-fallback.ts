"use client";
import { useState } from "react";

/** Pure core: the fallback applies only once the primary `src` has failed. */
export function resolveImageSrc(
  src: string,
  fallback: string | undefined,
  failedSrc: string | null,
): string {
  return fallback && failedSrc === src ? fallback : src;
}

/** `<img>` src that swaps to `fallback` once on error; a failing fallback does not loop. */
export function useImageFallback(src: string, fallback?: string) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return {
    src: resolveImageSrc(src, fallback, failedSrc),
    onError: () => {
      if (fallback && failedSrc !== src) setFailedSrc(src);
    },
  };
}
