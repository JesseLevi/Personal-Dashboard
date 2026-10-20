"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Drag-to-close tuning (#103, codebase decision, design/notes/SidePanel.md): SLOP ignores a tap's own
// jitter; DISTANCE needs a deliberate pull; VELOCITY lets a fast flick close before DISTANCE.
export const DRAG_SLOP_PX = 8;
export const DRAG_CLOSE_DISTANCE_PX = 120;
export const DRAG_CLOSE_VELOCITY_PX_MS = 0.5; // 500px/s

/** The slice of a pointer event the controller reads; React's `PointerEvent` satisfies it. */
export interface SheetDragEvent {
  pointerId: number;
  clientY: number;
  timeStamp: number;
  target: EventTarget | null;
  currentTarget: { setPointerCapture(pointerId: number): void };
  preventDefault(): void;
}

export interface SheetDragOptions {
  /** The element that moves with the finger. */
  getPanel: () => HTMLElement | null;
  /** Checked at pointer down: false while closed, leaving, or on a layout without the gesture. */
  canStart: () => boolean;
  onClose: () => void;
}

interface DragState {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  dragging: boolean;
}

export interface SheetDrag {
  onPointerDown(event: SheetDragEvent): void;
  onPointerMove(event: SheetDragEvent): void;
  onPointerUp(event: SheetDragEvent): void;
  onPointerCancel(event: SheetDragEvent): void;
  /** Drops a drag that ended without pointerup/cancel and clears its inline residue. */
  reset(): void;
}

function isButton(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return typeof element?.closest === "function" && !!element.closest("button");
}

/**
 * Drag-to-close for a bottom sheet, bound to its handle strip (never the scrolling content). Imperative
 * writes on the panel (no React state, so no render per pointermove): `transform` follows the finger with
 * the CSS transition off. Release snaps back, or closes after leaving `--sheet-drag-offset` on the panel
 * so an exit keyframe can start from the dragged position.
 */
export function createSheetDrag(getOptions: () => SheetDragOptions): SheetDrag {
  let drag: DragState | null = null;

  function clearInline(panel: HTMLElement | null) {
    panel?.style.removeProperty("transition-duration");
    panel?.style.removeProperty("transform");
  }

  function end(event: SheetDragEvent, cancelled: boolean) {
    const current = drag;
    drag = null;
    const { getPanel, onClose } = getOptions();
    const panel = getPanel();
    if (!current?.dragging || !panel) return;
    const deltaY = event.clientY - current.startY;
    // pointercancel (the browser aborted the gesture) always snaps back.
    const shouldClose =
      !cancelled && (deltaY > DRAG_CLOSE_DISTANCE_PX || current.velocity > DRAG_CLOSE_VELOCITY_PX_MS);
    if (shouldClose) panel.style.setProperty("--sheet-drag-offset", `${Math.max(0, deltaY)}px`);
    clearInline(panel);
    if (shouldClose) onClose();
  }

  return {
    onPointerDown(event) {
      if (!getOptions().canStart()) return;
      if (isButton(event.target)) return; // never hijack the close button's own click
      drag = {
        pointerId: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
        lastTime: event.timeStamp,
        velocity: 0,
        dragging: false,
      };
    },
    onPointerMove(event) {
      const current = drag;
      if (!current || current.pointerId !== event.pointerId) return;
      const panel = getOptions().getPanel();
      const deltaY = event.clientY - current.startY;
      if (!current.dragging) {
        if (Math.abs(deltaY) < DRAG_SLOP_PX) return;
        if (deltaY <= 0) {
          // Upward jitter in the handle strip isn't a close gesture.
          drag = null;
          return;
        }
        current.dragging = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        if (panel) panel.style.transitionDuration = "0s";
      }
      const dt = event.timeStamp - current.lastTime;
      if (dt > 0) current.velocity = (event.clientY - current.lastY) / dt;
      current.lastY = event.clientY;
      current.lastTime = event.timeStamp;
      if (panel) panel.style.transform = `translateY(${Math.max(0, deltaY)}px)`;
      event.preventDefault();
    },
    onPointerUp: (event) => end(event, false),
    onPointerCancel: (event) => end(event, true),
    reset() {
      drag = null;
      clearInline(getOptions().getPanel());
    },
  };
}

/** React binding: stable handlers that always read the latest options. */
export function useSheetDrag(options: SheetDragOptions): SheetDrag {
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  const [drag] = useState(() => createSheetDrag(() => latest.current));
  return drag;
}
