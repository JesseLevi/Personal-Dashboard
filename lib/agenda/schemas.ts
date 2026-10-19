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
  | "nothing-to-send"
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

// The repeat rule of a recurring own event (ADR-0042); `until` is inclusive, null = never ends.
export const repeatRuleSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.int().min(1).max(99),
  until: date.nullable(),
});

/** Which occurrences a change or delete reaches (ADR-0042 §5-6). */
export const seriesScopeSchema = z.enum(["this", "following", "all"]);

export type RepeatRule = z.infer<typeof repeatRuleSchema>;
export type SeriesScope = z.infer<typeof seriesScopeSchema>;

export const createEventSchema = eventFieldsSchema
  .extend({ calendarId: z.uuid().optional(), repeat: repeatRuleSchema.optional() })
  .refine(spanIsValid);

// `scope` is required for an occurrence of a series; `repeat` for the scopes that change the rule,
// and on a single event it turns that event into a series. `calendarId` is the category (ADR-0040):
// a different one moves the event, or the occurrences the scope reaches.
export const updateEventSchema = eventFieldsSchema
  .extend({
    id: z.uuid(),
    scope: seriesScopeSchema.optional(),
    repeat: repeatRuleSchema.optional(),
    calendarId: z.uuid().optional(),
  })
  .refine(spanIsValid);

// A new card from quick add: it lands in the favourite board's first column, planned on a day.
export const createPlannedCardSchema = z.object({
  title: z.string().trim().min(1).max(200),
  plannedFor: date,
});

export const moveEventSchema = span.extend({ id: z.uuid() }).refine(spanIsValid);

export const eventIdSchema = z.object({ id: z.uuid() });

export const deleteEventSchema = eventIdSchema.extend({ scope: seriesScopeSchema.optional() });

const mealSlot = z.enum(["breakfast", "lunch", "dinner", "snack"]);

// A meal plan sits on a day or on an event, never both (the table's check constraint).
export const createMealSchema = z
  .object({
    recipeId: z.uuid(),
    plannedOn: date.optional(),
    calendarEventId: z.uuid().optional(),
    slot: mealSlot.default("dinner"),
    servings: z.int().positive().max(999).optional(),
  })
  .refine((v) => (v.plannedOn === undefined) !== (v.calendarEventId === undefined));

export const updateMealSchema = z
  .object({
    id: z.uuid(),
    slot: mealSlot.optional(),
    servings: z.int().positive().max(999).optional(),
    plannedOn: date.optional(),
  })
  .refine((v) => v.slot !== undefined || v.servings !== undefined || v.plannedOn !== undefined);

export const mealIdSchema = z.object({ id: z.uuid() });

export const sendMealSchema = z.object({ id: z.uuid(), listId: z.uuid().optional() });

export const sendWeekSchema = z
  .object({ from: date, to: date, listId: z.uuid().optional() })
  .refine((v) => v.from < v.to);

export const rangeSchema = z
  .object({ from: date, to: date })
  .refine((v) => v.from < v.to);
