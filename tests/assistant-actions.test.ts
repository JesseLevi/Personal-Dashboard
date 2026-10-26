import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const state = {
  userId: "u1" as string | null,
  row: null as Record<string, unknown> | null,
  rpcError: null as { code: string; message: string } | null,
  inserted: [] as Record<string, unknown>[],
  rpcCalls: [] as Array<[string, unknown]>,
  defaultList: "list-1" as string | null,
};

vi.mock("@/lib/boards/session", () => ({
  requireUserId: async () => (state.userId ? { userId: state.userId } : { error: "unauthenticated" }),
}));
vi.mock("@/lib/shopping/lists", () => ({ getDefaultShoppingListId: async () => state.defaultList }));
vi.mock("@/lib/assistant/signals", async (orig) => ({
  ...(await orig<typeof import("@/lib/assistant/signals")>()),
  getAssistantSignalRow: async () => state.row,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (name: string, args: unknown) => {
      state.rpcCalls.push([name, args]);
      return { error: state.rpcError };
    },
    from: (table: string) => {
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        order: () => b,
        limit: () => b,
        in: async () => ({ data: table === "notes" ? [{ id: "n1" }] : [], error: null }),
        maybeSingle: async () => ({ data: { position: 1000 } }),
        insert: async (r: Record<string, unknown>) => {
          state.inserted.push(r);
          return { error: null };
        },
      };
      return b;
    },
  }),
}));

import { actOnAssistantSignal, dismissAssistantSignal } from "@/lib/assistant/actions";

const ID = "33333333-3333-4333-8333-333333333333";
const buyRow = (status = "new") => ({
  id: ID,
  kind: "buy_rhythm",
  created_at: "2026-10-26T08:00:00Z",
  payload: { item_name: "Melk", median_days: 7, days_since: 9 },
  message: null,
  status,
});

beforeEach(() => {
  Object.assign(state, { userId: "u1", row: buyRow(), rpcError: null, inserted: [], rpcCalls: [], defaultList: "list-1" });
});

describe("dismissAssistantSignal", () => {
  it("rejects a non-uuid id", async () => {
    expect(await dismissAssistantSignal("nope")).toEqual({ success: false, error: "invalid-input" });
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("requires a signed-in member", async () => {
    state.userId = null;
    expect(await dismissAssistantSignal(ID)).toEqual({ success: false, error: "unauthenticated" });
  });

  it("sets the status to dismissed", async () => {
    expect(await dismissAssistantSignal(ID)).toEqual({ success: true });
    expect(state.rpcCalls).toEqual([["set_agent_signal_status", { p_id: ID, p_status: "dismissed" }]]);
  });

  it("maps a foreign id and an already handled signal to clean errors", async () => {
    state.rpcError = { code: "P0002", message: "signal not found" };
    expect(await dismissAssistantSignal(ID)).toEqual({ success: false, error: "not-found" });
    state.rpcError = { code: "22023", message: "invalid status transition" };
    expect(await dismissAssistantSignal(ID)).toEqual({ success: false, error: "already-handled" });
  });
});

describe("actOnAssistantSignal", () => {
  it("rejects invalid input and unknown or foreign ids", async () => {
    expect(await actOnAssistantSignal(42)).toEqual({ success: false, error: "invalid-input" });
    state.row = null;
    expect(await actOnAssistantSignal(ID)).toEqual({ success: false, error: "not-found" });
  });

  it("does nothing for an already handled signal", async () => {
    state.row = buyRow("acted");
    expect(await actOnAssistantSignal(ID)).toEqual({ success: false, error: "already-handled" });
    expect(state.inserted).toHaveLength(0);
  });

  it("adds the item to the default basket, then marks the signal acted", async () => {
    expect(await actOnAssistantSignal(ID)).toEqual({ success: true });
    expect(state.inserted).toEqual([{ user_id: "u1", list_id: "list-1", name: "Melk", position: 2000 }]);
    expect(state.rpcCalls).toEqual([["set_agent_signal_status", { p_id: ID, p_status: "acted" }]]);
  });

  it("leaves the signal new when there is no basket to add to", async () => {
    state.defaultList = null;
    expect(await actOnAssistantSignal(ID)).toEqual({ success: false, error: "generic" });
    expect(state.rpcCalls.map(([name]) => name)).toEqual(["ensure_user_defaults"]);
  });

  it("returns the href for a link action and marks it acted", async () => {
    state.row = {
      ...buyRow(),
      kind: "pattern",
      message: "Een patroon",
      payload: { sources: [{ type: "note", id: "n1" }] },
    };
    expect(await actOnAssistantSignal(ID)).toEqual({ success: true, href: "/notities/n1" });
    expect(state.inserted).toHaveLength(0);
  });

  it("reports not-found when the target is gone", async () => {
    state.row = {
      ...buyRow(),
      kind: "pattern",
      message: "Een patroon",
      payload: { sources: [{ type: "note", id: "weg" }] },
    };
    expect(await actOnAssistantSignal(ID)).toEqual({ success: false, error: "not-found" });
  });
});
