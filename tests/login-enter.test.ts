import { describe, expect, it } from "vitest";
import {
  LOGIN_ENTER_KEY,
  LOGIN_ENTER_TTL_MS,
  claimSkeletonEnter,
  clearEnterFromLogin,
  hasEnterFromLogin,
  markEnterFromLogin,
  skeletonPlayedEnter,
} from "@/lib/ui/login-enter";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("login-enter handshake", () => {
  it("is false until marked, true after, false once cleared", () => {
    const store = memoryStore();
    expect(hasEnterFromLogin(store, 1000)).toBe(false);
    markEnterFromLogin(store, 1000);
    expect(store.getItem(LOGIN_ENTER_KEY)).toBe("1000");
    expect(hasEnterFromLogin(store, 1500)).toBe(true);
    expect(hasEnterFromLogin(store, 1500)).toBe(true);
    clearEnterFromLogin(store);
    expect(hasEnterFromLogin(store, 1500)).toBe(false);
  });
  it("ignores a stale or garbage mark", () => {
    const store = memoryStore();
    markEnterFromLogin(store, 1000);
    expect(hasEnterFromLogin(store, 1000 + LOGIN_ENTER_TTL_MS + 1)).toBe(false);
    store.setItem(LOGIN_ENTER_KEY, "nope");
    expect(hasEnterFromLogin(store, 1000)).toBe(false);
  });
  it("survives missing or throwing storage", () => {
    const fail = () => {
      throw new Error("blocked");
    };
    const throwing = { getItem: fail, setItem: fail, removeItem: fail };
    expect(() => markEnterFromLogin(throwing)).not.toThrow();
    expect(hasEnterFromLogin(throwing)).toBe(false);
    expect(() => clearEnterFromLogin(throwing)).not.toThrow();
    expect(hasEnterFromLogin(null)).toBe(false);
  });
});

describe("skeleton handoff", () => {
  it("lets only the first skeleton per mark play, and tells the content", () => {
    const store = memoryStore();
    expect(claimSkeletonEnter(store, 10)).toBe(false);
    markEnterFromLogin(store, 100);
    expect(skeletonPlayedEnter(store, 200)).toBe(false);
    expect(claimSkeletonEnter(store, 200)).toBe(true);
    expect(claimSkeletonEnter(store, 210)).toBe(false);
    expect(skeletonPlayedEnter(store, 220)).toBe(true);
    markEnterFromLogin(store, 5000);
    expect(skeletonPlayedEnter(store, 5100)).toBe(false);
    expect(claimSkeletonEnter(store, 5100)).toBe(true);
  });
});
