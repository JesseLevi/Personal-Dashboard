import { z } from "zod";
import type { AgendaErrorCode } from "@/lib/agenda/schemas";

// Links from an event to a recipe, card or note (ADR-0037 s4). Pure half: types,
// input schemas, error mapping and ordering. No server-only, so vitest and
// client components can import it.

export const AGENDA_LINK_KINDS = ["recipe", "card", "note"] as const;
export type AgendaLinkKind = (typeof AGENDA_LINK_KINDS)[number];

/** One `calendar_event_links` row with its target's current title. */
export interface AgendaLink {
  id: string;
  kind: AgendaLinkKind;
  targetId: string;
  title: string;
}

/** A search hit that can be linked. */
export interface AgendaLinkCandidate {
  kind: AgendaLinkKind;
  id: string;
  title: string;
}

/** The event side of a link, as shown on a recipe, card or note. `startsAt` is a UTC instant. */
export interface AgendaEventRef {
  id: string;
  title: string;
  startsAt: string;
  allDay: boolean;
}

export const LINK_SEARCH_MIN = 2;
export const LINK_SEARCH_MAX = 64;
export const LINK_SEARCH_LIMIT = 5;

export const linkInputSchema = z.object({
  eventId: z.uuid(),
  kind: z.enum(AGENDA_LINK_KINDS),
  targetId: z.uuid(),
});

export const unlinkInputSchema = z.object({ linkId: z.uuid() });

export const eventLinksInputSchema = z.object({ eventId: z.uuid() });

export const targetRefsInputSchema = z.object({
  kind: z.enum(AGENDA_LINK_KINDS),
  targetId: z.uuid(),
});

export const linkSearchInputSchema = z.object({
  query: z.string().trim().min(LINK_SEARCH_MIN).max(LINK_SEARCH_MAX),
});

/** The `calendar_event_links` column that holds a target of this kind. */
export const LINK_COLUMN = { recipe: "recipe_id", card: "card_id", note: "note_id" } as const;

export function linkHref(kind: AgendaLinkKind, targetId: string): string {
  switch (kind) {
    case "recipe":
      return `/recepten/${targetId}`;
    case "card":
      return `/te-doen?card=${targetId}`;
    case "note":
      return `/notities/${targetId}`;
  }
}

/**
 * Database error to action code. A unique violation means the pair is already
 * linked; RLS (42501) means one end is not readable or the event not editable;
 * a foreign-key violation means an end is gone.
 */
export function linkErrorCode(error: { code: string }): AgendaErrorCode {
  switch (error.code) {
    case "23505":
      return "already-linked";
    case "42501":
      return "forbidden";
    case "23503":
      return "not-found";
    default:
      return "generic";
  }
}

/** Upcoming events first (soonest first), then past ones (most recent first). */
export function sortEventRefs(refs: AgendaEventRef[], now: Date): AgendaEventRef[] {
  const cutoff = now.getTime();
  const at = (ref: AgendaEventRef) => Date.parse(ref.startsAt);
  const upcoming = refs.filter((ref) => at(ref) >= cutoff).sort((a, b) => at(a) - at(b));
  const past = refs.filter((ref) => at(ref) < cutoff).sort((a, b) => at(b) - at(a));
  return [...upcoming, ...past];
}
