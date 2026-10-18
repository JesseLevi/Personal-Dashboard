import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, userIdMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  userIdMock: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));
vi.mock("@/lib/boards/session", () => ({ requireUserId: userIdMock }));

import {
  createCard,
  createColumn,
  deleteCard,
  deleteColumn,
  renameBoard,
  renameColumn,
  updateCard,
} from "../app/(app)/te-doen/actions";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

type Result = { data: unknown; error: { code: string; message: string } | null };

// A chainable query builder: every method returns the builder, and awaiting a
// terminal (maybeSingle) resolves to `result`. `eqCalls` records the filters.
function builder(result: Result) {
  const eqCalls: Array<[string, unknown]> = [];
  const b: Record<string, unknown> = {};
  for (const m of ["update", "delete", "select", "order", "limit", "insert"]) b[m] = () => b;
  b.eq = (column: string, value: unknown) => {
    eqCalls.push([column, value]);
    return b;
  };
  b.maybeSingle = async () => result;
  b.single = async () => result;
  return { b, eqCalls };
}

const ok: Result = { data: { id: ID }, error: null };
const none: Result = { data: null, error: null };
const denied: Result = { data: null, error: { code: "42501", message: "rls" } };
const broken: Result = { data: null, error: { code: "XX000", message: "boom" } };

beforeEach(() => {
  fromMock.mockReset();
  userIdMock.mockReset();
  userIdMock.mockResolvedValue({ userId: "user-1" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const cases: Array<[string, () => Promise<{ success: boolean; error?: string }>]> = [
  ["renameBoard", () => renameBoard({ boardId: ID, name: "Nieuw" })],
  ["renameColumn", () => renameColumn({ columnId: ID, name: "Nieuw" })],
  ["deleteColumn", () => deleteColumn({ columnId: ID })],
  ["updateCard", () => updateCard({ cardId: ID, title: "Nieuw" })],
  ["deleteCard", () => deleteCard({ cardId: ID })],
  ["createColumn", () => createColumn({ boardId: ID, name: "Kolom", icon: "inbox" })],
  ["createCard", () => createCard({ columnId: ID, title: "Kaart", priority: "medium" })],
];

describe.each(cases)("%s access via RLS", (_name, run) => {
  it("translates 0 rows into not-found", async () => {
    fromMock.mockReturnValue(builder(none).b);
    expect(await run()).toEqual({ success: false, error: "not-found" });
  });

  it("translates 42501 into read-only", async () => {
    fromMock.mockReturnValue(builder(denied).b);
    expect(await run()).toEqual({ success: false, error: "read-only" });
  });

  it("translates other errors into generic", async () => {
    fromMock.mockReturnValue(builder(broken).b);
    expect(await run()).toEqual({ success: false, error: "generic" });
  });
});

describe("no app-side user_id filter", () => {
  it("filters updateCard and deleteCard on the card id only", async () => {
    const update = builder(ok);
    fromMock.mockReturnValue(update.b);
    expect(await updateCard({ cardId: ID, title: "Nieuw" })).toEqual({ success: true, data: undefined });
    expect(update.eqCalls).toEqual([["id", ID]]);

    const del = builder(ok);
    fromMock.mockReturnValue(del.b);
    expect(await deleteCard({ cardId: ID2 })).toEqual({ success: true, data: undefined });
    expect(del.eqCalls).toEqual([["id", ID2]]);
  });

  it("checks the column on id only before creating a card", async () => {
    const lookup = builder(ok);
    fromMock.mockReturnValue(lookup.b);
    await createCard({ columnId: ID, title: "Kaart", priority: "medium" });
    expect(lookup.eqCalls.every(([column]) => column !== "user_id")).toBe(true);
  });
});
