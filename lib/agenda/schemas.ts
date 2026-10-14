import { z } from "zod";

// Input of the Agenda server actions. Instants are UTC ISO strings: the page
// converts the calendar's wall-clock times first (lib/agenda/time.ts).

export type AgendaErrorCode =
  | "invalid-input"
  | "unauthenticated"
  | "not-found"
  | "read-only"
  | "already-linked"
  | "forbidden"
  | "generic";

export type AgendaActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: AgendaErrorCode };

const instant = z.iso.datetime({ offset: true });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const MIDNIGHT = /T00:00:00(\.000)?(Z|\+00:00)$/;

const span = z.object({ startsAt: instant, endsAt: instant, allDay: z.boolean() });

function spanIsValid(v: z.infer<typeof span>): boolean {
  if (Date.parse(v.endsAt) < Date.parse(v.startsAt)) return false;
  return !v.allDay || (MIDNIGHT.test(v.startsAt) && MIDNIGHT.test(v.endsAt));
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s))
    .nullable();

export const eventFieldsSchema = span.extend({
  title: z.string().trim().min(1).max(200),
  location: text(200),
  description: text(2000),
});

export const createEventSchema = eventFieldsSchema
  .extend({ calendarId: z.uuid().optional() })
  .refine(spanIsValid);

export const updateEventSchema = eventFieldsSchema.extend({ id: z.uuid() }).refine(spanIsValid);

export const moveEventSchema = span.extend({ id: z.uuid() }).refine(spanIsValid);

export const eventIdSchema = z.object({ id: z.uuid() });

export const rangeSchema = z
  .object({ from: date, to: date })
  .refine((v) => v.from < v.to);
