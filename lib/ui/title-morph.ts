// Hands the outgoing page title to the header that mounts after a route change
// (the header remounts, so React state cannot carry it). Armed only by an
// explicit board switch; record: design/notes/PageHeader.md.
export interface TitleSnapshot {
  text: string;
  width: number;
}

const MAX_AGE_MS = 8000;

let live: (() => TitleSnapshot | null) | null = null;
let armed: (TitleSnapshot & { at: number }) | null = null;

/** The mounted title registers how to read its current text and width; returns the unregister. */
export function registerLiveTitle(read: () => TitleSnapshot | null): () => void {
  live = read;
  return () => {
    if (live === read) live = null;
  };
}

/** Snapshots the visible title so the next header can animate from it. */
export function armTitleMorph(now = Date.now()): void {
  const snapshot = live?.() ?? null;
  armed = snapshot ? { ...snapshot, at: now } : null;
}

/** Pure read (safe twice under strict mode); `clearTitleMorph` consumes it. */
export function peekTitleMorph(now = Date.now()): TitleSnapshot | null {
  if (!armed || now - armed.at >= MAX_AGE_MS) return null;
  return { text: armed.text, width: armed.width };
}

export function clearTitleMorph(): void {
  armed = null;
}
