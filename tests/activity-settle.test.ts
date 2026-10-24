import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { settleAllMembers, settleCookedMeals } from "@/lib/activity/settle";

function fakeClient(options: { ids?: string[]; rpcError?: boolean; profilesError?: boolean }) {
  const rpc = vi.fn(async () => ({ data: 0, error: options.rpcError ? { code: "XX" } : null }));
  const client = {
    rpc,
    from: () => ({
      select: async () =>
        options.profilesError
          ? { data: null, error: { code: "XX" } }
          : { data: (options.ids ?? []).map((id) => ({ id })), error: null },
    }),
  };
  return { client: client as never, rpc };
}

describe("settleAllMembers", () => {
  it("settles every member", async () => {
    const { client, rpc } = fakeClient({ ids: ["a", "b"] });
    expect(await settleAllMembers(client, { budgetMs: 1000 })).toEqual({ members: 2, failed: 0, remaining: 0 });
    expect(rpc).toHaveBeenCalledWith("settle_cooked_meals_for", { p_user: "a" });
  });

  it("counts failures and keeps going", async () => {
    const { client } = fakeClient({ ids: ["a", "b"], rpcError: true });
    expect(await settleAllMembers(client, { budgetMs: 1000 })).toEqual({ members: 0, failed: 2, remaining: 0 });
  });

  it("stops at the budget and reports what is left", async () => {
    const { client, rpc } = fakeClient({ ids: ["a", "b", "c"] });
    expect(await settleAllMembers(client, { budgetMs: 0 })).toEqual({ members: 0, failed: 0, remaining: 3 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports a failed member list", async () => {
    const { client } = fakeClient({ profilesError: true });
    expect((await settleAllMembers(client, { budgetMs: 1000 })).failed).toBe(1);
  });
});

describe("settleCookedMeals", () => {
  it("never throws", async () => {
    const { client } = fakeClient({ rpcError: true });
    await expect(settleCookedMeals(client)).resolves.toBeUndefined();
  });
});
