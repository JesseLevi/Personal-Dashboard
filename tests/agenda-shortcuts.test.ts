import { describe, expect, it } from "vitest";
import { agendaShortcut, isTypingTarget, type ShortcutEvent } from "@/lib/agenda/shortcuts";

const press = (key: string, overrides: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  target: { tagName: "BODY" },
  ...overrides,
});

describe("agendaShortcut", () => {
  it("maps each key of the overview", () => {
    expect(agendaShortcut(press("t"), false)).toBe("today");
    expect(agendaShortcut(press("d"), false)).toBe("day");
    expect(agendaShortcut(press("w"), false)).toBe("week");
    expect(agendaShortcut(press("m"), false)).toBe("month");
    expect(agendaShortcut(press("l"), false)).toBe("list");
    expect(agendaShortcut(press("p"), false)).toBe("tray");
    expect(agendaShortcut(press("ArrowLeft"), false)).toBe("previous");
    expect(agendaShortcut(press("ArrowRight"), false)).toBe("next");
  });

  it("ignores letter case, so Caps Lock still works", () => {
    expect(agendaShortcut(press("T"), false)).toBe("today");
  });

  it("maps N to quick add, but not while typing or with a modifier", () => {
    expect(agendaShortcut(press("n"), false)).toBe("new");
    expect(agendaShortcut(press("n", { target: { tagName: "INPUT" } }), false)).toBeNull();
    expect(agendaShortcut(press("n", { metaKey: true }), false)).toBeNull();
  });

  it("ignores other keys", () => {
    expect(agendaShortcut(press("x"), false)).toBeNull();
    expect(agendaShortcut(press("Enter"), false)).toBeNull();
    expect(agendaShortcut(press("ArrowUp"), false)).toBeNull();
  });

  it("stays out of the way of every modifier", () => {
    for (const modifier of ["ctrlKey", "metaKey", "altKey", "shiftKey"] as const) {
      expect(agendaShortcut(press("t", { [modifier]: true }), false)).toBeNull();
    }
  });

  it("does nothing while a panel or popover is open", () => {
    expect(agendaShortcut(press("t"), true)).toBeNull();
  });

  it("does nothing while typing", () => {
    expect(agendaShortcut(press("t", { target: { tagName: "INPUT" } }), false)).toBeNull();
    expect(agendaShortcut(press("t", { target: { tagName: "TEXTAREA" } }), false)).toBeNull();
    expect(agendaShortcut(press("t", { target: { tagName: "SELECT" } }), false)).toBeNull();
    expect(agendaShortcut(press("ArrowLeft", { target: { tagName: "DIV", isContentEditable: true } }), false)).toBeNull();
  });

  it("does nothing for a handled or composing key", () => {
    expect(agendaShortcut(press("ArrowRight", { defaultPrevented: true }), false)).toBeNull();
    expect(agendaShortcut(press("t", { isComposing: true }), false)).toBeNull();
  });

  it("still works on a button", () => {
    expect(agendaShortcut(press("t", { target: { tagName: "BUTTON" } }), false)).toBe("today");
  });
});

describe("isTypingTarget", () => {
  it("is false without a target", () => {
    expect(isTypingTarget(null)).toBe(false);
  });
});
