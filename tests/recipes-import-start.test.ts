import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { MatcherClient } from "@/lib/recipes/import/match-ingredients";
import { importUrlSchema, hostOf } from "@/lib/recipes/import/url";
import { retryImport, startImport } from "@/lib/recipes/import/start";
import { startRecipeImportSchema } from "@/lib/recipes/schemas";
import { IMPORTS_PER_HOUR } from "@/lib/recipes/import/rate-limit";

const CATEGORY = "11111111-1111-4111-8111-111111111111";

type Call = { table: string; op: string; args: unknown[] };

/** Chainable fake: every builder method records itself and returns the chain; terminal reads resolve from `plan`. */
function fakeClient(plan: {
  category?: { id: string } | null;
  rateCount?: number;
  firstPosition?: number | null;
  insertedId?: string;
  failed?: Record<string, unknown> | null;
}) {
  const calls: Call[] = [];
  const supabase = {
    from(table: string) {
      let op = "select";
      let head = false;
      const chain: Record<string, unknown> = {};
      const record = (name: string) => (...args: unknown[]) => {
        calls.push({ table, op: name, args });
        if (name === "select" && args[1] && typeof args[1] === "object") head = true;
        if (name === "insert" || name === "update" || name === "delete") op = name;
        return chain;
      };
      for (const name of ["select", "eq", "not", "gt", "order", "limit", "insert", "update", "delete"]) chain[name] = record(name);
      const result = (): { data: unknown; error: null; count?: number } => {
        if (table === "recipe_categories") return { data: plan.category === undefined ? { id: CATEGORY } : plan.category, error: null };
        if (head) return { data: null, error: null, count: plan.rateCount ?? 0 };
        if (op === "insert") return { data: { id: plan.insertedId ?? "new-id" }, error: null };
        if (plan.failed !== undefined && calls.some((c) => c.op === "eq" && c.args[0] === "id")) return { data: plan.failed, error: null };
        return { data: plan.firstPosition == null ? null : { position: plan.firstPosition }, error: null };
      };
      chain.maybeSingle = async () => result();
      chain.single = async () => result();
      chain.then = (resolve: (v: unknown) => void) => resolve(result());
      return chain;
    },
  } as unknown as MatcherClient;
  return { supabase, calls };
}

const insertPayload = (calls: Call[]) => calls.find((c) => c.op === "insert")!.args[0] as Record<string, unknown>;

describe("importUrlSchema", () => {
  it.each(["https://example.com/recept", "  https://www.example.nl/a?b=1#c  "])("accepts %s", (url) => {
    expect(importUrlSchema.safeParse(url).success).toBe(true);
  });
  it.each(["http://example.com", "ftp://example.com", "example.com/recept", "", "javascript:alert(1)", "https://user:pw@example.com", "not a url"])(
    "rejects %j",
    (url) => {
      expect(importUrlSchema.safeParse(url).success).toBe(false);
    },
  );
  it("trims and bounds the length", () => {
    expect(importUrlSchema.parse("  https://example.com  ")).toBe("https://example.com");
    expect(importUrlSchema.safeParse(`https://example.com/${"a".repeat(2100)}`).success).toBe(false);
  });
  it("hostOf strips www and never throws", () => {
    expect(hostOf("https://www.leukerecepten.nl/x")).toBe("leukerecepten.nl");
    expect(hostOf("nope")).toBe("");
  });
  it("startRecipeImportSchema needs a uuid category", () => {
    expect(startRecipeImportSchema.safeParse({ categoryId: "x", url: "https://a.nl" }).success).toBe(false);
    expect(startRecipeImportSchema.safeParse({ categoryId: CATEGORY, url: "https://a.nl" }).success).toBe(true);
  });
});

describe("startImport", () => {
  it("inserts an importing row (host as title, source_url, top of the column) and schedules the job", async () => {
    const { supabase, calls } = fakeClient({ firstPosition: 1000, insertedId: "r9" });
    const schedule = vi.fn();
    const result = await startImport(supabase, "u1", { categoryId: CATEGORY, url: "https://www.example.com/pasta" }, schedule);
    expect(result).toEqual({ ok: true, recipeId: "r9" });
    expect(insertPayload(calls)).toEqual({
      user_id: "u1",
      category_id: CATEGORY,
      title: "example.com",
      source_url: "https://www.example.com/pasta",
      import_status: "importing",
      position: 500, // nextPosition(null, 1000): above the current first card
    });
    expect(schedule).toHaveBeenCalledWith({ supabase, userId: "u1", recipeId: "r9", url: "https://www.example.com/pasta" });
  });

  it("an empty category gets the first position", async () => {
    const { supabase, calls } = fakeClient({ firstPosition: null });
    await startImport(supabase, "u1", { categoryId: CATEGORY, url: "https://a.nl" }, vi.fn());
    expect(insertPayload(calls).position).toBe(1000);
  });

  it("refuses the 21st import in an hour: no insert, nothing scheduled", async () => {
    const { supabase, calls } = fakeClient({ rateCount: IMPORTS_PER_HOUR });
    const schedule = vi.fn();
    const result = await startImport(supabase, "u1", { categoryId: CATEGORY, url: "https://a.nl" }, schedule);
    expect(result).toEqual({ ok: false, error: "rate-limited" });
    expect(calls.some((c) => c.op === "insert")).toBe(false);
    expect(schedule).not.toHaveBeenCalled();
  });

  it("rejects a category that is not the caller's", async () => {
    const { supabase, calls } = fakeClient({ category: null });
    const result = await startImport(supabase, "u1", { categoryId: CATEGORY, url: "https://a.nl" }, vi.fn());
    expect(result).toEqual({ ok: false, error: "not-found" });
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });
});

describe("retryImport", () => {
  it("replaces a failed row by a new import with the same url and category, rate-limited like any import", async () => {
    const { supabase, calls } = fakeClient({
      failed: { id: "old", category_id: CATEGORY, source_url: "https://a.nl/x", import_status: "failed" },
      insertedId: "fresh",
    });
    const schedule = vi.fn();
    const result = await retryImport(supabase, "u1", "old", schedule);
    expect(result).toEqual({ ok: true, recipeId: "fresh" });
    expect(insertPayload(calls)).toMatchObject({ source_url: "https://a.nl/x", category_id: CATEGORY, import_status: "importing" });
    expect(calls.some((c) => c.table === "recipes" && c.op === "select" && c.args[1] !== undefined)).toBe(true); // count query ran
    expect(calls.some((c) => c.op === "delete")).toBe(true);
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it("only a failed import with a source_url can be retried", async () => {
    const { supabase } = fakeClient({ failed: { id: "r", category_id: CATEGORY, source_url: null, import_status: "done" } });
    expect(await retryImport(supabase, "u1", "r", vi.fn())).toEqual({ ok: false, error: "not-found" });
  });

  it("a rate-limited retry keeps the failed card", async () => {
    const { supabase, calls } = fakeClient({
      rateCount: IMPORTS_PER_HOUR,
      failed: { id: "old", category_id: CATEGORY, source_url: "https://a.nl/x", import_status: "failed" },
    });
    expect(await retryImport(supabase, "u1", "old", vi.fn())).toEqual({ ok: false, error: "rate-limited" });
    expect(calls.some((c) => c.op === "delete")).toBe(false);
  });
});
