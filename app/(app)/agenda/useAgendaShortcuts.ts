"use client";

import { useEffect, useRef } from "react";
import { agendaShortcut, type AgendaShortcut } from "@/lib/agenda/shortcuts";

/** Runs `onShortcut` for the Agenda's single-key shortcuts; `blocked` while a panel or popover is open. */
export function useAgendaShortcuts(onShortcut: (shortcut: AgendaShortcut) => void, blocked: boolean) {
  const latest = useRef(onShortcut);
  useEffect(() => {
    latest.current = onShortcut;
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const shortcut = agendaShortcut(event, blocked);
      if (!shortcut) return;
      event.preventDefault();
      latest.current(shortcut);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [blocked]);
}
