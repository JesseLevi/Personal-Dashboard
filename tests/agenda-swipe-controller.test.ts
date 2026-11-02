import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAgendaSwipe, type AgendaSwipeHost } from "../app/(app)/agenda/useAgendaSwipe";
import { AGENDA_LONG_PRESS_MS } from "../lib/ui/agenda-calendar";

const VIEWPORT = 390;
const WIDTH = 310;
const GAP = 16;

// Fake pane: the controller writes `style` and listens for `transitionend` on it.
function fakePane() {
  const values = new Map<string, string>();
  const listeners = new Map<string, (event: unknown) => void>();
  const pane = {
    offsetWidth: WIDTH,
    values,
    style: {
      set transform(value: string) {
        values.set("transform", value);
      },
      get transform() {
        return values.get("transform") ?? "";
      },
      set transition(value: string) {
        values.set("transition", value);
      },
      set willChange(value: string) {
        values.set("will-change", value);
      },
      removeProperty: (name: string) => void values.delete(name),
    },
    addEventListener: (type: string, listener: (event: unknown) => void) => void listeners.set(type, listener),
    removeEventListener: (type: string) => void listeners.delete(type),
    endTransition() {
      listeners.get("transitionend")?.({ target: pane, propertyName: "transform" });
    },
  };
  return pane;
}

