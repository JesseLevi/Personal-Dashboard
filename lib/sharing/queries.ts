import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import { memberProfiles } from "@/lib/sharing/actions";
import type { ListShare, MemberProfile } from "@/lib/sharing/types";

// Read side of sharing for the owner's basket panel. Anon-key server client,
// so RLS decides what is visible (ADR-0033); never service_role.

/**
 * The share the signed-in owner has on a basket (v1: at most one member per
 * basket, ADR-0035 point 11), with the member's profile. Null when the
 * basket is not shared, is not the caller's, or the profile cannot be read.
 */
export async function getShoppingListShare(listId: string): Promise<ListShare | null> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("shares")
    .select("member_id, status")
    .eq("shopping_list_id", listId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[sharing] getShoppingListShare failed:", error.code, error.message);
    return null;
  }
  if (!data || (data.status !== "pending" && data.status !== "accepted")) return null;

  const profiles = await memberProfiles({ ids: [data.member_id] });
  const member = profiles.success ? profiles.data[0] : undefined;
  if (member) return { member, status: data.status };
  // A pending invitee's profile stays hidden until they accept (ADR-0035): the
  // panel shows its "Unnamed" label and the pending tag instead.
  if (profiles.success && data.status === "pending") {
    return { member: anonymousMember(data.member_id), status: data.status };
  }
  return null;
}

function anonymousMember(id: string): MemberProfile {
  return { id, displayName: null, lastName: null, hasAvatar: false, updatedAt: "" };
}

async function getOwnProfile(userId: string): Promise<MemberProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, last_name, avatar_path, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) console.error("[sharing] getOwnProfile failed:", error.code, error.message);
  if (error || !data) return null;
  return {
    id: userId,
    displayName: data.display_name,
    lastName: data.last_name,
    hasAvatar: data.avatar_path !== null,
    updatedAt: data.updated_at,
  };
}

/**
 * Everyone on a basket, owner first, for the header's AvatarGroup (v1: one
 * accepted member, ADR-0035 point 11), plus the owner's profile for the member
 * panel. `people` is empty while nobody accepted. The owner sees the member via
 * their own share row; a member sees only their own row, so the owner comes
 * from `member_profiles` and the member's own profile from `profiles`.
 */
export async function getShoppingListPeople(args: {
  ownerId: string;
  isOwner: boolean;
  /** The owner's share on this basket (null for a member). */
  share: ListShare | null;
  /** Whether the basket has an accepted share (`getAcceptedShareListIds`). */
  accepted: boolean;
}): Promise<{ owner: MemberProfile | null; people: MemberProfile[] }> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { owner: null, people: [] };

  const own = await getOwnProfile(userId);
  if (args.isOwner) {
    const member = args.share?.status === "accepted" ? args.share.member : null;
    return { owner: own, people: own && member ? [own, member] : [] };
  }
  const profiles = await memberProfiles({ ids: [args.ownerId] });
  const owner = profiles.success ? (profiles.data[0] ?? null) : null;
  return { owner, people: args.accepted && owner && own ? [owner, own] : [] };
}
