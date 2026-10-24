"use client";

import { useEffect, useRef } from "react";
import { isSearchShortcut } from "@/lib/search/panel";

// A modal panel that is open (SidePanel stays mounted, `aria-hidden` while closed) owns the keyboard.
const OPEN_DIALOG = '[role="dialog"][aria-modal="true"]:not([aria-hidden="true"])';

/** Runs `onOpen` on ⌘K / Ctrl+K, unless typing, `blocked`, or another panel is open. */
export function useSearchShortcut(onOpen: () => void, blocked: boolean) {
  const latest = useRef(onOpen);
  useEffect(() => {
    latest.current = onOpen;
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isSearchShortcut(event, blocked || document.querySelector(OPEN_DIALOG) !== null)) return;
      event.preventDefault();
      latest.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [blocked]);
}
