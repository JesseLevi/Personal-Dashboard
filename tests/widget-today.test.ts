import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildWidgetDay, refreshAfter, widgetRange } from "../lib/widget/day";
import { widgetColor } from "../lib/widget/colors";
import { outcomeToHttp, parseBearerToken } from "../lib/widget/http";
import { widgetDaySchema } from "../lib/widget/contract";
import { WIDGET_SCRIPT_VERSION } from "../lib/widget/script-version";

const TZ = "Europe/Amsterdam";
// 2026-10-30 11:00 in Amsterdam (CET, UTC+1).
const NOW = new Date("2026-10-30T10:00:00Z");
const CAL = "6f1c9d52-0f6e-4c43-9d3b-2f0a1b7c8e11";

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

const row = (overrides: Record<string, unknown>) => ({
  kind: "event",
  id: id(),
  title: "Item",
  starts_at: null,
  ends_at: null,
  all_day: false,
  planned_on: null,
  link_count: 0,
  source: "manual",
  calendar_id: CAL,
  missing_since: null,
  slot: null,
  servings: null,
  thumbnail_path: null,
  board_name: null,
  column_name: null,
  series_id: null,
  color: "violet",
  ...overrides,
});

const event = (title: string, starts_at: string, ends_at: string | null) => row({ title, starts_at, ends_at });
const build = (rows: unknown[], now = NOW, locale: "nl" | "en" = "nl") => buildWidgetDay({ rows, locale, timeZone: TZ, now });
const titles = (items: { title: string }[]) => items.map((i) => i.title);

describe("widgetRange", () => {
  it("runs from the start of today to the end of tomorrow in the zone", () => {
    expect(widgetRange(NOW, TZ)).toEqual({
      today: "2026-10-30",
      from: "2026-10-29T23:00:00.000Z",
      to: "2026-10-31T23:00:00.000Z",
    });
  });

  it("uses the date of the zone, not of UTC, around midnight", () => {
    const late = new Date("2026-10-30T23:30:00Z");
    expect(widgetRange(late, TZ).today).toBe("2026-10-31");
    expect(widgetRange(late, "America/New_York").today).toBe("2026-10-30");
  });
});

describe("rest of today", () => {
  it("keeps an event until it has ended, drops it afterwards", () => {
    const rows = [
      event("Voorbij", "2026-10-30T07:00:00Z", "2026-10-30T09:59:00Z"),
      event("Bezig", "2026-10-30T09:30:00Z", "2026-10-30T10:30:00Z"),
      event("Straks", "2026-10-30T13:00:00Z", "2026-10-30T14:00:00Z"),
    ];
    expect(titles(build(rows).today)).toEqual(["Bezig", "Straks"]);
  });

  it("drops an event that ends exactly now", () => {
    expect(build([event("Net klaar", "2026-10-30T09:00:00Z", "2026-10-30T10:00:00Z")]).today).toEqual([]);
  });

  it("keeps all-day events, meals and planned cards the whole day, sorted before timed items", () => {
    const rows = [
      event("Later", "2026-10-30T15:00:00Z", "2026-10-30T16:00:00Z"),
      row({ kind: "meal", title: "Soep", planned_on: "2026-10-30", slot: "dinner", servings: 2, calendar_id: null, source: null, color: null }),
      row({ title: "Verjaardag", starts_at: "2026-10-30T00:00:00Z", ends_at: "2026-10-31T00:00:00Z", all_day: true }),
      row({ kind: "planned_card", title: "Kaart", planned_on: "2026-10-30", board_name: "B", column_name: "C", calendar_id: null, source: null, color: null }),
    ];
    const { today } = build(rows);
    expect(today.map((i) => [i.kind, i.allDay])).toEqual([
      ["event", true],
      ["card", true],
      ["meal", true],
      ["event", false],
    ]);
    expect(today.find((i) => i.kind === "meal")?.slotLabel).toBe("Diner");
  });

  it("keeps a deadline until it is due", () => {
    const rows = [
      row({ kind: "deadline", title: "Open", starts_at: "2026-10-30T12:00:00Z", calendar_id: null, source: null, color: null }),
      row({ kind: "deadline", title: "Verlopen", starts_at: "2026-10-30T09:00:00Z", calendar_id: null, source: null, color: null }),
    ];
    const { today } = build(rows);
    expect(titles(today)).toEqual(["Open"]);
    expect(today[0]).toMatchObject({ kind: "deadline", timeLabel: "13:00", allDay: false });
  });

  it("handles items around midnight in the zone", () => {
    const lateNow = new Date("2026-10-30T22:50:00Z"); // 23:50 in Amsterdam
    const rows = [
      event("Over middernacht", "2026-10-30T22:00:00Z", "2026-10-30T23:30:00Z"),
      event("Morgen vroeg", "2026-10-30T23:15:00Z", "2026-10-31T00:00:00Z"),
    ];
    const day = build(rows, lateNow);
    expect(day.date).toBe("2026-10-30");
    expect(titles(day.today)).toEqual(["Over middernacht"]);
    expect(titles(day.tomorrow)).toEqual(["Morgen vroeg"]);

    const after = build(rows, new Date("2026-10-30T23:10:00Z")); // 00:10 on the 31st
    expect(after.date).toBe("2026-10-31");
    expect(titles(after.today)).toEqual(["Over middernacht", "Morgen vroeg"]);
  });
});

