import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { MatcherClient } from "@/lib/recipes/import/match-ingredients";
import { ImportRateLimitError, IMPORTS_PER_HOUR, checkImportRateLimit } from "@/lib/recipes/import/rate-limit";

function clientWithCount(result: { count: number | null; error?: { code: string; message: string } }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain: Record<string, unknown> = {};
  for (const op of ["eq", "not", "gt"]) {
    chain[op] = (...args: unknown[]) => {
      calls.push([op, ...args]);
      return op === "gt" ? Promise.resolve({ count: result.count, error: result.error ?? null }) : chain;
    };
  }
  const supabase = { from: vi.fn(() => ({ select: vi.fn(() => chain) })) } as unknown as MatcherClient;
  return { supabase, calls };
}

describe("checkImportRateLimit", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");

  it("allows the 20th import (19 existing)", async () => {
    const { supabase } = clientWithCount({ count: IMPORTS_PER_HOUR - 1 });
    await expect(checkImportRateLimit(supabase, "u1", now)).resolves.toBeUndefined();
  });

  it("refuses the 21st import (20 existing) with a typed error", async () => {
    const { supabase } = clientWithCount({ count: IMPORTS_PER_HOUR });
    const error = await checkImportRateLimit(supabase, "u1", now).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImportRateLimitError);
    expect((error as ImportRateLimitError).code).toBe("rate_limited");
  });

  it("counts only this user's imports (source_url set) from the last hour", async () => {
    const { supabase, calls } = clientWithCount({ count: 0 });
    await checkImportRateLimit(supabase, "u1", now);
    expect(calls).toContainEqual(["eq", "user_id", "u1"]);
    expect(calls).toContainEqual(["not", "source_url", "is", null]);
    expect(calls).toContainEqual(["gt", "created_at", "2026-10-08T11:00:00.000Z"]);
  });

  it("fails closed on a database error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { supabase } = clientWithCount({ count: null, error: { code: "X", message: "down" } });
    await expect(checkImportRateLimit(supabase, "u1", now)).rejects.toThrow("Failed to check");
  });
});
