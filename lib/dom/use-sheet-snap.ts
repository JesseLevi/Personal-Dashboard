"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { settleAgendaSheet, type AgendaSheetStop } from "@/lib/agenda/sheet";
import { DRAG_SLOP_PX } from "./use-sheet-drag";

// Sibling of `use-sheet-drag.ts` (drag-to-close, owned by SidePanel and quick add): a sheet that rests on
// one of two stops and never closes. Same slop and same imperative writes, no React state per pointermove.

/** The slice of a pointer event the controller reads; React's `PointerEvent` satisfies it. */
export interface SheetSnapEvent {
  pointerId: number;
  clientX: number;
  clientY: number;
  timeStamp: number;
  currentTarget: { setPointerCapture(pointerId: number): void };
  preventDefault(): void;
}

export interface SheetSnapOptions {
  /** The element that moves with the finger. */
  getPanel: () => HTMLElement | null;
  /** Checked at pointer down: false on a layout without the gesture. */
  canStart: () => boolean;
  getStop: () => AgendaSheetStop;
  /** Distance in px between the two stops. */
  getTravel: () => number;
  /** Called on release, before the inline `transform` is dropped, so the class change animates from the finger. */
  onSettle: (stop: AgendaSheetStop) => void;
}

interface SnapState {
  pointerId: number;
  from: AgendaSheetStop;
  travel: number;
  startX: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  dragging: boolean;
}

export interface SheetSnap {
  onPointerDown(event: SheetSnapEvent): void;
  onPointerMove(event: SheetSnapEvent): void;
  onPointerUp(event: SheetSnapEvent): void;
  onPointerCancel(event: SheetSnapEvent): void;
  /** True while a drag is under way: the sheet is not re-measured then. */
  isDragging(): boolean;
  /** True once, right after a drag ended: the click that follows it is not a tap. */
  consumeClick(): boolean;
  /** Drops a drag that ended without pointerup/cancel and clears its inline residue. */
  reset(): void;
}

export function createSheetSnap(getOptions: () => SheetSnapOptions): SheetSnap {
  let drag: SnapState | null = null;
  let dragged = false;

  function clearInline(panel: HTMLElement | null) {
    panel?.style.removeProperty("transition-duration");
    panel?.style.removeProperty("transform");
  }

  function end(event: SheetSnapEvent, cancelled: boolean) {
    const current = drag;
    drag = null;
    const { getPanel, onSettle } = getOptions();
    const panel = getPanel();
    if (!current?.dragging || !panel) return;
    dragged = true;
    window.setTimeout(() => (dragged = false), 0);
    // pointercancel (the browser took the gesture, e.g. a sideways pan) always returns to the start.
    const next = cancelled
      ? current.from
      : settleAgendaSheet({
          from: current.from,
          offsetPx: event.clientY - current.startY,
          travelPx: current.travel,
          velocityPxMs: current.velocity,
        });
    onSettle(next);
    clearInline(panel);
  }

  return {
    onPointerDown(event) {
      const { canStart, getStop, getTravel } = getOptions();
      if (!canStart()) return;
      drag = {
        pointerId: event.pointerId,
        from: getStop(),
        travel: getTravel(),
        startX: event.clientX,
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
        const deltaX = event.clientX - current.startX;
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < DRAG_SLOP_PX) return;
        // The direction is fixed once: a sideways start belongs to the strip's own scroll.
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
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
      const rest = current.from === "full" ? 0 : current.travel;
      const y = Math.min(current.travel, Math.max(0, rest + deltaY));
      if (panel) panel.style.transform = `translateY(${y}px)`;
      event.preventDefault();
    },
    onPointerUp: (event) => end(event, false),
    onPointerCancel: (event) => end(event, true),
    isDragging: () => !!drag?.dragging,
    consumeClick() {
      const was = dragged;
      dragged = false;
      return was;
    },
    reset() {
      drag = null;
      clearInline(getOptions().getPanel());
    },
  };
}

/** React binding: stable handlers that always read the latest options. */
export function useSheetSnap(options: SheetSnapOptions): SheetSnap {
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  const [snap] = useState(() => createSheetSnap(() => latest.current));
  return snap;
}
