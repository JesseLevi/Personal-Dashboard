import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTokenSource } from "@/app/login/turnstile-token-source";

function setup(waitMs = 5000) {
  const driver = { start: vi.fn(), reset: vi.fn() };
  return { driver, source: createTokenSource(driver, waitMs) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createTokenSource", () => {
  it("warm starts one challenge and caches the token", async () => {
    const { driver, source } = setup();
    source.warm();
    source.warm();
    expect(driver.start).toHaveBeenCalledTimes(1);
    source.onToken("t1");
    await expect(source.take()).resolves.toBe("t1");
  });

  it("hands a cached token out once, resets and pre-fetches the next", async () => {
    const { driver, source } = setup();
    source.warm();
    source.onToken("t1");
    await source.take();
    expect(driver.reset).toHaveBeenCalledTimes(1);
    expect(driver.start).toHaveBeenCalledTimes(2);
    source.onToken("t2");
    await expect(source.take()).resolves.toBe("t2");
  });

  it("never gives the same token to two callers", async () => {
    const { source } = setup();
    source.warm();
    source.onToken("t1");
    const first = source.take();
    const second = source.take();
    await expect(first).resolves.toBe("t1");
    source.onToken("t2");
    await expect(second).resolves.toBe("t2");
  });

  it("take without a cache starts a challenge and waits for it", async () => {
    const { driver, source } = setup();
    const pending = source.take();
    expect(driver.start).toHaveBeenCalledTimes(1);
    source.onToken("t1");
    await expect(pending).resolves.toBe("t1");
    expect(driver.start).toHaveBeenCalledTimes(2);
  });

  it("a newer take supersedes the older waiter", async () => {
    const { source } = setup();
    const older = source.take();
    const newer = source.take();
    await expect(older).resolves.toBeNull();
    source.onToken("t1");
    await expect(newer).resolves.toBe("t1");
  });

  it("drops an expired cached token", async () => {
    const { driver, source } = setup();
    source.warm();
    source.onToken("t1");
    source.onExpired();
    const pending = source.take();
    expect(driver.start).toHaveBeenCalledTimes(2);
    source.onToken("t2");
    await expect(pending).resolves.toBe("t2");
  });

  it("resolves null on error and on timeout", async () => {
    const { source } = setup(1000);
    const failed = source.take();
    source.onError();
    await expect(failed).resolves.toBeNull();
    const slow = source.take();
    vi.advanceTimersByTime(1000);
    await expect(slow).resolves.toBeNull();
  });

  it("a token that arrives after a timeout is cached, not lost", async () => {
    const { source } = setup(1000);
    const slow = source.take();
    vi.advanceTimersByTime(1000);
    await slow;
    source.onToken("late");
    await expect(source.take()).resolves.toBe("late");
  });

  it("returns null and stops launching after dispose", async () => {
    const { driver, source } = setup();
    source.dispose();
    source.warm();
    await expect(source.take()).resolves.toBeNull();
    expect(driver.start).not.toHaveBeenCalled();
  });
});
