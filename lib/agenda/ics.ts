import { createHash } from "node:crypto";
import ICAL from "ical.js";
import { AGENDA_TIME_ZONE, wallClockToUtc, zoneOffsetMs } from "@/lib/agenda/time";

// Pure half of the ICS import (ADR-0037 §5, §9): text in, the events inside the
// sync window out. No network, no database. Recurrences are expanded here with
// ical.js (RecurExpansion, EXDATE and RECURRENCE-ID exceptions through
// relateException); the app never evaluates an RRULE itself.
//
// Identity: `external_id` is the UID for a single event and `UID|<original
// start of that occurrence>` for an occurrence, so a moved occurrence keeps its
// id. All-day events are UTC midnight (dates), as the Agenda stores them.
// Time zones: a VTIMEZONE in the file wins; a TZID without one is read as an
// IANA name or a Windows name (Outlook); floating times use the Agenda zone.

export type IcsErrorCode = "unparsable" | "too_large";

export class IcsError extends Error {
  constructor(readonly code: IcsErrorCode) {
    super(code);
    this.name = "IcsError";
  }
}

export interface SyncEvent {
  externalId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
  contentHash: string;
}

export const SYNC_PAST_DAYS = 30;
export const SYNC_FUTURE_DAYS = 400;
export const DESCRIPTION_MAX = 2000;
const TITLE_MAX = 200;
const LOCATION_MAX = 200;
const MAX_EVENTS = 20_000;
const MAX_OCCURRENCES_PER_SERIES = 20_000;
const DAY_MS = 86_400_000;

export function syncWindow(now: Date): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() - SYNC_PAST_DAYS * DAY_MS),
    to: new Date(now.getTime() + SYNC_FUTURE_DAYS * DAY_MS),
  };
}

// Windows zone names (Outlook) to IANA. An unknown name falls back to the Agenda zone.
const WINDOWS_ZONES: Record<string, string> = {
  "W. Europe Standard Time": "Europe/Amsterdam",
  "Romance Standard Time": "Europe/Paris",
  "Central Europe Standard Time": "Europe/Budapest",
  "Central European Standard Time": "Europe/Warsaw",
  "GMT Standard Time": "Europe/London",
  "GTB Standard Time": "Europe/Bucharest",
  "FLE Standard Time": "Europe/Kiev",
  "E. Europe Standard Time": "Europe/Chisinau",
  "Russian Standard Time": "Europe/Moscow",
  "Turkey Standard Time": "Europe/Istanbul",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "UTC": "UTC",
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "Pacific Standard Time": "America/Los_Angeles",
  "Alaskan Standard Time": "America/Anchorage",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "Atlantic Standard Time": "America/Halifax",
  "E. South America Standard Time": "America/Sao_Paulo",
  "SA Pacific Standard Time": "America/Bogota",
  "South Africa Standard Time": "Africa/Johannesburg",
  "Egypt Standard Time": "Africa/Cairo",
  "Israel Standard Time": "Asia/Jerusalem",
  "Arabian Standard Time": "Asia/Dubai",
  "India Standard Time": "Asia/Kolkata",
  "Singapore Standard Time": "Asia/Singapore",
  "China Standard Time": "Asia/Shanghai",
  "Tokyo Standard Time": "Asia/Tokyo",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "New Zealand Standard Time": "Pacific/Auckland",
};

function resolveZoneName(tzid: string): string {
  const candidate = WINDOWS_ZONES[tzid] ?? tzid;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return AGENDA_TIME_ZONE;
  }
}

// Offsets come from Intl, so DST follows the tz database of the runtime.
class IntlTimezone extends ICAL.Timezone {
  private readonly zone: string;
  constructor(tzid: string) {
    super({ tzid });
    this.zone = resolveZoneName(tzid);
  }
  override utcOffset(tt: ICAL.Time): number {
    const guess = Date.UTC(tt.year, tt.month - 1, tt.day, tt.hour, tt.minute, tt.second);
    const first = guess - zoneOffsetMs(guess, this.zone);
    const utc = guess - zoneOffsetMs(first, this.zone);
    return Math.round((guess - utc) / 1000);
  }
}

function registerZones(root: ICAL.Component, vevents: ICAL.Component[]): void {
  ICAL.TimezoneService.reset();
  for (const vtz of root.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(new ICAL.Timezone(vtz));
    } catch {
      // A broken definition falls through to the name lookup below.
    }
  }
  for (const vevent of vevents) {
    for (const name of ["dtstart", "dtend", "recurrence-id", "exdate", "rdate"]) {
      for (const prop of vevent.getAllProperties(name)) {
        const tzid = prop.getParameter("tzid");
        if (typeof tzid === "string" && tzid !== "" && !ICAL.TimezoneService.has(tzid)) {
          ICAL.TimezoneService.register(new IntlTimezone(tzid), tzid);
        }
      }
    }
  }
}

