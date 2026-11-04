import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { matchingSignalIdsForNames, settleBuyRhythmForNames } from "@/lib/assistant/settle";

const rows = [
  { id: "a", payload: { item_name: "Bloem" } },
  { id: "b", payload: { item_name: "  melk " } },
  { id: "c", payload: { item_name: "Kaas" } },
  { id: "d", payload: { nonsense: true } },
];

function fakeClient(options: { selectError?: boolean } = {}) {
  const query = { eq: vi.fn() };
  query.eq
    .mockReturnValueOnce(query)
    .mockResolvedValueOnce(options.selectError ? { data: null, error: { code: "XX" } } : { data: rows, error: null });
  const rpc = vi.fn(async () => ({ error: null }));
  const from = vi.fn(() => ({ select: () => query }));
  return { client: { from, rpc } as never, from, rpc };
}

describe("matchingSignalIdsForNames", () => {
  it("matches several names, ignoring case and surrounding spaces", () => {
    expect(matchingSignalIdsForNames(rows, [" BLOEM ", "Melk"])).toEqual(["a", "b"]);
  });

  it("returns each id once and nothing for unknown names", () => {
    expect(matchingSignalIdsForNames(rows, ["kaas", "KAAS", "boter"])).toEqual(["c"]);
    expect(matchingSignalIdsForNames(rows, [])).toEqual([]);
  });
});

describe("settleBuyRhythmForNames", () => {
  it("does one select and settles every matching signal", async () => {
    const { client, from, rpc } = fakeClient();
    await settleBuyRhythmForNames(client, ["bloem", "MELK", "boter"]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith("set_agent_signal_status", { p_id: "a", p_status: "acted" });
    expect(rpc).toHaveBeenCalledWith("set_agent_signal_status", { p_id: "b", p_status: "acted" });
  });

  it("does nothing for an empty list", async () => {
    const { client, from } = fakeClient();
    await settleBuyRhythmForNames(client, []);
    expect(from).not.toHaveBeenCalled();
  });

  it("never throws when the select fails", async () => {
    const { client, rpc } = fakeClient({ selectError: true });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(settleBuyRhythmForNames(client, ["bloem"])).resolves.toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
