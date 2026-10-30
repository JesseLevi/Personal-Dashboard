import { createTranslator } from "next-intl";
import { z } from "zod";
import en from "@/messages/en.json";
import nl from "@/messages/nl.json";
import { KIND_COLORS, FALLBACK_EVENT_COLOR, isAgendaColor, type AgendaColor } from "@/lib/agenda/colors";
import { agendaRowSchema, localDate, mapAgendaRow, type AgendaRow } from "@/lib/agenda/map";
import { addDays, wallClockToUtc } from "@/lib/agenda/time";
import { widgetDaySchema, type WidgetDay, type WidgetItem, type WidgetLocale } from "@/lib/widget/contract";
import { widgetColor } from "@/lib/widget/colors";
import { WIDGET_SCRIPT_VERSION } from "@/lib/widget/script-version";

// Pure half of GET /api/widget/today: turns the rows of public.widget_today into
// the day contract (ADR-0047 §2, §7). Kept free of server-only so vitest can import it.

const MINUTE_MS = 60_000;
const MIN_REFRESH_MS = 5 * MINUTE_MS;
const MAX_REFRESH_MS = 30 * MINUTE_MS;
const TOMORROW_MAX = 3;

const MESSAGES = { nl, en } as const;
const KIND_ORDER = { deadline: 0, event: 1, card: 2, meal: 3 } as const;

export function toWidgetLocale(value: unknown): WidgetLocale {
  return value === "en" ? "en" : "nl";
}

/** The bounds the RPC is called with: start of today until the end of tomorrow, in `timeZone`. */
export function widgetRange(now: Date, timeZone: string) {
  const today = localDate(now.toISOString(), timeZone);
  return {
    today,
    from: wallClockToUtc(`${today}T00:00:00`, timeZone),
    to: wallClockToUtc(`${addDays(today, 2)}T00:00:00`, timeZone),
  };
}

function timeLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

const rowSchema = agendaRowSchema.extend({ color: z.string().nullish() });

type Row = AgendaRow & { color?: string | null };

type Bucket = { item: WidgetItem; sortStart: string | null };

function itemFor(row: Row, day: string, now: Date, timeZone: string, today: boolean, slot: (key: string) => string): Bucket | null {
  const mapped = mapAgendaRow(row, timeZone);
  const dayStart = wallClockToUtc(`${day}T00:00:00`, timeZone);
  const dayEnd = wallClockToUtc(`${addDays(day, 1)}T00:00:00`, timeZone);
  const calendarColor: AgendaColor =
    row.kind === "event" ? (isAgendaColor(row.color) ? row.color : FALLBACK_EVENT_COLOR) : KIND_COLORS[row.kind];
  const color = widgetColor(calendarColor);
  const base = { title: row.title, color, date: day, slotLabel: null, endLabel: null, timeLabel: null, startsAt: null, endsAt: null };

  if (row.kind === "deadline") {
    const due = row.starts_at!;
    if (localDate(due, timeZone) !== day || (today && new Date(due) <= now)) return null;
    return { sortStart: due, item: { ...base, kind: "deadline", allDay: false, timeLabel: timeLabel(due, timeZone), startsAt: due } };
  }

  if (row.kind === "meal" || row.kind === "planned_card") {
    if (mapped.start !== day) return null;
    const item: WidgetItem =
      row.kind === "meal"
        ? { ...base, kind: "meal", allDay: true, slotLabel: slot(row.slot ?? "") }
        : { ...base, kind: "card", allDay: true };
    return { sortStart: null, item };
  }

  if (mapped.allDay) {
    const last = mapped.end ?? addDays(mapped.start, 1);
    if (mapped.start > day || day >= last) return null;
    return { sortStart: null, item: { ...base, kind: "event", allDay: true } };
  }

  const start = row.starts_at!;
  const end = row.ends_at ?? start;
  if (new Date(start) >= new Date(dayEnd) || new Date(end) < new Date(dayStart)) return null;
  if (today ? new Date(end) <= now : new Date(start) < new Date(dayStart)) return null;
  return {
    sortStart: start,
    item: {
      ...base,
      kind: "event",
      allDay: false,
      timeLabel: timeLabel(start, timeZone),
      endLabel: row.ends_at && row.ends_at !== start ? timeLabel(row.ends_at, timeZone) : null,
      startsAt: start,
      endsAt: row.ends_at,
    },
  };
}

function sortBuckets(buckets: Bucket[]): WidgetItem[] {
  return buckets
    .sort(
      (a, b) =>
        Number(b.item.allDay) - Number(a.item.allDay) ||
        (a.sortStart ?? "").localeCompare(b.sortStart ?? "") ||
        KIND_ORDER[a.item.kind] - KIND_ORDER[b.item.kind] ||
        a.item.title.localeCompare(b.item.title),
    )
    .map((bucket) => bucket.item);
}

/** Next end or start of a timed item, but at least 5 and at most 30 minutes from now. */
export function refreshAfter(now: Date, items: readonly WidgetItem[]): string {
  const moments = items.flatMap((item) => [item.startsAt, item.endsAt ?? item.startsAt]).flatMap((iso) => (iso ? [Date.parse(iso)] : []));
  const next = Math.min(...moments.filter((ms) => ms > now.getTime()), Infinity);
  const wait = Math.min(Math.max(next - now.getTime(), MIN_REFRESH_MS), MAX_REFRESH_MS);
  return new Date(now.getTime() + wait).toISOString();
}

export function buildWidgetDay(input: { rows: unknown; locale: WidgetLocale; timeZone: string; now: Date }): WidgetDay {
  const { locale, timeZone, now } = input;
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "widget" });
  const { today } = widgetRange(now, timeZone);
  const tomorrow = addDays(today, 1);
  const rows = rowSchema.array().parse(input.rows) as Row[];
  const slot = (key: string) => (key ? t(`slots.${key as "lunch"}`) : "");

  const build = (day: string, isToday: boolean) =>
    sortBuckets(rows.flatMap((row) => itemFor(row, day, now, timeZone, isToday, slot) ?? []));

  const todayItems = build(today, true);
  const tomorrowItems = build(tomorrow, false).slice(0, TOMORROW_MAX);
  const instant = new Date(`${today}T12:00:00Z`);
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).format(instant);

  return widgetDaySchema.parse({
    version: 1,
    scriptVersion: WIDGET_SCRIPT_VERSION,
    generatedAt: now.toISOString(),
    date: today,
    locale,
    labels: {
      dateLong: fmt({ weekday: "long", day: "numeric", month: "long" }),
      dateShort: fmt({ weekday: "short", day: "numeric", month: "short" }),
      empty: t("empty"),
      tomorrow: t("tomorrow"),
      remaining: t("remaining", { count: todayItems.length }),
      sectionEvents: t("sectionEvents"),
      sectionMeals: t("sectionMeals"),
      sectionCards: t("sectionCards"),
      allDay: t("allDay"),
      updatedAt: t("updatedAt", { time: timeLabel(now.toISOString(), timeZone) }),
      updateAvailable: t("updateAvailable"),
    },
    today: todayItems,
    tomorrow: tomorrowItems,
    refreshAfter: refreshAfter(now, todayItems),
  });
}
