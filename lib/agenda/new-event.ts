import { localDateTime } from "@/lib/agenda/map";
import { AGENDA_TIME_ZONE, addDays } from "@/lib/agenda/time";
import type { AgendaSpan } from "@/lib/ui/agenda-calendar";

/** The default span of "+ Nieuw": the next full hour in the Agenda zone, one hour long. From 23:00 on it starts at midnight of the next day. */
export function nextFullHourSpan(now: Date = new Date()): AgendaSpan {
  const wall = localDateTime(now.toISOString(), AGENDA_TIME_ZONE);
  const date = wall.slice(0, 10);
  const nextHour = Number(wall.slice(11, 13)) + 1;
  const at = (day: string, hour: number) => `${day}T${String(hour).padStart(2, "0")}:00:00`;
  const startDay = nextHour >= 24 ? addDays(date, 1) : date;
  const start = nextHour % 24;
  return {
    start: at(startDay, start),
    end: start + 1 >= 24 ? at(addDays(startDay, 1), 0) : at(startDay, start + 1),
    allDay: false,
  };
}
