// Autosave state machine for the note editor (#334). Framework-free so a
// failing save and its retry are unit-testable (tests/notes-save-controller.test.ts).
// Status only ever reaches "saved" from a resolved `{ success: true }`;
// rationale: design/notes/NoteEditor.md.

export type SaveStatus = "saved" | "saving" | "error";

export type SaveFn = (content: unknown) => Promise<{ success: boolean }>;

export class SaveController {
  private status: SaveStatus = "saved";
  private latest: unknown = null;
  private failed: unknown = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private current: Promise<void> = Promise.resolve();
  private savedAny = false;
  private disposed = false;
  private listeners = new Set<() => void>();

  constructor(
    private readonly save: SaveFn,
    private readonly debounceMs: number,
  ) {}

  getStatus = (): SaveStatus => this.status;

  /** True once any write succeeded, i.e. the server copy changed. */
  hasSaved = (): boolean => this.savedAny;

  /** Resolves when no write is in flight any more. */
  settled = async (): Promise<void> => {
    let seen: Promise<void> | null = null;
    while (seen !== this.current) {
      seen = this.current;
      await seen;
    }
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** A new full-document snapshot: schedule a debounced write. */
  change(content: unknown) {
    this.latest = content;
    this.set("saving");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.debounceMs);
  }

  /** Writes any pending snapshot now (unmount, tab hidden, retry). */
  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.latest === null || this.inFlight) return;
    const content = this.latest;
    this.latest = null;
    this.inFlight = true;
    this.set("saving");
    this.current = this.save(content)
      .then(
        (result) => result.success,
        () => false,
      )
      .then((ok) => {
        this.inFlight = false;
        if (ok) this.savedAny = true;
        this.failed = ok ? null : content;
        if (this.latest !== null) {
          // A newer snapshot arrived meanwhile and supersedes this one.
          if (!this.timer) this.flush();
          return;
        }
        this.set(ok ? "saved" : "error");
      });
  }

  /** Re-sends the snapshot that failed. */
  retry() {
    if (this.latest === null) this.latest = this.failed;
    this.failed = null;
    this.flush();
  }

  /** Drops everything pending, e.g. right before the note is deleted. */
  discard() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.latest = null;
    this.failed = null;
    this.set("saved");
  }

  dispose() {
    this.flush();
    this.disposed = true;
    this.listeners.clear();
  }

  private set(status: SaveStatus) {
    if (this.disposed || this.status === status) return;
    this.status = status;
    this.listeners.forEach((l) => l());
  }
}
