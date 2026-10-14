"use client";

import { Draggable } from "@fullcalendar/react/interaction";
import { useEffect, useRef, type RefObject } from "react";

/** What an external element carries onto the calendar (recipe or card tray). */
export interface AgendaDragPayload {
  type: "recipe" | "card";
  id: string;
  title: string;
  /** Length of the drag ghost on a time grid. */
  durationMinutes?: number;
}

/** Hold time before a touch press becomes a drag; shorter than FullCalendar's default so a tray stays usable, longer than a tap. */
export const AGENDA_LONG_PRESS_MS = 350;

const payloads = new WeakMap<HTMLElement, AgendaDragPayload>();

export function getAgendaDragPayload(el: HTMLElement): AgendaDragPayload | undefined {
  return payloads.get(el);
}

/** Makes `ref`'s element draggable onto an `AgendaCalendar`. Pass `null` to switch dragging off. */
export function useAgendaDraggable(ref: RefObject<HTMLElement | null>, payload: AgendaDragPayload | null) {
  const latest = useRef(payload);
  latest.current = payload;
  const enabled = payload !== null;

  useEffect(() => {
    const el = ref.current;
    if (el && payload) payloads.set(el, payload);
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const draggable = new Draggable(el, {
      longPressDelay: AGENDA_LONG_PRESS_MS,
      eventData: () => ({
        create: false,
        title: latest.current?.title ?? "",
        duration: { minutes: latest.current?.durationMinutes ?? 60 },
      }),
    });
    return () => {
      draggable.destroy();
      payloads.delete(el);
    };
  }, [ref, enabled]);
}
