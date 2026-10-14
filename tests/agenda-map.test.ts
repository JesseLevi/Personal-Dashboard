import { describe, expect, it } from "vitest";
import {
  localDate,
  localDateTime,
  mapAgendaRow,
  mapAgendaRows,
  type AgendaRow,
} from "@/lib/agenda/map";

const AMS = "Europe/Amsterdam";
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const row = (over: Partial<AgendaRow>): AgendaRow => ({
  kind: "event",
  id: ID(1),
  title: "Titel",
  starts_at: null,
  ends_at: null,
  all_day: false,
  planned_on: null,
  link_count: 0,
  source: null,
  calendar_id: null,
  missing_since: null,
  slot: null,
  servings: null,
  thumbnail_path: null,
  board_name: null,
  column_name: null,
  ...over,
});

const event = (over: Partial<AgendaRow>) =>
  row({ kind: "event", source: "manual", calendar_id: ID(9), ...over });
const deadline = (due: string) => row({ kind: "deadline", starts_at: due });
const meal = (over: Partial<AgendaRow>) =>
  row({ kind: "meal", slot: "dinner", servings: 4, ...over });

describe("timed events", () => {
  it("shows summer time as wall-clock time in the user's zone", () => {
    const item = mapAgendaRow(
      event({ starts_at: "2026-10-14T07:00:00Z", ends_at: "2026-10-14T08:30:00Z", link_count: 2 }),
      AMS,
    );
    expect(item).toMatchObject({
      kind: "event",
      start: "2026-10-14T09:00:00",
      end: "2026-10-14T10:30:00",
      allDay: false,
      linkCount: 2,
    });
  });

  it("shows winter time with the +1 offset", () => {
    expect(localDateTime("2026-12-01T08:00:00Z", AMS)).toBe("2026-12-01T09:00:00");
  });

  it("crosses midnight into the next local day", () => {
    expect(localDateTime("2026-10-14T22:30:00Z", AMS)).toBe("2026-10-15T00:30:00");
  });

  it("follows the clocks back on 25 October 2026", () => {
    expect(localDateTime("2026-10-25T00:30:00Z", AMS)).toBe("2026-10-25T02:30:00");
    expect(localDateTime("2026-10-25T01:30:00Z", AMS)).toBe("2026-10-25T02:30:00");
    expect(localDateTime("2026-10-25T02:30:00Z", AMS)).toBe("2026-10-25T03:30:00");
  });

  it("keeps sync metadata", () => {
    const item = mapAgendaRow(
      event({
        source: "sync",
        starts_at: "2026-10-14T07:00:00Z",
        ends_at: "2026-10-14T07:00:00Z",
        missing_since: "2026-10-10T00:00:00Z",
      }),
      AMS,
    );
    expect(item).toMatchObject({
      source: "sync",
      calendarId: ID(9),
      missingSince: "2026-10-10T00:00:00Z",
    });
  });
});

describe("all-day events", () => {
  it("reads the stored UTC date, not the local midnight", () => {
    const item = mapAgendaRow(
      event({ all_day: true, starts_at: "2026-10-14T00:00:00Z", ends_at: "2026-10-15T00:00:00Z" }),
      "America/New_York",
    );
    expect(item).toMatchObject({ allDay: true, start: "2026-10-14", end: "2026-10-15" });
  });

  it("is a single day when the end does not pass the start", () => {
    const item = mapAgendaRow(
      event({ all_day: true, starts_at: "2026-10-14T00:00:00Z", ends_at: "2026-10-14T00:00:00Z" }),
      AMS,
    );
    expect(item).toMatchObject({ allDay: true, start: "2026-10-14", end: null });
  });

  it("keeps a multi-day span with an exclusive end", () => {
    const item = mapAgendaRow(
      event({ all_day: true, starts_at: "2026-10-14T00:00:00Z", ends_at: "2026-10-17T00:00:00Z" }),
      AMS,
    );
    expect(item).toMatchObject({ start: "2026-10-14", end: "2026-10-17" });
  });
});

