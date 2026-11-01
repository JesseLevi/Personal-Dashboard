# ADR-0054: The basket can be read offline

**Status**: Accepted (2026-11-01, user decision on the improvement brief, package 8: option a, read-only). Extends the PWA setup in `Architecture.md` §3.

## Context

- Atlas had no service worker. In a shop without signal the home-screen app showed nothing, exactly when the basket is needed.
- Weighed: a read-only copy of the last basket; that plus a queue for checking items off offline; nothing.

## Decision

1. **One hand-written service worker** (`public/sw.js`), no dependency. Registered from the signed-in layout in production builds only.
2. **Network first, always.** Only navigations and `/_next/static/*` pass through it.
   - A successful, unredirected `/winkelmand/<id>` page is stored by path (`atlas-pages-v1`).
   - Hashed build assets are stored cache-first (`atlas-assets-v1`); they are public and immutable.
   - Offline, a basket page comes from the cache; every other page, or a basket never opened on this device, gets `/offline`, which is cached at install and needs no session.
   - Nothing else is cached: no API, auth, image, data or server-action responses.
3. **Read-only.** A basket served offline shows "Offline: dit is je mand van <tijd>" (the server render time). Checking off and adding stay online-only; they fail as they do today without a connection. A queue is a separate decision (option b).
4. **Privacy.** Logout and the login page drop every cached basket page (client wipe plus a message to the worker); the offline page and public assets stay. A redirected response (expired session) is never stored.

## Consequences

- A basket shows offline only if it was opened on that device since the worker was installed.
- On a shared device, the last basket stays readable offline until someone logs out or opens the login page.
- `sw.js` changes reach a device on the browser's own update check; bump the cache names when the cached shape changes.
