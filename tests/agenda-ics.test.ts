import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IcsError, parseIcs, syncWindow, type SyncEvent } from "@/lib/agenda/ics";

const NOW = new Date("2026-10-14T12:00:00Z");
const window = syncWindow(NOW);

function parseFixture(name: string): SyncEvent[] {
  return parseIcs(readFileSync(join(__dirname, "fixtures/ics", name), "utf8"), window);
}
const byId = (events: SyncEvent[], id: string) => events.find((e) => e.externalId === id);
const byTitle = (events: SyncEvent[], title: string) => events.find((e) => e.title === title);

describe("syncWindow", () => {
  it("runs from 30 days back to 400 days ahead", () => {
    expect(window.from.toISOString()).toBe("2026-09-14T12:00:00.000Z");
    expect(window.to.toISOString()).toBe("2027-11-18T12:00:00.000Z");
  });
});

describe("Outlook export with Windows time zone names", () => {
  const events = parseFixture("outlook.ics");

  it("reads the VTIMEZONE, so summer and winter time differ", () => {
    expect(byTitle(events, "Sprintplanning")).toMatchObject({
      startsAt: "2026-10-20T07:00:00.000Z",
      endsAt: "2026-10-20T08:30:00.000Z",
      allDay: false,
      location: "Vergaderzaal 3",
    });
    expect(byTitle(events, "Na de zomertijd")?.startsAt).toBe("2026-10-26T08:00:00.000Z");
  });

  it("follows the spring change too", () => {
    expect(byTitle(events, "Voor de zomertijd")?.startsAt).toBe("2027-03-26T08:00:00.000Z");
    expect(byTitle(events, "Na de lente")?.startsAt).toBe("2027-03-29T07:00:00.000Z");
  });

  it("uses the UID as external id for a single event and unescapes text", () => {
    const sprint = byTitle(events, "Sprintplanning");
    expect(sprint?.externalId).toBe("040000008200E00074C5B7101A82E00800000000outlook-1");
    expect(sprint?.description).toBe("Agenda:\n- backlog\n- planning");
  });
});

describe("Outlook without VTIMEZONE", () => {
  const events = parseFixture("outlook-no-vtimezone.ics");

  it("maps Windows names to IANA zones", () => {
    expect(byTitle(events, "Zonder tijdzonedefinitie")?.startsAt).toBe("2026-10-20T07:00:00.000Z");
    expect(byTitle(events, "Na de zomertijd zonder definitie")?.startsAt).toBe("2026-10-26T08:00:00.000Z");
  });

  it("reads floating times and unknown zones in the Agenda zone", () => {
    expect(byTitle(events, "Zwevende tijd")?.startsAt).toBe("2026-10-20T12:00:00.000Z");
    expect(byTitle(events, "Onbekende zone")?.startsAt).toBe("2026-10-20T14:00:00.000Z");
  });
});

describe("Google feed", () => {
  const events = parseFixture("google.ics");

  it("reads UTC times", () => {
    expect(byId(events, "google-single@google.com")).toMatchObject({
      startsAt: "2026-10-15T18:00:00.000Z",
      endsAt: "2026-10-15T19:00:00.000Z",
      title: "Voetbaltraining",
    });
  });

  it("drops events that start before the window", () => {
    expect(byId(events, "google-old@google.com")).toBeUndefined();
  });

  const series = events.filter((e) => e.externalId.startsWith("google-series@google.com|"));

  it("expands a series with EXDATE and a cancelled occurrence", () => {
    expect(series.map((e) => e.startsAt).sort()).toEqual([
      "2026-10-14T17:00:00.000Z",
      "2026-10-22T09:00:00.000Z",
      "2026-11-04T18:00:00.000Z",
      "2026-11-18T18:00:00.000Z",
    ]);
  });

  it("applies a moved occurrence and keys it on the original start", () => {
    const moved = byId(events, "google-series@google.com|2026-10-21T17:00:00.000Z");
    expect(moved).toMatchObject({ title: "Gitaarles (verzet)", startsAt: "2026-10-22T09:00:00.000Z" });
  });

  it("keeps ids stable between parses", () => {
    const again = parseFixture("google.ics");
    expect(again.map((e) => e.externalId).sort()).toEqual(events.map((e) => e.externalId).sort());
    expect(again.map((e) => e.contentHash).sort()).toEqual(events.map((e) => e.contentHash).sort());
  });
});