describe("meals", () => {
  it("planned on a day is an all-day date", () => {
    const item = mapAgendaRow(meal({ planned_on: "2026-10-16", thumbnail_path: "a/b.webp" }), AMS);
    expect(item).toMatchObject({
      kind: "meal",
      allDay: true,
      start: "2026-10-16",
      end: null,
      slot: "dinner",
      servings: 4,
      thumbnailPath: "a/b.webp",
    });
  });

  it("takes its time from the attached event", () => {
    const item = mapAgendaRow(
      meal({ starts_at: "2026-10-14T16:00:00Z", ends_at: "2026-10-14T18:00:00Z" }),
      AMS,
    );
    expect(item).toMatchObject({
      allDay: false,
      start: "2026-10-14T18:00:00",
      end: "2026-10-14T20:00:00",
    });
  });

  it("takes the date of an attached all-day event", () => {
    const item = mapAgendaRow(
      meal({ all_day: true, starts_at: "2026-10-14T00:00:00Z", ends_at: "2026-10-15T00:00:00Z" }),
      AMS,
    );
    expect(item).toMatchObject({ allDay: true, start: "2026-10-14", end: "2026-10-15" });
  });
});

describe("deadlines", () => {
  it("is an all-day item with a prefixed id", () => {
    const item = mapAgendaRow(deadline("2026-10-14T10:00:00Z"), AMS);
    expect(item).toMatchObject({
      kind: "deadline",
      id: `deadline:${ID(1)}`,
      allDay: true,
      start: "2026-10-14",
      end: null,
    });
  });

  it("changes day exactly at local midnight in summer time", () => {
    expect(localDate("2026-10-14T21:59:59Z", AMS)).toBe("2026-10-14");
    expect(localDate("2026-10-14T22:00:00Z", AMS)).toBe("2026-10-15");
  });

  it("changes day exactly at local midnight in winter time", () => {
    expect(localDate("2026-12-14T22:59:59Z", AMS)).toBe("2026-12-14");
    expect(localDate("2026-12-14T23:00:00Z", AMS)).toBe("2026-12-15");
  });

  it("handles the spring-forward change on 29 March 2026", () => {
    expect(localDate("2026-03-28T23:30:00Z", AMS)).toBe("2026-03-29");
    expect(localDate("2026-03-29T22:30:00Z", AMS)).toBe("2026-03-30");
  });

  it("puts a UTC-midnight due date on the previous day west of UTC", () => {
    expect(localDate("2026-10-14T00:00:00Z", "America/New_York")).toBe("2026-10-13");
    expect(localDate("2026-10-14T00:00:00Z", AMS)).toBe("2026-10-14");
  });
});

describe("planned cards", () => {
  it("carries board and column", () => {
    const item = mapAgendaRow(
      row({
        kind: "planned_card",
        planned_on: "2026-10-18",
        board_name: "Huis",
        column_name: "Te doen",
      }),
      AMS,
    );
    expect(item).toMatchObject({
      kind: "planned_card",
      allDay: true,
      start: "2026-10-18",
      board: "Huis",
      column: "Te doen",
    });
  });
});

describe("mapAgendaRows", () => {
  it("gives a card planned and due on the same day two distinct ids", () => {
    const cardId = ID(5);
    const items = mapAgendaRows(
      [
        row({
          kind: "planned_card",
          id: cardId,
          planned_on: "2026-10-18",
          board_name: "B",
          column_name: "C",
        }),
        row({ kind: "deadline", id: cardId, starts_at: "2026-10-18T10:00:00Z" }),
      ],
      AMS,
    );
    expect(new Set(items.map((i) => i.id)).size).toBe(2);
  });

  it("sorts by day, all-day first, then time", () => {
    const items = mapAgendaRows(
      [
        event({
          id: ID(1),
          title: "Laat",
          starts_at: "2026-10-14T17:00:00Z",
          ends_at: "2026-10-14T18:00:00Z",
        }),
        event({
          id: ID(2),
          title: "Vroeg",
          starts_at: "2026-10-14T06:00:00Z",
          ends_at: "2026-10-14T07:00:00Z",
        }),
        deadline("2026-10-14T10:00:00Z"),
        meal({ id: ID(3), planned_on: "2026-10-13" }),
      ],
      AMS,
    );
    expect(items.map((i) => i.kind)).toEqual(["meal", "deadline", "event", "event"]);
    expect(items.map((i) => i.title).slice(2)).toEqual(["Vroeg", "Laat"]);
  });

  it("rejects a malformed row", () => {
    expect(() => mapAgendaRows([{ kind: "event" }], AMS)).toThrow();
  });

  it("rejects an event row without its event fields", () => {
    expect(() => mapAgendaRow(event({ starts_at: null }), AMS)).toThrow();
  });
});
