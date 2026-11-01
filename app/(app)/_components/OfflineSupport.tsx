"use client";

import { useEffect } from "react";
import { clearOfflineCache, registerServiceWorker } from "@/lib/pwa/offline-cache";

/** Registers the service worker for signed-in pages (ADR-0054). Renders nothing. */
export function RegisterServiceWorker() {
  useEffect(() => registerServiceWorker(), []);
  return null;
}

/** Wipes cached pages wherever a session has ended (the login page). Renders nothing. */
export function ClearOfflineCache() {
  useEffect(() => {
    void clearOfflineCache();
  }, []);
  return null;
}
