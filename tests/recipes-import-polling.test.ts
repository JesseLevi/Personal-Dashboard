import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IMPORT_POLL_INTERVAL_MS,
  hasImportingRecipe,
  startImportPolling,
  type PollingDocument,
} from "@/lib/recipes/import/polling";

function fakeDoc(state = "visible") {
  const listeners = new Set<() => void>();
  const doc: PollingDocument & { visibilityState: string } = {
    visibilityState: state,
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
  };
  return { doc, listeners, setState: (s: string) => { doc.visibilityState = s; listeners.forEach((l) => l()); } };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("hasImportingRecipe", () => {
  it("is true only while some card is importing", () => {
    const board = (...statuses: Array<"done" | "importing" | "failed">) => [
      { recipes: statuses.map((import_status) => ({ import_status })) },
    ];
    expect(hasImportingRecipe(board("done", "failed"))).toBe(false);
    expect(hasImportingRecipe(board("done", "importing"))).toBe(true);
    expect(hasImportingRecipe([])).toBe(false);
  });
});

describe("startImportPolling", () => {
  it("polls every interval while the tab is visible", () => {
    const { doc } = fakeDoc();
    const onPoll = vi.fn();
    startImportPolling({ doc, onPoll });
    vi.advanceTimersByTime(IMPORT_POLL_INTERVAL_MS * 3);
    expect(onPoll).toHaveBeenCalledTimes(3);
  });

  it("does not poll while the tab is hidden, and refreshes once when it becomes visible again", () => {
    const { doc, setState } = fakeDoc("hidden");
    const onPoll = vi.fn();
    startImportPolling({ doc, onPoll });
    vi.advanceTimersByTime(IMPORT_POLL_INTERVAL_MS * 4);
    expect(onPoll).not.toHaveBeenCalled();
    setState("visible");
    expect(onPoll).toHaveBeenCalledTimes(1);
  });

  it("stops completely (no timer, no listener) once cancelled", () => {
    const { doc, listeners } = fakeDoc();
    const onPoll = vi.fn();
    const stop = startImportPolling({ doc, onPoll });
    stop();
    vi.advanceTimersByTime(IMPORT_POLL_INTERVAL_MS * 5);
    expect(onPoll).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
