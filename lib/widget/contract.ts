import { z } from "zod";

// Day contract v1 of GET /api/widget/today (ADR-0047 §2). Validated before it is sent.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const widgetItemSchema = z.object({
  kind: z.enum(["event", "meal", "card", "deadline"]),
  title: z.string(),
  timeLabel: z.string().nullable(),
  endLabel: z.string().nullable(),
  allDay: z.boolean(),
  slotLabel: z.string().nullable(),
  color: z.object({ light: z.string(), dark: z.string() }).nullable(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  date: isoDate,
});

export const widgetDaySchema = z.object({
  version: z.literal(1),
  scriptVersion: z.number().int().positive(),
  generatedAt: z.string(),
  date: isoDate,
  locale: z.enum(["nl", "en"]),
  labels: z.object({
    dateLong: z.string(),
    dateShort: z.string(),
    empty: z.string(),
    tomorrow: z.string(),
    remaining: z.string(),
    sectionEvents: z.string(),
    sectionMeals: z.string(),
    sectionCards: z.string(),
    allDay: z.string(),
    update: z.string(),
  }),
  today: z.array(widgetItemSchema),
  tomorrow: z.array(widgetItemSchema).max(3),
  refreshAfter: z.string(),
});

export type WidgetItem = z.infer<typeof widgetItemSchema>;
export type WidgetDay = z.infer<typeof widgetDaySchema>;
export type WidgetLocale = WidgetDay["locale"];

/** What `public.widget_today` answers (ADR-0047 §4). */
export const widgetTodayResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), locale: z.string().nullish(), items: z.array(z.unknown()) }),
  z.object({ status: z.literal("unauthorized") }),
  z.object({ status: z.literal("rate_limited") }),
]);
