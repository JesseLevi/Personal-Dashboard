"use client";

import { useEffect, useRef } from "react";
import { startImportPolling } from "@/lib/recipes/import/polling";

/** Calls `onPoll` every ~2.5 s while `active` and the tab is visible (#318); stops when `active` turns false. */
export function useImportPolling(active: boolean, onPoll: () => void): void {
  const latest = useRef(onPoll);
  useEffect(() => {
    latest.current = onPoll;
  });
  useEffect(() => {
    if (!active) return;
    return startImportPolling({ doc: document, onPoll: () => latest.current() });
  }, [active]);
}