function toInstant(time: ICAL.Time): number {
  if (time.isDate) return Date.UTC(time.year, time.month - 1, time.day);
  if (time.zone === ICAL.Timezone.localTimezone || time.zone.tzid === "floating") {
    const p = (n: number) => String(n).padStart(2, "0");
    const local = `${time.year}-${p(time.month)}-${p(time.day)}T${p(time.hour)}:${p(time.minute)}:${p(time.second)}`;
    return Date.parse(wallClockToUtc(local));
  }
  return time.toUnixTime() * 1000;
}

const clean = (value: string | null | undefined, max: number): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed.slice(0, max);
};

function build(
  externalId: string,
  item: ICAL.Event,
  start: ICAL.Time,
  end: ICAL.Time,
): SyncEvent {
  const allDay = start.isDate;
  const startMs = toInstant(start);
  const endMs = Math.max(toInstant(end), startMs);
  const title = clean(item.summary, TITLE_MAX) ?? "—";
  const location = clean(item.location, LOCATION_MAX);
  const description = clean(item.description, DESCRIPTION_MAX);
  const startsAt = new Date(startMs).toISOString();
  const endsAt = new Date(endMs).toISOString();
  const contentHash = createHash("sha256")
    .update(JSON.stringify([title, startsAt, endsAt, allDay, location, description]))
    .digest("hex");
  return { externalId, title, startsAt, endsAt, allDay, location, description, contentHash };
}

function isCancelled(item: ICAL.Event): boolean {
  return String(item.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED";
}

/** The events whose start lies in [from, to). Throws IcsError when the text is not a calendar. */
export function parseIcs(text: string, window: { from: Date; to: Date }): SyncEvent[] {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new IcsError("unparsable");

  let root: ICAL.Component;
  try {
    const parsed = ICAL.parse(text);
    root = new ICAL.Component(Array.isArray(parsed[0]) ? parsed[0] : parsed);
  } catch {
    throw new IcsError("unparsable");
  }
  if (root.name !== "vcalendar") throw new IcsError("unparsable");

  const vevents = root.getAllSubcomponents("vevent");
  registerZones(root, vevents);

  const fromMs = window.from.getTime();
  const toMs = window.to.getTime();
  const inWindow = (ms: number) => ms >= fromMs && ms < toMs;

  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const vevent of vevents) {
    try {
      const event = new ICAL.Event(vevent);
      if (!event.uid || !event.startDate) continue;
      if (event.isRecurrenceException()) exceptions.push(event);
      else if (!masters.has(event.uid)) masters.set(event.uid, event);
    } catch {
      // One unreadable event does not sink the feed.
    }
  }

  const out = new Map<string, SyncEvent>();
  const add = (event: SyncEvent) => {
    if (!inWindow(Date.parse(event.startsAt))) return;
    out.set(event.externalId, event);
    if (out.size > MAX_EVENTS) throw new IcsError("too_large");
  };
  const recurrenceKey = (time: ICAL.Time) =>
    time.isDate ? time.toString() : new Date(toInstant(time)).toISOString();

  const orphans: ICAL.Event[] = [];
  for (const exception of exceptions) {
    const master = masters.get(exception.uid);
    if (master) master.relateException(exception);
    else orphans.push(exception);
  }

  for (const event of masters.values()) {
    try {
      if (!event.isRecurring()) {
        if (!isCancelled(event)) add(build(event.uid, event, event.startDate, event.endDate));
        continue;
      }
      const iterator = event.iterator();
      for (let n = 0; n < MAX_OCCURRENCES_PER_SERIES; n++) {
        const occurrence = iterator.next();
        if (!occurrence || toInstant(occurrence) >= toMs) break;
        const details = event.getOccurrenceDetails(occurrence);
        if (isCancelled(details.item)) continue;
        add(build(`${event.uid}|${recurrenceKey(occurrence)}`, details.item, details.startDate, details.endDate));
      }
    } catch (error) {
      if (error instanceof IcsError) throw error;
      // A series that cannot be expanded is skipped; the rest of the feed stays usable.
    }
  }

  // An exception whose series is not in the feed stands on its own.
  for (const event of orphans) {
    try {
      if (!isCancelled(event)) add(build(`${event.uid}|${recurrenceKey(event.recurrenceId)}`, event, event.startDate, event.endDate));
    } catch {
      // Skipped like an unreadable event.
    }
  }

  return [...out.values()];
}
