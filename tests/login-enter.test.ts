import { describe, expect, it } from "vitest";
import {
  LOGIN_ENTER_KEY,
  LOGIN_ENTER_TTL_MS,
  clearEnterFromLogin,
  hasEnterFromLogin,
  markEnterFromLogin,
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
