import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/recipes/session", () => ({ requireUserId: async () => ({ userId: "user-1" }) }));

// #324 (ADR-0020 §5): a hand-typed name stays a plain name -- no
// public.ingredients row is created. Chainable fake records every table touched.
const touched: { table: string; op: string }[] = [];
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "eq", "order", "limit", "insert", "maybeSingle", "single"]) {
        chain[op] = () => {
          touched.push({ table, op });
          if (op === "maybeSingle") {
            const data = table === "shopping_lists" ? { id: "list-1" } : null;
            return Promise.resolve({ data, error: null });
          }
          if (op === "single") return Promise.resolve({ data: { id: "row-1", name: "Kokosmelk" }, error: null });
          return chain;
        };
      }
      return chain;
    },
  }),
}));

import { createOwnIngredient } from "@/app/(app)/recepten/actions";
import { addShoppingListItem } from "@/app/(app)/winkelmand/actions";

beforeEach(() => {
  touched.length = 0;
});

describe("plain names (#324)", () => {
  it("createOwnIngredient rejects referenceId null and never touches the database", async () => {
    const result = await createOwnIngredient({ name: "Kokosmelk", referenceId: null });
    expect(result).toEqual({ success: false, error: "invalid-input" });
    expect(touched).toHaveLength(0);
  });

  it("adding a plain name to the shopping list inserts no public.ingredients row", async () => {
    const result = await addShoppingListItem({ name: "Kokosmelk" });
    expect(result.success).toBe(true);
    expect(touched.some((c) => c.table === "ingredients")).toBe(false);
    expect(touched.some((c) => c.table === "shopping_list_items" && c.op === "insert")).toBe(true);
  });
});
