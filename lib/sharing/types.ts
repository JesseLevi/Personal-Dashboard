import type { ResourceType } from "@/lib/sharing/schemas";

export type SharingErrorCode =
  | "invalid-input"
  | "unauthenticated"
  | "not-found"
  | "already-shared"
  | "rate-limited"
  | "generic";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: SharingErrorCode };

// Never carries the avatar path: has_avatar plus updatedAt (cache key) only.
export type MemberProfile = {
  id: string;
  displayName: string | null;
  lastName: string | null;
  hasAvatar: boolean;
  updatedAt: string;
};

export type MemberSearchResult = MemberProfile & {
  // Only set when the query was exactly this person's e-mail address.
  email: string | null;
};

export type PendingInvite = {
  shareId: string;
  resource: ResourceType;
  resourceId: string;
  // null = the container's translated default name.
  resourceName: string | null;
  inviter: MemberProfile;
  invitedAt: string;
};

// A recipe offered to the caller (ADR-0036). `thumbnailUrl` is presigned on
// the server; the stored path never reaches the browser.
export type PendingRecipeShare = {
  shareId: string;
  recipeId: string;
  title: string;
  timeMinutes: number | null;
  thumbnailUrl: string | null;
  inviterFirstName: string | null;
  invitedAt: string;
};

// The one share a basket owner has on a container (v1: one member per basket,
// ADR-0035 point 11). `status` is the invitee's side: pending until accepted.
export type ListShare = {
  member: MemberProfile;
  status: "pending" | "accepted";
};
