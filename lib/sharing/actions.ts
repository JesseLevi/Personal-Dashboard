import "server-only";
import type { z } from "zod";
import type { TablesInsert } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/recipes/session";
import {
  inviteMemberSchema,
  memberProfilesSchema,
  resourceRefSchema,
  resourceTypeSchema,
  revokeShareSchema,
  searchMembersSchema,
  type ResourceType,
} from "@/lib/sharing/schemas";
import type {
  ActionResult,
  MemberProfile,
  MemberSearchResult,
  PendingInvite,
  SharingErrorCode,
} from "@/lib/sharing/types";

// Server-side sharing operations (ADR-0035). Every call runs through the
// anon-key server client, so RLS and the member RPCs decide access; none of
// this uses service_role. A zero-row result (filtered by RLS, or the row is
// not in the expected state) reports "not-found".

const SHARE_COLUMN = {
  shopping_list: "shopping_list_id",
  recipe: "recipe_id",
} as const satisfies Record<
  ResourceType,
  string
>;

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export function logDbError(action: string, error: { code?: string; message: string }) {
  console.error(`[sharing] ${action} failed:`, error.code, error.message);
}

export function toErrorCode(error: { code?: string; message: string }): SharingErrorCode {
  if (error.code === "23505") return "already-shared";
  if (error.code === "42501") return "not-found";
  if (error.message === "rate_limited") return "rate-limited";
  return "generic";
}

// Parses the input, resolves the signed-in user and hands both to `run`.
async function withUser<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  run: (ctx: { supabase: Client; userId: string; data: z.infer<S> }) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  const supabase = await createSupabaseServerClient();
  return run({ supabase, userId: auth.userId, data: parsed.data });
}

export async function inviteMember(input: unknown): Promise<ActionResult> {
  return withUser(inviteMemberSchema, input, async ({ supabase, userId, data }) => {
    const row: TablesInsert<"shares"> = { user_id: userId, member_id: data.memberId };
    row[SHARE_COLUMN[data.resource]] = data.id;
    const { error } = await supabase.from("shares").insert(row);
    if (error) {
      logDbError("inviteMember", error);
      return { success: false, error: toErrorCode(error) };
    }
    return { success: true, data: undefined };
  });
}

export async function acceptShare(input: unknown): Promise<ActionResult> {
  return withUser(resourceRefSchema, input, async ({ supabase, userId, data }) => {
    // A recipe offer is never accepted in place: acceptRecipeShare copies it (ADR-0036).
    if (data.resource === "recipe") return { success: false, error: "invalid-input" };
    const { data: rows, error } = await supabase
      .from("shares")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq(SHARE_COLUMN[data.resource], data.id)
      .eq("member_id", userId)
      .eq("status", "pending")
      .select("id");
    if (error) {
      logDbError("acceptShare", error);
      return { success: false, error: toErrorCode(error) };
    }
    if (rows.length === 0) return { success: false, error: "not-found" };
    return { success: true, data: undefined };
  });
}

async function deleteOwnMembership(
  action: string,
  status: "pending" | "accepted",
  input: unknown,
): Promise<ActionResult> {
  return withUser(resourceRefSchema, input, async ({ supabase, userId, data }) => {
    const { data: rows, error } = await supabase
      .from("shares")
      .delete()
      .eq(SHARE_COLUMN[data.resource], data.id)
      .eq("member_id", userId)
      .eq("status", status)
      .select("id");
    if (error) {
      logDbError(action, error);
      return { success: false, error: toErrorCode(error) };
    }
    if (rows.length === 0) return { success: false, error: "not-found" };
    return { success: true, data: undefined };
  });
}

/** The invitee turns an invitation down (deletes the pending share). */
export async function declineShare(input: unknown): Promise<ActionResult> {
  return deleteOwnMembership("declineShare", "pending", input);
}

/** An accepted member leaves (deletes their own share). */
export async function leaveShare(input: unknown): Promise<ActionResult> {
  return deleteOwnMembership("leaveShare", "accepted", input);
}

/** The owner removes a member or withdraws an invitation. */
export async function revokeShare(input: unknown): Promise<ActionResult> {
  return withUser(revokeShareSchema, input, async ({ supabase, userId, data }) => {
    const { data: rows, error } = await supabase
      .from("shares")
      .delete()
      .eq(SHARE_COLUMN[data.resource], data.id)
      .eq("member_id", data.memberId)
      .eq("user_id", userId)
      .select("id");
    if (error) {
      logDbError("revokeShare", error);
      return { success: false, error: toErrorCode(error) };
    }
    if (rows.length === 0) return { success: false, error: "not-found" };
    return { success: true, data: undefined };
  });
}

type ProfileRow = {
  id: string;
  display_name: string;
  last_name: string;
  has_avatar: boolean;
  updated_at: string;
};

function toProfile(row: ProfileRow): MemberProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    lastName: row.last_name,
    hasAvatar: row.has_avatar,
    updatedAt: row.updated_at,
  };
}

export async function searchMembers(input: unknown): Promise<ActionResult<MemberSearchResult[]>> {
  return withUser(searchMembersSchema, input, async ({ supabase, data }) => {
    const { data: rows, error } = await supabase.rpc("search_members", { p_query: data.query });
    if (error) {
      logDbError("searchMembers", error);
      return { success: false, error: toErrorCode(error) };
    }
    return { success: true, data: rows.map((row) => ({ ...toProfile(row), email: row.email })) };
  });
}

/** Profiles of people the caller shares something with (any direction or status). */
export async function memberProfiles(input: unknown): Promise<ActionResult<MemberProfile[]>> {
  return withUser(memberProfilesSchema, input, async ({ supabase, data }) => {
    if (data.ids.length === 0) return { success: true, data: [] };
    const { data: rows, error } = await supabase.rpc("member_profiles", { p_ids: data.ids });
    if (error) {
      logDbError("memberProfiles", error);
      return { success: false, error: toErrorCode(error) };
    }
    return { success: true, data: rows.map(toProfile) };
  });
}

export async function pendingInvites(): Promise<ActionResult<PendingInvite[]>> {
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  const supabase = await createSupabaseServerClient();
  const { data: rows, error } = await supabase.rpc("pending_share_invites");
  if (error) {
    logDbError("pendingInvites", error);
    return { success: false, error: toErrorCode(error) };
  }
  const invites = rows.flatMap((row): PendingInvite[] => {
    const resource = resourceTypeSchema.safeParse(row.resource_type);
    if (!resource.success) return [];
    return [
      {
        shareId: row.share_id,
        resource: resource.data,
        resourceId: row.resource_id,
        resourceName: row.resource_name,
        inviter: toProfile({
          id: row.inviter_id,
          display_name: row.inviter_display_name,
          last_name: row.inviter_last_name,
          has_avatar: row.inviter_has_avatar,
          updated_at: row.inviter_updated_at,
        }),
        invitedAt: row.invited_at,
      },
    ];
  });
  return { success: true, data: invites };
}
