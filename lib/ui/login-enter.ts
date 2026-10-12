/** sessionStorage handshake: LoginForm marks it, the te-doen page shell animates in once. */
export const LOGIN_ENTER_KEY = "atlas:enter-from-login";

/** A stale mark (login tab left alone, later hard load) must not animate. */
export const LOGIN_ENTER_TTL_MS = 10_000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): Store | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markEnterFromLogin(store: Store | null = defaultStore(), now = Date.now()): void {
  try {
    store?.setItem(LOGIN_ENTER_KEY, String(now));
  } catch {
    // storage blocked: the page just appears without the animation
  }
}

/** True while a fresh mark exists. Does not clear it, so every region of the page can read it. */
export function hasEnterFromLogin(store: Store | null = defaultStore(), now = Date.now()): boolean {
  try {
    const markedAt = Number(store?.getItem(LOGIN_ENTER_KEY));
    return Number.isFinite(markedAt) && markedAt > 0 && now - markedAt <= LOGIN_ENTER_TTL_MS;
  } catch {
    return false;
  }
}

export function clearEnterFromLogin(store: Store | null = defaultStore()): void {
  try {
    store?.removeItem(LOGIN_ENTER_KEY);
  } catch {
    // nothing to clear
  }
}

// The skeleton that shows while the page streams in plays the blur-in itself; the content that
// replaces it must then appear without a second one (opacity 0 -> in would flash the board
// away between skeleton and content). Module state, keyed by the mark so a new login resets it.
let skeletonPlayedFor: string | null = null;

function freshMark(store: Store | null, now: number): string | null {
  if (!hasEnterFromLogin(store, now)) return null;
  try {
    return store?.getItem(LOGIN_ENTER_KEY) ?? null;
  } catch {
    return null;
  }
}

/** True for the first skeleton of an arrival from login (it plays the blur-in); false for later ones. */
export function claimSkeletonEnter(store: Store | null = defaultStore(), now = Date.now()): boolean {
  const mark = freshMark(store, now);
  if (!mark || skeletonPlayedFor === mark) return false;
  skeletonPlayedFor = mark;
  return true;
}

/** True when a skeleton already played the blur-in for the current mark. */
export function skeletonPlayedEnter(store: Store | null = defaultStore(), now = Date.now()): boolean {
  const mark = freshMark(store, now);
  return mark !== null && skeletonPlayedFor === mark;
}
