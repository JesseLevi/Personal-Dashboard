import { createHash, randomBytes } from "node:crypto";
import { WIDGET_TOKEN_PREFIX } from "@/lib/widget/limits";

/** `atlas_wgt_` + 32 random bytes as base64url (ADR-0047 §3). */
export function generateWidgetToken(): string {
  return WIDGET_TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

/** Hex SHA-256 over the full plaintext; equals `encode(sha256(convert_to(token,'UTF8')),'hex')` in the database. */
export function hashWidgetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
