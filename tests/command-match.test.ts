import { describe, expect, it } from "vitest";
import { matchesQuery, normalizeForMatch } from "@/lib/command/match";
import { boardPercent, matchingActions, matchingBoards, orderBoards, pinnedBoards } from "@/lib/command/palette";
import type { CommandAction, CommandBoard } from "@/lib/command/types";

describe("normalizeForMatch", () => {
  it("lower-cases and strips diacritics", () => {
    expect(normalizeForMatch("Café Ïdeeën")).toBe("cafe ideeen");
  });
});

describe("matchesQuery", () => {
  it("matches a prefix of any word, case- and diacritics-insensitive", () => {
    expect(matchesQuery("Nieuwe notitie", "not")).toBe(true);
    expect(matchesQuery("Nieuwe notitie", "NIEUW")).toBe(true);
    expect(matchesQuery("Ideeën bord", "idee")).toBe(true);
    expect(matchesQuery("Café", "cafe")).toBe(true);
  });

  it("does not match the middle of a word", () => {
    expect(matchesQuery("Nieuwe notitie", "titie")).toBe(false);
    expect(matchesQuery("Nieuwe notitie", "ieuwe")).toBe(false);
  });

  it("needs every query word to prefix some label word, in any order", () => {
    expect(matchesQuery("Nieuwe notitie", "not nieu")).toBe(true);
    expect(matchesQuery("Nieuwe notitie", "nieuw recept")).toBe(false);
  });

  it("treats an empty or blank query as a match and splits words on punctuation", () => {
    expect(matchesQuery("Naar Te doen", "")).toBe(true);
    expect(matchesQuery("Naar Te doen", "   ")).toBe(true);
    expect(matchesQuery("Weekmenu-najaar", "naj")).toBe(true);
  });
});

const board = (id: string, overrides: Partial<CommandBoard> = {}): CommandBoard => ({
  id,
  name: `Bord ${id}`,
  href: `/te-doen/${id}`,
  total: 10,
  done: 5,
  isFavorite: false,
  ...overrides,
});

describe("boards", () => {
  it("orders favourites first, then the given order", () => {
    const ordered = orderBoards([board("a"), board("b", { isFavorite: true }), board("c"), board("d", { isFavorite: true })]);
    expect(ordered.map((b) => b.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("pins at most four", () => {
    const many = ["a", "b", "c", "d", "e", "f"].map((id) => board(id, { isFavorite: id === "f" }));
    expect(pinnedBoards(many).map((b) => b.id)).toEqual(["f", "a", "b", "c"]);
  });

  it("matches by name", () => {
    const list = [board("a", { name: "Verhuizing" }), board("b", { name: "Moestuin" })];
    expect(matchingBoards(list, "moes").map((b) => b.id)).toEqual(["b"]);
  });

  it("rounds the percentage, clamps it and gives no ring without cards", () => {
    expect(boardPercent({ total: 25, done: 18 })).toBe(72);
    expect(boardPercent({ total: 3, done: 3 })).toBe(100);
    expect(boardPercent({ total: 3, done: 5 })).toBe(100);
    expect(boardPercent({ total: 0, done: 0 })).toBeNull();
  });
});

describe("matchingActions", () => {
  const action = (id: CommandAction["id"]): CommandAction => ({ id, kind: "navigate", icon: "Plus", pinned: false });
  const labels: Record<string, string> = { "go-notes": "Naar Notities", "new-note": "Nieuwe notitie", "go-agenda": "Naar Agenda" };

  it("matches on the translated label", () => {
    const found = matchingActions([action("go-notes"), action("new-note"), action("go-agenda")], (a) => labels[a.id], "noti");
    expect(found.map((a) => a.id)).toEqual(["go-notes", "new-note"]);
  });
});
