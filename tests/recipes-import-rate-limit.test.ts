import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ImportRateLimitError, IMPORTS_PER_HOUR, checkImportRateLimit } from "@/lib/recipes/import/rate-limit";

function clientWithRpc(result: { data: unknown; error?: { code: string; message: string } }) {
  const rpc = vi.fn(async () => ({ data: result.data, error: result.error ?? null }));
  return { supabase: { rpc } as unknown as Parameters<typeof checkImportRateLimit>[0], rpc };
}

describe("checkImportRateLimit", () => {
  it("allows the import when the database records the attempt", async () => {
    const { supabase, rpc } = clientWithRpc({ data: true });
    await expect(checkImportRateLimit(supabase)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("consume_recipe_import_attempt");
  });

  it("sends no user id: the database decides who the caller is", async () => {
    const { supabase, rpc } = clientWithRpc({ data: true });
    await checkImportRateLimit(supabase);
    expect(rpc.mock.calls[0]).toHaveLength(1);
  });

  it("refuses with a typed error when the database says no", async () => {
    const { supabase } = clientWithRpc({ data: false });
    const error = await checkImportRateLimit(supabase).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImportRateLimitError);
    expect((error as ImportRateLimitError).code).toBe("rate_limited");
    expect((error as ImportRateLimitError).limit).toBe(IMPORTS_PER_HOUR);
  });

  it.each([null, undefined, "true"])("fails closed on an unexpected result (%j)", async (data) => {
    const { supabase } = clientWithRpc({ data });
    await expect(checkImportRateLimit(supabase)).rejects.toBeInstanceOf(ImportRateLimitError);
  });

  it("fails closed on a database error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { supabase } = clientWithRpc({ data: null, error: { code: "X", message: "down" } });
    await expect(checkImportRateLimit(supabase)).rejects.toThrow("Failed to check");
  });
});
