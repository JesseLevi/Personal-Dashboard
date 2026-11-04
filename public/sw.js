// Atlas service worker (ADR-0054). Hand-written, no dependencies.
// Network first, always. Offline it serves the last loaded basket page
// read-only, and an offline page for every other navigation. It caches only
// basket page HTML and the hashed build assets that page needs; never API,
// auth, image or data routes. A basket page also asks the worker to store it
// (client navigation); /winkelmand offline serves the last one. Logout and the login page drop the basket pages.

const PAGES = "atlas-pages-v1";
const ASSETS = "atlas-assets-v1";
const OFFLINE_URL = "/offline";
const BASKET_PAGE = /^\/winkelmand\/[0-9a-f-]{36}\/?$/i;
// Entry point of the basket (manifest start_url): redirects online, so offline it gets the last stored basket.
const BASKET_HOME = /^\/winkelmand\/?$/;
const LAST_BASKET = "/__last-basket";
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
  const data = event.data;
  if (data === "atlas:clear") event.waitUntil(clearPages());
  // The basket page asks to be stored itself: in-app navigation never reaches navigate().
  if (data && data.type === "atlas:cache-basket" && typeof data.path === "string") {
    event.waitUntil(cacheBasket(data.path));
  }
});

// Stores an ok, basic, non-redirected basket page; any other path or response is ignored.
async function cacheBasket(path) {
  let url;
  try {
    url = new URL(path, self.location.origin);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin || !BASKET_PAGE.test(url.pathname)) return;
  try {
    const response = await fetch(url.origin + url.pathname, { credentials: "same-origin", cache: "reload" });
    await storeBasket(url, response);
  } catch {
    // Offline or failed: keep what is stored.
  }
}

async function storeBasket(url, response) {
  if (!response.ok || response.type !== "basic" || response.redirected) return;
  const cache = await caches.open(PAGES);
  await cache.put(url.origin + url.pathname, response.clone());
  await cache.put(url.origin + LAST_BASKET, response.clone());
}

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
    if (isBasket) await storeBasket(url, response);
    return response;
  } catch {
    const cache = await caches.open(PAGES);
    if (isBasket) {
      const cached = await cache.match(url.origin + url.pathname, MATCH);
      if (cached) return cached;
    }
    if (BASKET_HOME.test(url.pathname)) {
      const last = await cache.match(url.origin + LAST_BASKET, MATCH);
      if (last) return last;
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
