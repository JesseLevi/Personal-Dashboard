import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock, userIdMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  userIdMock: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock, rpc: rpcMock }),
}));
vi.mock("@/lib/boards/session", () => ({ requireUserId: userIdMock }));

import {
  addSubtasks,
  deleteSubtask,
  listSubtasks,
  promoteSubtask,
  renameSubtask,
  setSubtaskDone,
} from "../app/(app)/te-doen/actions";
import { addSubtasksSchema, MAX_SUBTASKS_PER_CARD } from "../lib/boards/schemas";

const ID = "11111111-1111-4111-8111-111111111111";
const CARD = "22222222-2222-4222-8222-222222222222";

type Result = { data: unknown; error: { code: string; message: string } | null; count?: number | null };

// Chainable query builder; awaiting it (or a terminal) resolves to `result`.
// `calls` records the verbs and filters so tests can assert what was sent.
function builder(result: Result) {
  const calls: Array<[string, ...unknown[]]> = [];
  const b: Record<string, unknown> = {};
  for (const m of ["update", "delete", "select", "order", "limit", "insert", "eq"]) {
    b[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return b;
    };
  }
  b.maybeSingle = async () => result;
  b.single = async () => result;
  b.then = (resolve: (value: Result) => void) => resolve(result);
  return { b, calls };
}

const ok: Result = { data: { id: ID }, error: null };
const none: Result = { data: null, error: null };
const denied: Result = { data: null, error: { code: "42501", message: "rls" } };
const broken: Result = { data: null, error: { code: "XX000", message: "boom" } };

beforeEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
  userIdMock.mockReset();
  userIdMock.mockResolvedValue({ userId: "user-1" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("addSubtasksSchema", () => {
  it("trims titles and drops empty ones", () => {
    const parsed = addSubtasksSchema.safeParse({ cardId: CARD, titles: [" a ", "", "   ", "b"] });
    expect(parsed.success && parsed.data.titles).toEqual(["a", "b"]);
  });

  it("needs 1 to 50 titles left, each at most 200 characters", () => {
    expect(addSubtasksSchema.safeParse({ cardId: CARD, titles: ["", "  "] }).success).toBe(false);
    expect(addSubtasksSchema.safeParse({ cardId: CARD, titles: [] }).success).toBe(false);
    const fifty = Array.from({ length: MAX_SUBTASKS_PER_CARD }, (_, i) => `t${i}`);
    expect(addSubtasksSchema.safeParse({ cardId: CARD, titles: fifty }).success).toBe(true);
    expect(addSubtasksSchema.safeParse({ cardId: CARD, titles: [...fifty, "x"] }).success).toBe(false);
    expect(addSubtasksSchema.safeParse({ cardId: CARD, titles: ["x".repeat(201)] }).success).toBe(false);
    expect(addSubtasksSchema.safeParse({ cardId: "nope", titles: ["x"] }).success).toBe(false);
  });
});

describe("validation and the auth guard", () => {
  const cases: Array<[string, () => Promise<{ success: boolean; error?: string }>, () => Promise<{ success: boolean; error?: string }>]> = [
    ["listSubtasks", () => listSubtasks({ cardId: "bad" }), () => listSubtasks({ cardId: CARD })],
    ["addSubtasks", () => addSubtasks({ cardId: CARD, titles: [] }), () => addSubtasks({ cardId: CARD, titles: ["a"] })],
    ["renameSubtask", () => renameSubtask({ id: ID, title: "  " }), () => renameSubtask({ id: ID, title: "a" })],
    ["setSubtaskDone", () => setSubtaskDone({ id: ID, done: "yes" }), () => setSubtaskDone({ id: ID, done: true })],
    ["deleteSubtask", () => deleteSubtask({ id: "bad" }), () => deleteSubtask({ id: ID })],
    ["promoteSubtask", () => promoteSubtask({ id: "bad" }), () => promoteSubtask({ id: ID })],
  ];

  it.each(cases)("%s rejects bad input before touching the database", async (_name, invalid) => {
    expect(await invalid()).toEqual({ success: false, error: "invalid-input" });
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each(cases)("%s is unauthenticated without a session", async (_name, _invalid, valid) => {
    userIdMock.mockResolvedValue({ error: "unauthenticated" });
    expect(await valid()).toEqual({ success: false, error: "unauthenticated" });
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe.each([
  ["renameSubtask", () => renameSubtask({ id: ID, title: "Nieuw" })],
  ["setSubtaskDone", () => setSubtaskDone({ id: ID, done: true })],
  ["deleteSubtask", () => deleteSubtask({ id: ID })],
] as const)("%s access via RLS", (_name, run) => {
  it("succeeds on the id alone, with no app-side user_id filter", async () => {
    const q = builder(ok);
    fromMock.mockReturnValue(q.b);
    expect(await run()).toEqual({ success: true, data: undefined });
    expect(fromMock).toHaveBeenCalledWith("card_subtasks");
    expect(q.calls.filter(([m]) => m === "eq")).toEqual([["eq", "id", ID]]);
  });

  it("translates 0 rows into not-found, 42501 into read-only, other errors into generic", async () => {
    fromMock.mockReturnValue(builder(none).b);
    expect(await run()).toEqual({ success: false, error: "not-found" });
    fromMock.mockReturnValue(builder(denied).b);
    expect(await run()).toEqual({ success: false, error: "read-only" });
    fromMock.mockReturnValue(builder(broken).b);
    expect(await run()).toEqual({ success: false, error: "generic" });
  });
});

describe("listSubtasks", () => {
  it("reads one card's subtasks in position order", async () => {
    const q = builder({ data: [{ id: ID }], error: null });
    fromMock.mockReturnValue(q.b);
    expect(await listSubtasks({ cardId: CARD })).toEqual({ success: true, data: [{ id: ID }] });
    expect(q.calls).toContainEqual(["eq", "card_id", CARD]);
    expect(q.calls).toContainEqual(["order", "position", { ascending: true }]);
  });

  it("maps a database error to generic", async () => {
    fromMock.mockReturnValue(builder(broken).b);
    expect(await listSubtasks({ cardId: CARD })).toEqual({ success: false, error: "generic" });
  });
});

describe("addSubtasks", () => {
  // from() is called for cards (lookup), card_subtasks (count), card_subtasks
  // (last position), card_subtasks (insert), in that order.
  function wire(opts: { card: Result; count?: number; last?: number | null; insert?: Result }) {
    const inserts: unknown[] = [];
    const insertQuery = builder(opts.insert ?? { data: [], error: null });
    const insertBuilder = insertQuery.b;
    const origInsert = insertBuilder.insert as (...args: unknown[]) => unknown;
    insertBuilder.insert = (rows: unknown) => {
      inserts.push(rows);
      return origInsert(rows);
    };
    fromMock
      .mockReturnValueOnce(builder(opts.card).b)
      .mockReturnValueOnce(builder({ data: null, error: null, count: opts.count ?? 0 }).b)
      .mockReturnValueOnce(
        builder({ data: opts.last == null ? null : { position: opts.last }, error: null }).b,
      )
      .mockReturnValueOnce(insertBuilder);
    return inserts;
  }

  it("inserts all titles in one statement, appended after the last position", async () => {
    const inserts = wire({ card: ok, count: 2, last: 2000, insert: { data: [{ position: 4000 }, { position: 3000 }], error: null } });
    const res = await addSubtasks({ cardId: CARD, titles: [" a ", "", "b"] });
    expect(res).toEqual({ success: true, data: [{ position: 3000 }, { position: 4000 }] });
    expect(inserts).toEqual([
      [
        { user_id: "user-1", card_id: CARD, title: "a", position: 3000 },
        { user_id: "user-1", card_id: CARD, title: "b", position: 4000 },
      ],
    ]);
  });

  it("starts at 1000 on a card without subtasks", async () => {
    const inserts = wire({ card: ok, last: null });
    await addSubtasks({ cardId: CARD, titles: ["a"] });
    expect(inserts).toEqual([[{ user_id: "user-1", card_id: CARD, title: "a", position: 1000 }]]);
  });

  it("refuses the whole batch when it would pass 50, and inserts nothing", async () => {
    const inserts = wire({ card: ok, count: 49 });
    expect(await addSubtasks({ cardId: CARD, titles: ["a", "b"] })).toEqual({
      success: false,
      error: "invalid-input",
    });
    expect(inserts).toEqual([]);
  });

  it("accepts a batch that lands exactly on 50", async () => {
    wire({ card: ok, count: 49, insert: { data: [{ position: 1000 }], error: null } });
    expect((await addSubtasks({ cardId: CARD, titles: ["a"] })).success).toBe(true);
  });

  it("is not-found for a card RLS hides", async () => {
    const inserts = wire({ card: none });
    expect(await addSubtasks({ cardId: CARD, titles: ["a"] })).toEqual({ success: false, error: "not-found" });
    expect(inserts).toEqual([]);
  });

  it("maps a refused insert to read-only and others to generic", async () => {
    wire({ card: ok, insert: denied });
    expect(await addSubtasks({ cardId: CARD, titles: ["a"] })).toEqual({ success: false, error: "read-only" });
    wire({ card: ok, insert: broken });
    expect(await addSubtasks({ cardId: CARD, titles: ["a"] })).toEqual({ success: false, error: "generic" });
  });
});

describe("promoteSubtask", () => {
  it("returns the new card id from the RPC", async () => {
    rpcMock.mockResolvedValue({ data: CARD, error: null });
    expect(await promoteSubtask({ id: ID })).toEqual({ success: true, data: { cardId: CARD } });
    expect(rpcMock).toHaveBeenCalledWith("promote_card_subtask", { p_subtask_id: ID });
  });

  it("maps MV404 to not-found, 42501 to read-only and anything else to generic", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "MV404", message: "x" } });
    expect(await promoteSubtask({ id: ID })).toEqual({ success: false, error: "not-found" });
    rpcMock.mockResolvedValue({ data: null, error: { code: "42501", message: "x" } });
    expect(await promoteSubtask({ id: ID })).toEqual({ success: false, error: "read-only" });
    rpcMock.mockResolvedValue({ data: null, error: { code: "XX000", message: "x" } });
    expect(await promoteSubtask({ id: ID })).toEqual({ success: false, error: "generic" });
    rpcMock.mockResolvedValue({ data: null, error: null });
    expect(await promoteSubtask({ id: ID })).toEqual({ success: false, error: "generic" });
  });
});
