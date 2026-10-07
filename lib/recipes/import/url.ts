import { z } from "zod";

// Recipe URL validation (#318), shared by the link panel (inline error) and
// the server action. Pure and framework-free. https only, no credentials; the
// SSRF rules (port, DNS, redirects) are safe-fetch's job (#313), this is only
// the cheap early "that is not a link" answer.

export const MAX_IMPORT_URL_LENGTH = 2048;

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

export const importUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_IMPORT_URL_LENGTH)
  .refine(isHttpsUrl, { message: "Not an https URL" });

/** Host without `www.`, for the placeholder title and the "Bron" link text. Empty string for an unparsable value. */
export function hostOf(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
