// Basket switch = exit blur-fade, navigation, enter blur-fade on the new
// basket's mount (same pattern as te-doen/TeDoenBoardSwitch.tsx).
// Reasoning: design/notes/WinkelmandPage.md.

// Module scope so it survives the route change: tells the new basket it
// arrived via a switch. A first load or reload never sets it. The age cap
// drops a flag left by a navigation that never landed.
const ENTER_FLAG_MAX_AGE_MS = 8000;
let pendingEnter: { listId: string; at: number } | null = null;

export function markListEnter(listId: string) {
  pendingEnter = { listId, at: Date.now() };
}

/** Pure read (safe twice under strict mode); `clearListEnter` consumes it. */
export function wantsListEnter(listId: string): boolean {
  return (
    pendingEnter !== null &&
    pendingEnter.listId === listId &&
    Date.now() - pendingEnter.at < ENTER_FLAG_MAX_AGE_MS
  );
}

export function clearListEnter() {
  pendingEnter = null;
}

// Same lifetime rules for "open this basket's settings on arrival" (the
// settings icon of a basket other than the current one in the switcher).
let pendingSettings: { listId: string; at: number } | null = null;

export function markListSettings(listId: string) {
  pendingSettings = { listId, at: Date.now() };
}

/** Pure read (safe twice under strict mode); `clearListSettings` consumes it. */
export function wantsListSettings(listId: string): boolean {
  return (
    pendingSettings !== null &&
    pendingSettings.listId === listId &&
    Date.now() - pendingSettings.at < ENTER_FLAG_MAX_AGE_MS
  );
}

export function clearListSettings() {
  pendingSettings = null;
}
