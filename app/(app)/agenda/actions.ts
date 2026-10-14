"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/boards/session";
import { getAgendaItems } from "@/lib/agenda/queries";
import {
  createEventSchema,
  eventIdSchema,
  moveEventSchema,
  rangeSchema,
  updateEventSchema,
  type AgendaActionResult,
  type AgendaErrorCode,
} from "@/lib/agenda/schemas";
import { AGENDA_TIME_ZONE, wallClockToUtc } from "@/lib/agenda/time";
import type { AgendaEventDetail, AgendaItem } from "@/lib/agenda/types";
import type { Database } from "@/lib/database.types";

// Agenda reads and writes for the signed-in user. Access is decided by RLS
// (ADR-0033); these actions add what RLS lets through on purpose: the database
// allows a manual event in an imported calendar and deleting a synced event,
// Atlas does not. Errors carry a code only, never a database message.

type EventUpdate = Database["public"]["Tables"]["calendar_events"]["Update"];

function logDbError(action: string, error: { code: string; message: string }) {
  console.error(`[agenda] ${action} failed:`, error.code, error.message);
}

/** 42501 is the database's "synced calendar events are read-only". */
function failure(action: string, error: { code: string; message: string }): { success: false; error: "read-only" | "generic" } {
  logDbError(action, error);
  return { success: false, error: error.code === "42501" ? "read-only" : "generic" };
}

export async function loadAgendaRange(input: unknown): Promise<AgendaActionResult<AgendaItem[]>> {
  const parsed = rangeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  try {
    const items = await getAgendaItems({
      from: wallClockToUtc(`${parsed.data.from}T00:00:00`),
      to: wallClockToUtc(`${parsed.data.to}T00:00:00`),
      timeZone: AGENDA_TIME_ZONE,
    });
    return { success: true, data: items };
  } catch {
    return { success: false, error: "generic" };
  }
}

export async function getAgendaEvent(input: unknown): Promise<AgendaActionResult<AgendaEventDetail>> {
  const parsed = eventIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("id, title, location, description, source, calendar_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (error) return failure("getAgendaEvent", error);
  if (!data) return { success: false, error: "not-found" };
  return {
    success: true,
    data: {
      id: data.id,
      title: data.title,
      location: data.location,
      description: data.description,
      source: data.source === "sync" ? "sync" : "manual",
      calendarId: data.calendar_id,
    },
  };
}

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** The calendar a new event goes into: the given one, else the default. It must be a manual calendar. */
type Failure = { success: false; error: AgendaErrorCode };

async function resolveManualCalendar(
  supabase: Supabase,
  calendarId: string | undefined,
): Promise<{ calendarId: string } | { error: Failure }> {
  const query = supabase.from("calendars").select("id, kind");
  const { data, error } = await (calendarId ? query.eq("id", calendarId) : query.eq("is_default", true)).maybeSingle();
  if (error) return { error: failure("resolveCalendar", error) };
  if (!data) return { error: { success: false, error: "not-found" } as const };
  if (data.kind !== "manual") return { error: { success: false, error: "read-only" } as const };
  return { calendarId: data.id };
}

/** Loads an event and refuses a synced one before anything is written. */
async function requireManualEvent(supabase: Supabase, id: string): Promise<Failure | null> {
  const { data, error } = await supabase.from("calendar_events").select("id, source").eq("id", id).maybeSingle();
  if (error) return failure("requireManualEvent", error);
  if (!data) return { success: false, error: "not-found" } as const;
  if (data.source !== "manual") return { success: false, error: "read-only" } as const;
  return null;
}

export async function createEvent(input: unknown): Promise<AgendaActionResult<{ id: string }>> {
  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const calendar = await resolveManualCalendar(supabase, parsed.data.calendarId);
  if ("error" in calendar) return calendar.error;

  const { title, startsAt, endsAt, allDay, location, description } = parsed.data;
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      user_id: auth.userId,
      calendar_id: calendar.calendarId,
      title,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: allDay,
      location,
      description,
      source: "manual",
    })
    .select("id")
    .single();
  if (error || !data) return error ? failure("createEvent", error) : { success: false, error: "generic" };
  return { success: true, data: { id: data.id } };
}

async function writeEvent(action: string, id: string, update: EventUpdate): Promise<AgendaActionResult> {
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const refused = await requireManualEvent(supabase, id);
  if (refused) return refused;

  const { data, error } = await supabase.from("calendar_events").update(update).eq("id", id).select("id").maybeSingle();
  if (error) return failure(action, error);
  if (!data) return { success: false, error: "not-found" };
  return { success: true, data: undefined };
}

export async function updateEvent(input: unknown): Promise<AgendaActionResult> {
  const parsed = updateEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const { id, title, startsAt, endsAt, allDay, location, description } = parsed.data;
  return writeEvent("updateEvent", id, {
    title,
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: allDay,
    location,
    description,
  });
}

/** Drag and resize: only the span changes. */
export async function moveEvent(input: unknown): Promise<AgendaActionResult> {
  const parsed = moveEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const { id, startsAt, endsAt, allDay } = parsed.data;
  return writeEvent("moveEvent", id, { starts_at: startsAt, ends_at: endsAt, all_day: allDay });
}

export async function deleteEvent(input: unknown): Promise<AgendaActionResult> {
  const parsed = eventIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const refused = await requireManualEvent(supabase, parsed.data.id);
  if (refused) return refused;

  const { data, error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error) return failure("deleteEvent", error);
  if (!data) return { success: false, error: "not-found" };
  return { success: true, data: undefined };
}