describe("iCloud feed", () => {
  const events = parseFixture("icloud.ics");

  it("stores all-day events as UTC dates with an exclusive end", () => {
    expect(byTitle(events, "Verjaardag oma")).toMatchObject({
      allDay: true,
      startsAt: "2026-10-30T00:00:00.000Z",
      endsAt: "2026-10-31T00:00:00.000Z",
    });
    expect(byTitle(events, "Vakantie")).toMatchObject({
      allDay: true,
      startsAt: "2026-11-01T00:00:00.000Z",
      endsAt: "2026-11-08T00:00:00.000Z",
    });
  });

  it("gives an all-day event without end a single day", () => {
    expect(byTitle(events, "Zonder einddatum")).toMatchObject({
      allDay: true,
      startsAt: "2026-11-10T00:00:00.000Z",
      endsAt: "2026-11-11T00:00:00.000Z",
    });
  });

  it("keeps the real length over the clock change", () => {
    expect(byTitle(events, "Nacht van de klokwissel")).toMatchObject({
      startsAt: "2026-10-24T23:00:00.000Z",
      endsAt: "2026-10-25T03:00:00.000Z",
    });
  });

  it("expands a monthly series inside the window, each in local noon", () => {
    const monthly = events.filter((e) => e.title === "Elke maand");
    expect(monthly).toHaveLength(14);
    expect(monthly.map((e) => e.startsAt).sort()[0]).toBe("2026-10-01T10:00:00.000Z");
    expect(byTitle(monthly, "Elke maand")).toBeDefined();
    expect(monthly.find((e) => e.startsAt.startsWith("2026-11-01"))?.startsAt).toBe("2026-11-01T11:00:00.000Z");
    expect(monthly.find((e) => e.startsAt.startsWith("2027-04-01"))?.startsAt).toBe("2027-04-01T10:00:00.000Z");
  });
});

describe("unreadable input", () => {
  it("rejects text that is not a calendar", () => {
    expect(() => parseIcs("<html>login</html>", window)).toThrow(IcsError);
    expect(() => parseIcs("", window)).toThrow(IcsError);
  });

  it("rejects a broken calendar", () => {
    expect(() => parseIcs("BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY", window)).toThrow(IcsError);
  });

  it("returns no events for a calendar without events", () => {
    expect(parseIcs("BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n", window)).toEqual([]);
  });

  it("skips an event without a start and keeps the rest", () => {
    const text = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:a
SUMMARY:Geen start
END:VEVENT
BEGIN:VEVENT
UID:b
SUMMARY:Wel
DTSTART:20261020T100000Z
DTEND:20261020T110000Z
END:VEVENT
END:VCALENDAR`;
    expect(parseIcs(text, window).map((e) => e.title)).toEqual(["Wel"]);
  });

  it("caps long descriptions at 2000 characters", () => {
    const text = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:a
SUMMARY:Lang
DTSTART:20261020T100000Z
DTEND:20261020T110000Z
DESCRIPTION:${"x".repeat(5000)}
END:VEVENT
END:VCALENDAR`;
    expect(parseIcs(text, window)[0].description).toHaveLength(2000);
  });

  it("changes the hash when the content changes", () => {
    const make = (summary: string) =>
      parseIcs(
        `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:a\nSUMMARY:${summary}\nDTSTART:20261020T100000Z\nDTEND:20261020T110000Z\nEND:VEVENT\nEND:VCALENDAR`,
        window,
      )[0];
    expect(make("een").contentHash).toBe(make("een").contentHash);
    expect(make("een").contentHash).not.toBe(make("twee").contentHash);
  });

  it("stops with too_large when all series together need too many iterations", () => {
    const series = Array.from(
      { length: 20 },
      (_, i) => `BEGIN:VEVENT\nUID:s${i}\nSUMMARY:Dagelijks ${i}\nDTSTART:20000101T100000Z\nDTEND:20000101T110000Z\nRRULE:FREQ=DAILY\nEND:VEVENT`,
    ).join("\n");
    const text = `BEGIN:VCALENDAR\nVERSION:2.0\n${series}\nEND:VCALENDAR`;
    expect(() => parseIcs(text, window)).toThrowError(expect.objectContaining({ code: "too_large" }));
  }, 20_000);
});
