import { z } from "zod";
import { AGENDA_COLORS, type AgendaColor } from "@/lib/agenda/colors";

// Pure half of calendar management (#490): input schemas, URL normalisation and
// the views the panel shows. Safe to import from client components. The secret
// URL appears only in `addIcsCalendarSchema`'s input; no view carries it.

export type CalendarErrorCode =
  | "invalid-input"
  | "unauthenticated"
  | "not-found"
  | "invalid-url"
  | "fetch-failed"
  | "unreadable"
  | "empty"
  | "limit"
  | "category-limit"
  | "read-only"
  | "generic";

export type CalendarActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: CalendarErrorCode };

/**
 * `webcal://` is `https://` with another name: Outlook, Google and Apple hand it
 * out. Returns the https URL, or null when the text is not an https URL.
 */
export function normalizeIcsUrl(input: string): string | null {
  const trimmed = input.trim().replace(/^webcals?:\/\//i, "https://");
  if (trimmed.length > 2048) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && url.hostname !== "" ? url.href : null;
  } catch {
    return null;
  }
}

export const addIcsCalendarSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: z.string().max(2048).refine((value) => normalizeIcsUrl(value) !== null),
});

export const accountIdSchema = z.object({ id: z.uuid() });

const calendarName = z.string().trim().min(1).max(100);

/** The most own (manual) calendars a user can have, the default one included. */
export const MAX_CATEGORIES = 20;

export const createCalendarSchema = z.object({ name: calendarName, color: z.enum(AGENDA_COLORS) });

// A name changes only on an own, non-default calendar: the default one is named by its translation.
export const updateCalendarSchema = z
  .object({ id: z.uuid(), name: calendarName.optional(), color: z.enum(AGENDA_COLORS).optional() })
  .refine((value) => value.name !== undefined || value.color !== undefined);

export const calendarIdSchema = z.object({ id: z.uuid() });

export const resolveNoticeSchema = z.object({ id: z.uuid(), removeItems: z.boolean() });

export type SyncStatus = "never" | "ok" | "failed";

/** One own calendar, a category (ADR-0040). `name` is null for the default one: the panel shows its translation. */
export interface CalendarCategoryView {
  /** The calendar's id, which is what an event and the hidden list refer to. */
  id: string;
  name: string | null;
  color: AgendaColor;
  isDefault: boolean;
}

/** One imported calendar as the panel lists it. */
export interface CalendarAccountView {
  id: string;
  /** The id of the account's calendar: its colour and the hidden list belong to it. */
  calendarId: string;
  color: AgendaColor;
  name: string;
  status: SyncStatus;
  /** ISO instant of the last successful sync. */
  lastSyncedAt: string | null;
  /** A machine code from `sync_state`; the panel translates it. */
  errorCode: string | null;
}

/** What the settings panel lists: own categories and imported calendars. */
export interface CalendarOverview {
  categories: CalendarCategoryView[];
  accounts: CalendarAccountView[];
}

/** A basket notice after a sync deleted an event with a planned meal (ADR-0037 §6). */
export interface SyncNoticeView {
  id: string;
  eventTitle: string;
  /** The open basket items that came from the deleted meal plan. */
  items: Array<{ id: string; name: string }>;
}

const syncStateSchema = z.object({
  status: z.enum(["ok", "failed"]).optional(),
  error: z.string().regex(/^[a-z_]{1,40}$/).optional(),
  attempted_at: z.string().optional(),
});

/** Reads `sync_state` defensively: it is jsonb, written only by the apply function. */
export function readSyncState(raw: unknown): { status: SyncStatus; errorCode: string | null; attemptedAt: string | null } {
  const parsed = syncStateSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.status) return { status: "never", errorCode: null, attemptedAt: null };
  return {
    status: parsed.data.status,
    errorCode: parsed.data.status === "failed" ? (parsed.data.error ?? "fetch_failed") : null,
    attemptedAt: parsed.data.attempted_at ?? null,
  };
}

/** True when the last attempt (successful or not) is older than `maxAgeMs`. */
export function isStale(
  account: { last_synced_at: string | null; sync_state: unknown },
  now: Date,
  maxAgeMs: number,
): boolean {
  const { attemptedAt } = readSyncState(account.sync_state);
  const last = Math.max(
    attemptedAt ? Date.parse(attemptedAt) || 0 : 0,
    account.last_synced_at ? Date.parse(account.last_synced_at) || 0 : 0,
  );
  return now.getTime() - last > maxAgeMs;
}
