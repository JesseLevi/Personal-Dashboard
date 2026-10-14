import { createHash, timingSafeEqual } from "node:crypto";

export const CRON_SECRET_MIN_LENGTH = 16;

/**
 * True only for `Authorization: Bearer <CRON_SECRET>` (ADR-0039 §5). An unset
 * or short secret fails closed, so a missing env var never opens the route.
 */
export function isCronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < CRON_SECRET_MIN_LENGTH || !authorization) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
