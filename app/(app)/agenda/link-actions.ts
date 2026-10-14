"use server";

import { requireUserId } from "@/lib/boards/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEventLinks, getEventRefsForTarget, searchLinkTargets } from "@/lib/agenda/link-queries";
import {
  eventLinksInputSchema,
  linkErrorCode,
  linkInputSchema,
  linkSearchInputSchema,
  targetRefsInputSchema,
  unlinkInputSchema,
  type AgendaEventRef,
  type AgendaLink,
  type AgendaLinkCandidate,
} from "@/lib/agenda/links";
import type { AgendaActionResult } from "@/lib/agenda/schemas";

// Links between events and recipes, cards or notes (ADR-0037 s4). The policies
// on `calendar_event_links` need both ends readable and the event editable, so
// these actions only validate and translate: the database error becomes a code,
// never its message. Imported events can be linked too: the link is Atlas's own.

async function read<T>(action: string, run: () => Promise<T>): Promise<AgendaActionResult<T>> {
  try {
    return { success: true, data: await run() };
  } catch (error) {
    console.error(`[agenda] ${action} failed:`, error);
    return { success: false, error: "generic" };
  }
}

export async function getAgendaEventLinks(input: unknown): Promise<AgendaActionResult<AgendaLink[]>> {
  const parsed = eventLinksInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  return read("getAgendaEventLinks", () => getEventLinks(parsed.data.eventId));
}

export async function searchAgendaLinkTargets(input: unknown): Promise<AgendaActionResult<AgendaLinkCandidate[]>> {
  const parsed = linkSearchInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  return read("searchAgendaLinkTargets", () => searchLinkTargets(parsed.data.query));
}

/** For the "In agenda" line on a card; recipes and notes load theirs on the server. */
export async function getAgendaEventRefs(input: unknown): Promise<AgendaActionResult<AgendaEventRef[]>> {
  const parsed = targetRefsInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  return read("getAgendaEventRefs", () => getEventRefsForTarget(parsed.data.kind, parsed.data.targetId));
}

export async function linkToEvent(input: unknown): Promise<AgendaActionResult<{ id: string }>> {
  const parsed = linkInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  // `user_id` is overwritten by the trigger with the event's calendar owner.
  const { data, error } = await supabase
    .from("calendar_event_links")
    .insert({
      user_id: auth.userId,
      calendar_event_id: parsed.data.eventId,
      recipe_id: parsed.data.kind === "recipe" ? parsed.data.targetId : null,
      card_id: parsed.data.kind === "card" ? parsed.data.targetId : null,
      note_id: parsed.data.kind === "note" ? parsed.data.targetId : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error) console.error("[agenda] linkToEvent failed:", error.code, error.message);
    return { success: false, error: error ? linkErrorCode(error) : "generic" };
  }
  return { success: true, data: { id: data.id } };
}

export async function unlinkFromEvent(input: unknown): Promise<AgendaActionResult> {
  const parsed = unlinkInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("calendar_event_links")
    .delete()
    .eq("id", parsed.data.linkId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[agenda] unlinkFromEvent failed:", error.code, error.message);
    return { success: false, error: linkErrorCode(error) };
  }
  if (!data) return { success: false, error: "not-found" };
  return { success: true, data: undefined };
}
