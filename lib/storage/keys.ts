// Object key builder: `<user_id>/<module>/…` (ADR-0024 §3).
// Pass the session's user id, never client input.
import "server-only";
import { z } from "zod";

const userIdSchema = z.uuid();

function assertSegment(segment: string): void {
  if (segment === "" || segment === "." || segment === ".." || segment.includes("/")) {
    throw new Error(`Invalid object key segment: ${JSON.stringify(segment)}`);
  }
}

export function objectKey(userId: string, module: string, ...parts: string[]): string {
  if (!userIdSchema.safeParse(userId).success) {
    throw new Error("Invalid object key: user id is not a uuid");
  }
  const segments = [module, ...parts];
  segments.forEach(assertSegment);
  return [userId, ...segments].join("/");
}

/** True when `key` is a well-formed key inside `userId`'s namespace. */
export function keyBelongsTo(userId: string, key: string): boolean {
  if (!userIdSchema.safeParse(userId).success) return false;
  const [owner, ...rest] = key.split("/");
  if (owner !== userId || rest.length < 2) return false;
  return rest.every((s) => s !== "" && s !== "." && s !== "..");
}

/** Prefix for deletePrefix: a user's module folder, with trailing slash. */
export function modulePrefix(userId: string, module: string): string {
  return `${objectKey(userId, module)}/`;
}