function setup(overrides: Partial<AgendaSwipeHost> = {}) {
  const pane = fakePane();
  const host = {
    pane: () => pane as unknown as HTMLElement,
    viewportWidth: () => VIEWPORT,
    calendarBusy: () => false,
    reduced: () => false,
    gap: () => GAP,
    swiping: vi.fn(),
    peek: vi.fn(),
    release: vi.fn(),
    step: vi.fn(),
    ready: () => true,
    ...overrides,
  } satisfies AgendaSwipeHost;
  return { pane, host, swipe: createAgendaSwipe(host) };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createAgendaSwipe", () => {
  it("follows a horizontal stroke and shows the neighbour on that side", () => {
    const { pane, host, swipe } = setup();
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 280, 402, 30);
    expect(host.peek).toHaveBeenCalledWith(1);
    swipe.move(1, 200, 402, 100);
    expect(pane.style.transform).toBe("translate3d(-100px, 0, 0)");
    expect(pane.values.get("transition")).toBe("none");
  });

  it("never moves past the neighbour", () => {
    const { pane, swipe } = setup();
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 280, 400, 30);
    swipe.move(1, -200, 400, 90);
    expect(pane.style.transform).toBe(`translate3d(${-(WIDTH + GAP)}px, 0, 0)`);
  });

  it("leaves a vertical stroke alone and does not switch axis mid-gesture", () => {
    const { pane, host, swipe } = setup();
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 298, 380, 30);
    swipe.move(1, 120, 370, 120);
    expect(host.peek).not.toHaveBeenCalled();
    expect(pane.values.has("transform")).toBe(false);
    swipe.end(120, 370, 140);
    expect(host.step).not.toHaveBeenCalled();
  });

  it("ignores a stroke that starts on the screen edge", () => {
    const { host, swipe } = setup();
    swipe.start(1, 10, 400, 0);
    swipe.move(1, 60, 400, 30);
    expect(host.peek).not.toHaveBeenCalled();
  });

  it("ignores a lock that comes after the long-press time, so a long-press drag is left to FullCalendar", () => {
    const { pane, host, swipe } = setup();
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 296, 400, AGENDA_LONG_PRESS_MS - 20);
    swipe.move(1, 250, 400, AGENDA_LONG_PRESS_MS + 20);
    swipe.move(1, 150, 400, AGENDA_LONG_PRESS_MS + 80);
    expect(host.peek).not.toHaveBeenCalled();
    expect(pane.values.has("transform")).toBe(false);
  });

  it("ignores the stroke while FullCalendar shows a drag mirror or selection", () => {
    let busy = false;
    const { host, swipe } = setup({ calendarBusy: () => busy });
    swipe.start(1, 300, 400, 0);
    busy = true;
    swipe.move(1, 250, 400, 40);
    expect(host.peek).not.toHaveBeenCalled();
  });

  it("returns to rest when a second finger lands", () => {
    const { pane, swipe } = setup();
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 280, 400, 30);
    swipe.move(1, 250, 400, 60);
    swipe.move(2, 250, 400, 70);
    expect(pane.style.transform).toBe("translate3d(0px, 0, 0)");
  });

  it("commits a slow drag past a third once the snap has ended, and steps once", () => {
    const { pane, host, swipe } = setup();
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 285, 400, 100);
    swipe.move(1, 195, 400, 900);
    swipe.end(195, 400, 1500);
    expect(pane.style.transform).toBe(`translate3d(${-(WIDTH + GAP)}px, 0, 0)`);
    expect(host.step).not.toHaveBeenCalled();
    pane.endTransition();
    expect(host.step).toHaveBeenCalledTimes(1);
    expect(host.step).toHaveBeenCalledWith(1);
    vi.advanceTimersByTime(1000);
    expect(host.step).toHaveBeenCalledTimes(1);
  });

  it("steps even when transitionend never comes", () => {
    const { host, swipe } = setup();
    swipe.start(1, 100, 400, 0);
    swipe.move(1, 120, 400, 100);
    swipe.move(1, 260, 400, 900);
    swipe.end(260, 400, 1500);
    vi.advanceTimersByTime(400);
    expect(host.step).toHaveBeenCalledWith(-1);
  });

  it("eases a short drag back without stepping", () => {
    const { pane, host, swipe } = setup();
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 285, 400, 100);
    swipe.move(1, 240, 400, 700);
    swipe.end(240, 400, 1200);
    expect(pane.style.transform).toBe("translate3d(0px, 0, 0)");
    pane.endTransition();
    expect(host.step).not.toHaveBeenCalled();
    expect(host.release).toHaveBeenCalledTimes(1);
    expect(pane.values.has("transform")).toBe(false);
  });

  it("commits a fast short flick", () => {
    const { pane, host, swipe } = setup();
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 280, 400, 20);
    swipe.move(1, 250, 400, 40);
    swipe.move(1, 220, 400, 60);
    swipe.end(220, 400, 62);
    expect(pane.style.transform).toBe(`translate3d(${-(WIDTH + GAP)}px, 0, 0)`);
    pane.endTransition();
    expect(host.step).toHaveBeenCalledWith(1);
  });

  it("releases the pane only after the calendar shows the new date", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => setTimeout(callback, 16));
    vi.stubGlobal("cancelAnimationFrame", (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
    let ready = false;
    const { pane, swipe } = setup({ ready: () => ready });
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 280, 400, 20);
    swipe.move(1, 190, 400, 60);
    swipe.end(190, 400, 62);
    pane.endTransition();
    swipe.dateChanged();
    vi.advanceTimersByTime(100);
    expect(pane.values.has("transform")).toBe(true);
    ready = true;
    vi.advanceTimersByTime(100);
    expect(pane.values.has("transform")).toBe(false);
    vi.unstubAllGlobals();
  });

  it("releases the pane after a timeout when the date never changes", () => {
    const { pane, swipe } = setup();
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 280, 400, 20);
    swipe.move(1, 190, 400, 60);
    swipe.end(190, 400, 62);
    pane.endTransition();
    vi.advanceTimersByTime(1000);
    expect(pane.values.has("transform")).toBe(false);
  });

  it("does not follow with reduced motion and steps on release instead", () => {
    const { pane, host, swipe } = setup({ reduced: () => true });
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 250, 400, 60);
    swipe.move(1, 180, 400, 150);
    expect(pane.values.has("transform")).toBe(false);
    expect(host.peek).not.toHaveBeenCalled();
    swipe.end(180, 400, 160);
    expect(host.step).toHaveBeenCalledWith(1);
    expect(host.swiping).toHaveBeenLastCalledWith(true);
  });

  it("does not step on release with reduced motion for a vertical stroke", () => {
    const { host, swipe } = setup({ reduced: () => true });
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 280, 300, 60);
    swipe.end(280, 200, 160);
    expect(host.step).not.toHaveBeenCalled();
  });

  it("returns to rest on touchcancel", () => {
    const { pane, host, swipe } = setup();
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 280, 400, 30);
    swipe.move(1, 240, 400, 60);
    swipe.cancel();
    expect(pane.style.transform).toBe("translate3d(0px, 0, 0)");
    pane.endTransition();
    expect(host.step).not.toHaveBeenCalled();
  });

  it("settles a commit to the neighbour one pane width plus the gap away", () => {
    const { pane, swipe } = setup();
    swipe.start(1, 100, 400, 0);
    swipe.move(1, 120, 400, 100);
    swipe.move(1, 260, 400, 900);
    swipe.end(260, 400, 1500);
    expect(pane.style.transform).toBe(`translate3d(${WIDTH + GAP}px, 0, 0)`);
  });

  it("marks the gesture as a swipe from the lock until the next touchstart", () => {
    const { pane, host, swipe } = setup();
    swipe.start(1, 300, 400, 0);
    expect(host.swiping).toHaveBeenLastCalledWith(false);
    swipe.move(1, 296, 400, 10);
    expect(host.swiping).not.toHaveBeenCalledWith(true);
    swipe.move(1, 280, 400, 30);
    expect(host.swiping).toHaveBeenLastCalledWith(true);
    swipe.move(1, 200, 400, 100);
    swipe.end(200, 400, 1500);
    pane.endTransition();
    vi.advanceTimersByTime(1000);
    expect(host.swiping).toHaveBeenLastCalledWith(true);
    swipe.start(1, 300, 400, 3000);
    expect(host.swiping).toHaveBeenLastCalledWith(false);
  });

  it("does not mark a vertical stroke or a long rest as a swipe", () => {
    const { host, swipe } = setup();
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 298, 380, 30);
    expect(host.swiping).not.toHaveBeenCalledWith(true);
  });

  it("clears the mark on destroy", () => {
    const { host, swipe } = setup();
    swipe.start(1, 300, 400, 0);
    swipe.move(1, 280, 400, 30);
    swipe.destroy();
    expect(host.swiping).toHaveBeenLastCalledWith(false);
  });
});
