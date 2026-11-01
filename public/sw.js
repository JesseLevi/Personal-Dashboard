// Atlas service worker (ADR-0054). Hand-written, no dependencies.
// Network first, always. Offline it serves the last loaded basket page
// read-only, and an offline page for every other navigation. It caches only
// basket page HTML and the hashed build assets that page needs; never API,
// auth, image or data routes. Logout and the login page drop the basket pages.

const PAGES = "atlas-pages-v1";
const ASSETS = "atlas-assets-v1";
const OFFLINE_URL = "/offline";
const BASKET_PAGE = /^\/winkelmand\/[0-9a-f-]{36}\/?$/i;
// Keyed by path; Next varies HTML on its own request headers, which a navigation never sends.
const MATCH = { ignoreVary: true, ignoreSearch: true };

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== PAGES && key !== ASSETS).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Drops every cached basket page (personal data); keeps the offline page and
// the public build assets.
self.addEventListener("message", (event) => {
  if (event.data === "atlas:clear") event.waitUntil(clearPages());
});

async function clearPages() {
  const cache = await caches.open(PAGES);
  const keys = await cache.keys();
  await Promise.all(keys.filter((key) => new URL(key.url).pathname !== OFFLINE_URL).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticAsset(request));
  }
});

async function navigate(request, url) {
  const isBasket = BASKET_PAGE.test(url.pathname);
  try {
    const response = await fetch(request);
    if (isBasket && response.ok && response.type === "basic" && !response.redirected) {
      const cache = await caches.open(PAGES);
      await cache.put(url.origin + url.pathname, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(PAGES);
    if (isBasket) {
      const cached = await cache.match(url.origin + url.pathname, MATCH);
      if (cached) return cached;
    }
    return (await cache.match(OFFLINE_URL, MATCH)) ?? Response.error();
  }
}

// Build assets are content-hashed and public: cache first, then network.
async function staticAsset(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
