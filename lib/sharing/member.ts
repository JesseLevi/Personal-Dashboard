import type { MemberProfile } from "@/lib/sharing/types";

// Client-safe helpers for rendering a member (no server-only imports).

/** Same-origin avatar URL; `v` is the profile's updated_at so a new photo busts the cache. Null without a photo. */
export function memberAvatarSrc(member: Pick<MemberProfile, "id" | "hasAvatar" | "updatedAt">): string | null {
  if (!member.hasAvatar) return null;
  return `/api/avatar/${member.id}?v=${encodeURIComponent(member.updatedAt)}`;
}

/** "First Last", skipping empty parts; `fallback` (a translated string) when both are empty. */
export function memberFullName(
  member: Pick<MemberProfile, "displayName" | "lastName">,
  fallback: string,
): string {
  const full = [member.displayName, member.lastName]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part !== "")
    .join(" ");
  return full === "" ? fallback : full;
}
