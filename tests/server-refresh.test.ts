import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startServerRefresh } from "@/lib/ui/server-refresh";

function fakeTargets(visible = true) {
  const doc = new EventTarget() as EventTarget & { visibilityState: "visible" | "hidden" };
  doc.visibilityState = visible ? "visible" : "hidden";
  const win = new EventTarget();
  return {
    doc,
    win,
    targets: { document: doc, window: win } as unknown as Parameters<typeof startServerRefresh>[1],
    setVisible(v: boolean) {
      doc.visibilityState = v ? "visible" : "hidden";
      doc.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

describe("startServerRefresh", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("refreshes every interval while the tab is visible", () => {
    const refresh = vi.fn();
    startServerRefresh({ refresh, intervalMs: 15000 }, fakeTargets().targets);
    vi.advanceTimersByTime(14999);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("runs no interval for a hidden tab", () => {
    const refresh = vi.fn();
    startServerRefresh({ refresh }, fakeTargets(false).targets);
    vi.advanceTimersByTime(60000);
    expect(refresh).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refreshes at once when the tab becomes visible and stops the interval when hidden", () => {
    const refresh = vi.fn();
    const f = fakeTargets(false);
    startServerRefresh({ refresh }, f.targets);
    f.setVisible(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    f.setVisible(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes on window focus, but not while hidden", () => {
    const refresh = vi.fn();
    const f = fakeTargets();
    startServerRefresh({ refresh }, f.targets);
    f.win.dispatchEvent(new Event("focus"));
    expect(refresh).toHaveBeenCalledTimes(1);
    f.doc.visibilityState = "hidden";
    f.win.dispatchEvent(new Event("focus"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("skips a refresh while busy", () => {
    const refresh = vi.fn();
    let busy = true;
    const f = fakeTargets();
    startServerRefresh({ refresh, isBusy: () => busy }, f.targets);
    vi.advanceTimersByTime(15000);
    f.win.dispatchEvent(new Event("focus"));
    expect(refresh).not.toHaveBeenCalled();
    busy = false;
    vi.advanceTimersByTime(15000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("cleans up timers and listeners", () => {
    const refresh = vi.fn();
    const f = fakeTargets();
    const stop = startServerRefresh({ refresh }, f.targets);
    stop();
    expect(vi.getTimerCount()).toBe(0);
    f.win.dispatchEvent(new Event("focus"));
    f.setVisible(true);
    vi.advanceTimersByTime(60000);
    expect(refresh).not.toHaveBeenCalled();
  });
});
