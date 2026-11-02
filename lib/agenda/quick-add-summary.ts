import { defaultEndTime, type QuickAddKind } from "@/lib/agenda/quick-add";
import type { RepeatChoice } from "@/lib/agenda/repeat";
import type { MealSlot } from "@/lib/agenda/types";

// The "Herkend" line of quick add (ADR-0041): the final values of the form, so a field the user changed by
// hand shows there as well. Pure; the labels come from the caller's translations.

export interface QuickAddSummaryValues {
  title: string;
  date: string;
  allDay: boolean;
  start: string;
  end: string;
  people: string;
  place: string;
  repeat: RepeatChoice;
  categoryId: string;
  moment: MealSlot;
  /** The picked recipe or card, if any: what the line shows for a meal or a to-do. */
  pickedTitle: string;
}

export interface QuickAddSummaryLabels {
  allDay: string;
  moment: (slot: MealSlot) => string;
  people: (names: string) => string;
  repeat: (choice: RepeatChoice) => string;
  /** The category's name, or null for the default calendar, which is not worth a mention. */
  category: (id: string) => string | null;
}

/** `vr 6 nov`: the weekday and day for a `YYYY-MM-DD` date in the user's language. */
export function formatSummaryDay(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`))
    .replace(/\.$/, "");
}

/** The parts of the line, in reading order; empty parts are left out. */
export function quickAddSummary(
  kind: QuickAddKind,
  values: QuickAddSummaryValues,
  labels: QuickAddSummaryLabels,
  locale: string,
): string[] {
  const day = values.date === "" ? "" : formatSummaryDay(values.date, locale);
  const parts: string[] = [];
  if (kind === "meal") {
    parts.push(values.pickedTitle, day, labels.moment(values.moment));
  } else if (kind === "todo") {
    parts.push(values.pickedTitle || values.title.trim(), day);
  } else {
    const names = values.people.split(",").map((name) => name.trim()).filter(Boolean).join(", ");
    const time = values.allDay
      ? labels.allDay
      : values.end === defaultEndTime(values.start) || values.end === ""
        ? values.start
        : `${values.start}–${values.end}`;
    parts.push(
      values.title.trim(),
      day,
      time,
      names ? labels.people(names) : "",
      values.place.trim(),
      values.repeat === "none" ? "" : labels.repeat(values.repeat),
      labels.category(values.categoryId) ?? "",
    );
  }
  return parts.filter((part) => part !== "");
}
