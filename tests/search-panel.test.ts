import { describe, expect, it } from "vitest";
import type { ShortcutEvent } from "@/lib/agenda/shortcuts";
import { flattenGroups, groupResults, isSearchShortcut, moveActive, showSmartSearchHint } from "@/lib/search/panel";
import type { SearchResult } from "@/lib/search/query";

const press = (key: string, overrides: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key,
  ctrlKey: false,
  metaKey: true,
  altKey: false,
  shiftKey: false,
  target: { tagName: "BODY" },
  ...overrides,
});

describe("isSearchShortcut", () => {
  it("fires on Cmd+K and Ctrl+K, in either case", () => {
    expect(isSearchShortcut(press("k"), false)).toBe(true);
    expect(isSearchShortcut(press("K"), false)).toBe(true);
    expect(isSearchShortcut(press("k", { metaKey: false, ctrlKey: true }), false)).toBe(true);
  });

  it("needs exactly the platform modifier and no other", () => {
    expect(isSearchShortcut(press("k", { metaKey: false }), false)).toBe(false);
    expect(isSearchShortcut(press("k", { ctrlKey: true }), false)).toBe(false);
    expect(isSearchShortcut(press("k", { altKey: true }), false)).toBe(false);
    expect(isSearchShortcut(press("k", { shiftKey: true }), false)).toBe(false);
    expect(isSearchShortcut(press("j"), false)).toBe(false);
  });

  it("stays quiet in fields and the editor", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(isSearchShortcut(press("k", { target: { tagName } }), false)).toBe(false);
    }
    expect(isSearchShortcut(press("k", { target: { tagName: "DIV", isContentEditable: true } }), false)).toBe(false);
  });

  it("stays quiet when blocked, handled or composing", () => {
    expect(isSearchShortcut(press("k"), true)).toBe(false);
    expect(isSearchShortcut(press("k", { defaultPrevented: true }), false)).toBe(false);
    expect(isSearchShortcut(press("k", { isComposing: true }), false)).toBe(false);
  });
});

const hit = (type: SearchResult["type"], id: string): SearchResult => ({
  type,
  id,
  title: id,
  snippet: null,
  href: `/${id}`,
  score: 1,
});

describe("groupResults", () => {
  const results = [hit("recipe", "a"), hit("note", "b"), hit("recipe", "c"), hit("card", "d")];

  it("groups by type in order of first appearance", () => {
    expect(groupResults(results).map((group) => [group.type, group.items.map((item) => item.id)])).toEqual([
      ["recipe", ["a", "c"]],
      ["note", ["b"]],
      ["card", ["d"]],
    ]);
  });

  it("flattens in the displayed order", () => {
    expect(flattenGroups(groupResults(results)).map((item) => item.id)).toEqual(["a", "c", "b", "d"]);
  });

  it("handles no results", () => {
    expect(groupResults([])).toEqual([]);
  });
});

describe("moveActive", () => {
  it("steps down and up, wrapping at both ends", () => {
    expect(moveActive(0, "ArrowDown", 3)).toBe(1);
    expect(moveActive(2, "ArrowDown", 3)).toBe(0);
    expect(moveActive(1, "ArrowUp", 3)).toBe(0);
    expect(moveActive(0, "ArrowUp", 3)).toBe(2);
  });

  it("jumps with Home and End", () => {
    expect(moveActive(1, "Home", 3)).toBe(0);
    expect(moveActive(1, "End", 3)).toBe(2);
  });

  it("ignores other keys and an empty list", () => {
    expect(moveActive(0, "a", 3)).toBeNull();
    expect(moveActive(0, "ArrowDown", 0)).toBeNull();
  });
});

describe("showSmartSearchHint", () => {
  it("shows only for keyword answers a member could upgrade", () => {
    expect(showSmartSearchHint("keyword", true)).toBe(true);
    expect(showSmartSearchHint("keyword", false)).toBe(false);
    expect(showSmartSearchHint("hybrid", true)).toBe(false);
  });
});
