import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AGENDA_COLORS, itemColor } from "@/lib/agenda/colors";
import type { AgendaItem } from "@/lib/agenda/types";

const base = { id: "i1", title: "T", start: "2026-01-01", end: null, allDay: true, linkCount: 0 };
const css = readFileSync("app/theme.css", "utf8");

describe("agenda colours", () => {
  it("backs every palette key with surface, text and accent tokens in light and dark", () => {
    const dark = css.slice(css.indexOf('[data-theme="dark"]'));
    for (const color of AGENDA_COLORS) {
      for (const role of ["surface", "text", "accent"]) {
        const token = `--color-event-${color}-${role}:`;
        expect(css, token).toContain(token);
        expect(dark, token).toContain(token);
      }
    }
  });

  it("takes an event's colour from the event and the other kinds' from their kind", () => {
    const event: AgendaItem = { ...base, kind: "event", source: "manual", calendarId: "c", color: "pink", missingSince: null };
    const meal: AgendaItem = { ...base, kind: "meal", slot: "dinner", servings: 4, thumbnailPath: null, attached: false, position: 1000 };
    const card: AgendaItem = { ...base, kind: "planned_card", board: "B", column: "C" };
    const deadline: AgendaItem = { ...base, kind: "deadline" };
    expect([event, meal, card, deadline].map(itemColor)).toEqual(["pink", "green", "amber", "red"]);
  });
});
