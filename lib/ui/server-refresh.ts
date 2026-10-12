"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Generic "keep this server-rendered page fresh" hook (#428). The browser
// cannot subscribe to the database (ADR-0033), so a page that other people
// change polls the server instead: `router.refresh()` on returning to the tab,
// on window focus, and every `intervalMs` while the tab is visible.

export const SERVER_REFRESH_INTERVAL_MS = 15_000;

interface RefreshTargets {
  document: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  window: Pick<Window, "addEventListener" | "removeEventListener">;
}

export interface ServerRefreshOptions {
  refresh: () => void;
  /** True while an optimistic action is in flight; the refresh is skipped then. */
  isBusy?: () => boolean;
  intervalMs?: number;
}

/**
 * Framework-free core of `useServerRefresh`. Returns a cleanup function.
 * No interval runs while the tab is hidden; it restarts when the tab shows.
 */
export function startServerRefresh(
  { refresh, isBusy, intervalMs = SERVER_REFRESH_INTERVAL_MS }: ServerRefreshOptions,
  targets: RefreshTargets,
): () => void {
  const { document: doc, window: win } = targets;
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    if (doc.visibilityState !== "visible") return;
    if (isBusy?.()) return;
    refresh();
  };
  const stopTimer = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  const startTimer = () => {
    stopTimer();
    timer = setInterval(tick, intervalMs);
  };
  const onVisibility = () => {
    if (doc.visibilityState === "visible") {
      tick();
      startTimer();
    } else {
      stopTimer();
    }
  };
  const onFocus = () => tick();

  doc.addEventListener("visibilitychange", onVisibility);
  win.addEventListener("focus", onFocus);
  if (doc.visibilityState === "visible") startTimer();

  return () => {
    stopTimer();
    doc.removeEventListener("visibilitychange", onVisibility);
    win.removeEventListener("focus", onFocus);
  };
}

export function useServerRefresh({
  active,
  intervalMs = SERVER_REFRESH_INTERVAL_MS,
  isBusy,
}: {
  active: boolean;
  intervalMs?: number;
  isBusy?: () => boolean;
}) {
  const router = useRouter();
  const busyRef = useRef(isBusy);
  useEffect(() => {
    busyRef.current = isBusy;
  });

  useEffect(() => {
    if (!active) return;
    return startServerRefresh(
      { refresh: () => router.refresh(), isBusy: () => busyRef.current?.() ?? false, intervalMs },
      { document, window },
    );
  }, [active, intervalMs, router]);
}
