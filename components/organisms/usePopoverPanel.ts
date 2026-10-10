"use client";

import { useEffect, useRef, useState } from "react";
import { measure, type Placement } from "./EditingBarMenu";

// design: Claude-designed on request (#330)
/**
 * Open/close state, trigger-anchored placement and dismissal (outside
 * pointer, resize, scroll) for the portalled panels of the table picker and
 * the table menu. Same placement rules as EditingBarMenu
 * (design/notes/EditingBar.md); `onOpen` runs once the panel is mounted.
 */
export function usePopoverPanel(onOpen: (panel: HTMLDivElement) => void) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isOpen = placement !== null;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  function close() {
    setPlacement(null);
  }

  function open() {
    const trigger = wrapperRef.current?.querySelector("button");
    if (trigger) setPlacement(measure(trigger));
  }

  useEffect(() => {
    if (!isOpen) return;
    if (panelRef.current) onOpenRef.current(panelRef.current);
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || wrapperRef.current?.contains(target)) return;
      close();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [isOpen]);

  return { placement, isOpen, open, close, wrapperRef, panelRef };
}
