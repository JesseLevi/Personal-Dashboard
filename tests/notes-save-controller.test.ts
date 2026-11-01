import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveController } from "../lib/notes/save-controller";

// #334: status must follow the real save result, never an optimistic success.

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", text }] });

describe("SaveController", () => {
  it("shows saving while debouncing, then saved only after a successful result", async () => {
    const save = vi.fn().mockResolvedValue({ success: true });
    const c = new SaveController(save, 1000);
    expect(c.getStatus()).toBe("saved");
    c.change(doc("a"));
    expect(c.getStatus()).toBe("saving");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledWith(doc("a"), null);
    expect(c.getStatus()).toBe("saved");
  });

  it("surfaces a failed save as error and retry re-sends the same content", async () => {
    const save = vi
      .fn()
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true });
    const c = new SaveController(save, 1000);
    c.change(doc("a"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.getStatus()).toBe("error");

    c.retry();
    expect(c.getStatus()).toBe("saving");
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(doc("a"), null);
    expect(c.getStatus()).toBe("saved");
  });

  it("treats a thrown save as a failure", async () => {
    const c = new SaveController(vi.fn().mockRejectedValue(new Error("offline")), 1000);
    c.change(doc("a"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.getStatus()).toBe("error");
  });

  it("does not report saved while a newer edit is waiting", async () => {
    let resolveFirst: (v: { success: boolean }) => void = () => {};
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValue({ success: true });
    const c = new SaveController(save, 1000);
    c.change(doc("a"));
    await vi.advanceTimersByTimeAsync(1000);
    c.change(doc("ab"));
    resolveFirst({ success: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(c.getStatus()).toBe("saving");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenLastCalledWith(doc("ab"), null);
    expect(c.getStatus()).toBe("saved");
  });

  it("discard drops pending content", async () => {
    const save = vi.fn().mockResolvedValue({ success: true });
    const c = new SaveController(save, 1000);
    c.change(doc("a"));
    c.discard();
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
  });

  it("sends the last known version and advances it after each save", async () => {
    const save = vi
      .fn()
      .mockResolvedValueOnce({ success: true, version: 4 })
      .mockResolvedValueOnce({ success: true, version: 5 });
    const c = new SaveController(save, 1000, 3);
    c.change(doc("a"));
    await vi.advanceTimersByTimeAsync(1000);
    c.change(doc("ab"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenNthCalledWith(1, doc("a"), 3);
    expect(save).toHaveBeenNthCalledWith(2, doc("ab"), 4);
    expect(c.getStatus()).toBe("saved");
  });

  it("stops writing on a conflict and keeps the local text out of the database", async () => {
    const save = vi.fn().mockResolvedValue({ success: false, conflict: true });
    const c = new SaveController(save, 1000, 1);
    c.change(doc("stale"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.getStatus()).toBe("conflict");

    c.change(doc("stale typing"));
    c.retry();
    c.flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(c.getStatus()).toBe("conflict");
  });

  it("leaves the conflict only through discard (reload)", async () => {
    const save = vi
      .fn()
      .mockResolvedValueOnce({ success: false, conflict: true })
      .mockResolvedValue({ success: true, version: 9 });
    const c = new SaveController(save, 1000, 1);
    c.change(doc("stale"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.getStatus()).toBe("conflict");
    c.discard();
    expect(c.getStatus()).toBe("saved");
    c.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
