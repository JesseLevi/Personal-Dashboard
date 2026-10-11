import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import nl from "@/messages/nl.json";
import { IMPORT_ERROR_CODES, isImportErrorCode } from "@/lib/recipes/enums";
import type { SafeFetchErrorCode } from "@/lib/net/safe-fetch";

// The one list of recipes.import_error codes (lib/recipes/enums.ts) and the
// message catalogs must not drift: every code needs a user-facing reason in
// both languages, and every reason needs a code.

const SAFE_FETCH_CODES: SafeFetchErrorCode[] = [
  "invalid_url", "blocked_address", "too_large", "timeout", "bad_content_type", "too_many_redirects", "http_error",
];

describe("import error codes", () => {
  it.each([["nl", nl], ["en", en]] as const)("%s has a message for exactly the known codes", (_lang, messages) => {
    expect(Object.keys(messages.recipes.import.errors).sort()).toEqual([...IMPORT_ERROR_CODES].sort());
  });

  it("matches the database format (^[a-z0-9_]{1,64}$)", () => {
    for (const code of IMPORT_ERROR_CODES) expect(code).toMatch(/^[a-z0-9_]{1,64}$/);
  });

  it("includes every safe-fetch error code and the codes from the ticket", () => {
    for (const code of [...SAFE_FETCH_CODES, "no_content", "ai_unavailable", "ai_failed", "no_recipe_found", "rate_limited"]) {
      expect(isImportErrorCode(code)).toBe(true);
    }
  });

  it("rejects an unknown code", () => {
    expect(isImportErrorCode("whatever")).toBe(false);
    expect(isImportErrorCode(null)).toBe(false);
  });
});
