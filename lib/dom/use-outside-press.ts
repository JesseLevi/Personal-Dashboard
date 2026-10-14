"use client";

import { useEffect, type RefObject } from "react";

/** Calls `onOutside` when a pointer goes down outside every one of `refs` (a portalled popover needs its own ref). */
export function useOutsidePress(refs: readonly RefObject<HTMLElement | null>[], onOutside: () => void) {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      onOutside();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  });
}
