import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { MatcherClient } from "@/lib/recipes/import/match-ingredients";
import { IMPORT_TIMEOUT_MS, sweepStuckImports } from "@/lib/recipes/import/sweep";

type Row = { id: string; user_id: string; import_status: string; import_error: string | null; created_at: string };

/** In-memory `recipes` table honouring the filters the sweep sends. */
function tableClient(rows: Row[], error: { code: string; message: string } | null = null) {
  const supabase = {
    from: () => ({
      update(patch: Partial<Row>) {
        const filters: Array<(row: Row) => boolean> = [];
        const chain = {
          eq(column: keyof Row, value: unknown) {
            filters.push((row) => row[column] === value);
            return chain;
          },
          lt(column: keyof Row, value: string) {
            filters.push((row) => String(row[column]) < value);
            return chain;
          },
          async select() {
            if (error) return { data: null, error };
            const hit = rows.filter((row) => filters.every((f) => f(row)));
            hit.forEach((row) => Object.assign(row, patch));
            return { data: hit.map((row) => ({ id: row.id })), error: null };
          },
        };
        return chain;
      },
    }),
  } as unknown as MatcherClient;
  return supabase;
}

const NOW = new Date("2026-10-08T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const row = (id: string, user: string, status: string, ageMs: number): Row => ({
  id, user_id: user, import_status: status, import_error: null, created_at: ago(ageMs),
});

describe("sweepStuckImports", () => {
  it("fails importing rows older than 5 minutes with import_error=timeout, leaves a fresh one alone", async () => {
    const rows = [row("old", "u1", "importing", IMPORT_TIMEOUT_MS + 1000), row("fresh", "u1", "importing", IMPORT_TIMEOUT_MS - 1000)];
    const swept = await sweepStuckImports(tableClient(rows), "u1", NOW);
    expect(swept).toBe(1);
    expect(rows[0]).toMatchObject({ import_status: "failed", import_error: "timeout" });
    expect(rows[1]).toMatchObject({ import_status: "importing", import_error: null });
  });

  it("never touches another user's rows or rows that are not importing", async () => {
    const rows = [
      row("other", "u2", "importing", IMPORT_TIMEOUT_MS * 2),
      row("done", "u1", "done", IMPORT_TIMEOUT_MS * 2),
      row("failed", "u1", "failed", IMPORT_TIMEOUT_MS * 2),
    ];
    expect(await sweepStuckImports(tableClient(rows), "u1", NOW)).toBe(0);
    expect(rows.map((r) => r.import_status)).toEqual(["importing", "done", "failed"]);
    expect(rows.map((r) => r.import_error)).toEqual([null, null, null]);
  });

  it("never throws: a database error is logged and swallowed", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sweepStuckImports(tableClient([], { code: "42501", message: "denied" }), "u1", NOW)).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
