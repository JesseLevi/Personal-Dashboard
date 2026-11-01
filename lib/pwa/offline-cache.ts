// Client side of the service worker (public/sw.js, ADR-0054).

/** The page cache of public/sw.js; only it holds personal data (basket pages). */
export const OFFLINE_PAGES_CACHE = "atlas-pages-v1";
const OFFLINE_URL = "/offline";

/** Registers the worker in production builds only (dev reloads would fight it). */
export function registerServiceWorker(): void {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // No offline mode; the app itself is unaffected.
  });
}

/** Removes every cached basket page; keeps the offline page. Never throws, so logout always proceeds. */
export async function clearOfflineCache(): Promise<void> {
  try {
    navigator.serviceWorker?.controller?.postMessage("atlas:clear");
    if (!("caches" in window)) return;
    const cache = await caches.open(OFFLINE_PAGES_CACHE);
    const keys = await cache.keys();
    await Promise.all(keys.filter((key) => new URL(key.url).pathname !== OFFLINE_URL).map((key) => cache.delete(key)));
  } catch {
    // Storage unavailable: nothing was cached either.
  }
}
