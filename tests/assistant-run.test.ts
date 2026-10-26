import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const createService = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: createService }));

import { GET } from "@/app/api/cron/assistant/route";
import { runAssistant, runAssistantForAllMembers } from "@/lib/assistant/run";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function fakeClient(options: { claimed?: boolean; failOn?: string; ids?: string[]; created?: number } = {}) {
  const calls: string[] = [];
  const users: string[] = [];
  const rpc = vi.fn(async (name: string, args?: { p_user: string }) => {
    if (args) users.push(args.p_user);
    calls.push(name);
    if (options.failOn === name) return { data: null, error: { code: "XX" } };
    if (name === "claim_assistant_run") return { data: options.claimed ?? true, error: null };
    return { data: options.created ?? 2, error: null };
  });
  const client = {
    rpc,
    from: () => ({
      select: () => ({ order: async () => ({ data: (options.ids ?? []).map((id) => ({ id })), error: null }) }),
    }),
  };
  return { client: client as never, rpc, calls, users };
}

describe("runAssistant lazy", () => {
  it("claims, then settles, then detects", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { client, calls } = fakeClient();
    expect(await runAssistant({ client, userId: "u", path: "lazy" })).toBe(2);
    expect(calls).toEqual(["claim_assistant_run", "settle_cooked_meals", "detect_rhythm_signals"]);
  });

  it("does nothing when the slot is not claimed", async () => {
    const { client, calls } = fakeClient({ claimed: false });
    expect(await runAssistant({ client, userId: "u", path: "lazy" })).toBeNull();
    expect(calls).toEqual(["claim_assistant_run"]);
  });

  it("logs one JSON line without content", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await runAssistant({ client: fakeClient().client, userId: "secret-id", path: "lazy" });
    expect(info).toHaveBeenCalledTimes(1);
    const line = JSON.parse(info.mock.calls[0][0] as string);
    expect(Object.keys(line).sort()).toEqual(["created", "event", "ms", "path"]);
    expect(line).toMatchObject({ event: "assistant_run", path: "lazy", created: 2 });
  });

  it("fails silently", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ failOn: "detect_rhythm_signals" });
    await expect(runAssistant({ client, userId: "u", path: "lazy" })).resolves.toBeNull();
    const thrower = { rpc: () => Promise.reject(new Error("boom")) } as never;
    await expect(runAssistant({ client: thrower, userId: "u", path: "lazy" })).resolves.toBeNull();
  });
});

describe("runAssistant cron", () => {
  it("calls only the _for detector", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { client, rpc } = fakeClient();
    await runAssistant({ client, userId: "u", path: "cron" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("detect_rhythm_signals_for", { p_user: "u" });
  });
});

describe("runAssistantForAllMembers", () => {
  it("runs every member and sums the new signals", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { client } = fakeClient({ ids: ["a", "b"] });
    expect(await runAssistantForAllMembers(client, { budgetMs: 1000, now: 0 })).toEqual({
      members: 2,
      failed: 0,
      remaining: 0,
      created: 4,
    });
  });

  it("stops at the budget and reports what is left", async () => {
    const { client, rpc } = fakeClient({ ids: ["a", "b", "c"] });
    expect(await runAssistantForAllMembers(client, { budgetMs: 0 })).toMatchObject({ members: 0, remaining: 3 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("counts failures and keeps going", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ ids: ["a", "b"], failOn: "detect_rhythm_signals_for" });
    expect(await runAssistantForAllMembers(client, { budgetMs: 1000 })).toMatchObject({ members: 0, failed: 2 });
  });

  it("rotates the start member per day", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { client, users } = fakeClient({ ids: ["a", "b", "c"] });
    await runAssistantForAllMembers(client, { budgetMs: 1000, now: 86_400_000 });
    expect(users).toEqual(["b", "c", "a"]);
  });
});

describe("GET /api/cron/assistant", () => {
  it("answers 401 without the cron secret, before a service client exists", async () => {
    vi.stubEnv("CRON_SECRET", "x".repeat(32));
    for (const headers of [new Headers(), new Headers({ authorization: "Bearer fout" })]) {
      const response = await GET(new Request("http://localhost/api/cron/assistant", { headers }));
      expect(response.status).toBe(401);
    }
    expect(createService).not.toHaveBeenCalled();
  });

  it("answers 401 when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(
      new Request("http://localhost/api/cron/assistant", { headers: { authorization: "Bearer " } }),
    );
    expect(response.status).toBe(401);
  });
});