describe("tomorrow", () => {
  it("lists at most three items of tomorrow", () => {
    const rows = ["07", "08", "09", "10"].map((h) => event(`E${h}`, `2026-10-31T${h}:00:00Z`, `2026-10-31T${h}:30:00Z`));
    const { tomorrow } = build(rows);
    expect(titles(tomorrow)).toEqual(["E07", "E08", "E09"]);
    expect(tomorrow.every((i) => i.date === "2026-10-31")).toBe(true);
  });

  it("does not repeat a timed event that started today", () => {
    expect(build([event("Nachtdienst", "2026-10-30T20:00:00Z", "2026-10-31T06:00:00Z")]).tomorrow).toEqual([]);
  });
});

describe("refreshAfter", () => {
  const item = (startsAt: string | null, endsAt: string | null) =>
    ({ startsAt, endsAt }) as Parameters<typeof refreshAfter>[1][number];

  it("waits for the next end or start", () => {
    expect(refreshAfter(NOW, [item("2026-10-30T09:00:00Z", "2026-10-30T10:12:00Z")])).toBe("2026-10-30T10:12:00.000Z");
    expect(refreshAfter(NOW, [item("2026-10-30T10:20:00Z", "2026-10-30T11:00:00Z")])).toBe("2026-10-30T10:20:00.000Z");
  });

  it("is at least 5 and at most 30 minutes away", () => {
    expect(refreshAfter(NOW, [item("2026-10-30T09:00:00Z", "2026-10-30T10:01:00Z")])).toBe("2026-10-30T10:05:00.000Z");
    expect(refreshAfter(NOW, [item("2026-10-30T09:00:00Z", "2026-10-30T13:00:00Z")])).toBe("2026-10-30T10:30:00.000Z");
    expect(refreshAfter(NOW, [])).toBe("2026-10-30T10:30:00.000Z");
  });
});

describe("contract", () => {
  const rows = [
    event("Standup", "2026-10-30T13:00:00Z", "2026-10-30T13:30:00Z"),
    row({ kind: "meal", title: "Soep", planned_on: "2026-10-30", slot: "lunch", servings: 2, calendar_id: null, source: null, color: null }),
  ];

  it("fills the labels in the member's locale, with an ICU plural", () => {
    const nl = build(rows).labels;
    expect(nl).toMatchObject({ tomorrow: "Morgen", allDay: "Hele dag", remaining: "2 items te gaan", update: "Bijgewerkt 11:00" });
    expect(nl.dateLong).toBe("vrijdag 30 oktober");
    const en = build(rows.slice(0, 1), NOW, "en").labels;
    expect(en).toMatchObject({ tomorrow: "Tomorrow", remaining: "1 item to go" });
    expect(en.dateLong).toBe("Friday, October 30");
  });

  it("passes the schema and carries the script version", () => {
    const day = build(rows);
    expect(widgetDaySchema.safeParse(day).success).toBe(true);
    expect(day).toMatchObject({ version: 1, scriptVersion: WIDGET_SCRIPT_VERSION, date: "2026-10-30", locale: "nl" });
    expect(day.today[1]).toMatchObject({
      kind: "event",
      title: "Standup",
      timeLabel: "14:00",
      endLabel: "14:30",
      color: widgetColor("violet"),
      startsAt: "2026-10-30T13:00:00Z",
    });
  });

  it("takes colours from the event tokens", () => {
    expect(widgetColor("red")).toEqual({ light: "#FB2C36", dark: "#FF6467" });
  });
});

describe("Authorization header", () => {
  const token = `atlas_wgt_${"A".repeat(43)}`;

  it("accepts a strict bearer token", () => {
    expect(parseBearerToken(`Bearer ${token}`)).toBe(token);
    expect(parseBearerToken(`Bearer atlas_wgt_${"aZ09-_".repeat(7)}a`)).not.toBeNull();
  });

  it("rejects everything else", () => {
    for (const header of [
      null,
      "",
      token,
      `bearer ${token}`,
      `Bearer  ${token}`,
      `Bearer ${token} `,
      `Bearer ${token}x`,
      `Bearer atlas_wgt_${"A".repeat(42)}`,
      `Bearer atlas_wgt_${"A".repeat(42)}+`,
      `Bearer xatlas_wgt_${"A".repeat(43)}`,
      "Bearer sbp_abc",
    ]) {
      expect(parseBearerToken(header)).toBeNull();
    }
  });
});

describe("status mapping", () => {
  it("maps outcomes to HTTP codes", () => {
    expect(outcomeToHttp("ok")).toBe(200);
    expect(outcomeToHttp("unauthorized")).toBe(401);
    expect(outcomeToHttp("rate_limited")).toBe(429);
    expect(outcomeToHttp("unavailable")).toBe(503);
    expect(outcomeToHttp("error")).toBe(500);
  });
});

describe("widget.* messages", () => {
  const read = (locale: string) => JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")).widget;
  const keys = (value: unknown, prefix = ""): string[] =>
    typeof value === "object" && value !== null
      ? Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
      : [prefix];

  it("has the same keys in nl and en", () => {
    expect(keys(read("nl")).sort()).toEqual(keys(read("en")).sort());
  });
});
