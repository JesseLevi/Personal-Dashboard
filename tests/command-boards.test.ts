import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, requireUserIdMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  requireUserIdMock: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));
vi.mock("@/lib/boards/session", () => ({ requireUserId: requireUserIdMock }));

import { getCommandBoardsAction } from "../app/(app)/command-actions";
import { getCommandBoards } from "@/lib/command/boards";

type Result = { data: unknown; error: { code: string; message: string } | null };

// Records the order and limit calls and resolves the final overrideTypes() to `result`.
function boardsBuilder(result: Result) {
  const orders: Array<[string, unknown]> = [];
  const limits: Array<[number, unknown]> = [];
  const selects: string[] = [];
  const b: Record<string, unknown> = {};
  b.select = (columns: string) => {
    selects.push(columns);
    return b;
  };
  b.order = (column: string, options: unknown) => {
    orders.push([column, options]);
    return b;
  };
  b.limit = (rows: number, options: unknown) => {
    limits.push([rows, options]);
    return b;
  };
  b.overrideTypes = async () => result;
  return { builder: b, orders, selects, limits };
}

const column = (position: number, count: number, latest?: string) => ({
  position,
  cards: [{ count }],
  latest: latest ? [{ updated_at: latest }] : [],
});

const board = (id: string, updatedAt: string, columns: unknown[] = [], isFavorite = false) => ({
  id,
  name: id,
  is_favorite: isFavorite,
  updated_at: updatedAt,
  board_columns: columns,
});

const ids = (boards: Array<{ id: string }>) => boards.map((b) => b.id);

beforeEach(() => {
  fromMock.mockReset();
  requireUserIdMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getCommandBoards", () => {
  it("reads boards, columns, card counts and the newest card per column in one query", async () => {
    const { builder, orders, selects, limits } = boardsBuilder({
      data: [
        board("b1", "2026-10-01T10:00:00+00:00", [column(0, 2), column(3, 3), column(1, 1)], true),
        board("b2", "2026-10-01T09:00:00+00:00"),
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const boards = await getCommandBoards();

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("boards");
    expect(selects[0]).toContain("board_columns(position, cards(count), latest:cards(updated_at))");
    expect(orders).toEqual([
      ["position", { ascending: true }],
      ["updated_at", { ascending: false, referencedTable: "board_columns.latest" }],
    ]);
    expect(limits).toEqual([[1, { referencedTable: "board_columns.latest" }]]);
    expect(boards).toEqual([
      { id: "b1", name: "b1", href: "/te-doen/b1", isFavorite: true, total: 6, done: 3 },
      { id: "b2", name: "b2", href: "/te-doen/b2", isFavorite: false, total: 0, done: 0 },
    ]);
  });

  it("orders by the latest card activity, not by favourite or position", async () => {
    const { builder } = boardsBuilder({
      data: [
        board("fav", "2026-10-01T00:00:00Z", [column(0, 1, "2026-10-02T00:00:00Z")], true),
        board("busy", "2026-09-01T00:00:00Z", [column(0, 1, "2026-09-05T00:00:00Z"), column(1, 1, "2026-10-20T00:00:00Z")]),
        board("quiet", "2026-10-10T00:00:00Z", [column(0, 1, "2026-08-01T00:00:00Z")]),
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);
    expect(ids(await getCommandBoards())).toEqual(["busy", "quiet", "fav"]);
  });

  it("falls back to the board's own updated_at without cards, and keeps board order on a tie", async () => {
    const { builder } = boardsBuilder({
      data: [
        board("a", "2026-10-05T00:00:00Z"),
        board("b", "2026-10-05T00:00:00Z", [column(0, 0)]),
        board("c", "2026-09-01T00:00:00Z", [column(0, 1, "2026-10-06T00:00:00Z")]),
        board("d", "2026-10-07T00:00:00Z"),
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);
    expect(ids(await getCommandBoards())).toEqual(["d", "c", "a", "b"]);
  });

  it("returns every board, not a capped list", async () => {
    const many = Array.from({ length: 12 }, (_, i) => board(`b${i}`, `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
    const { builder } = boardsBuilder({ data: many, error: null });
    fromMock.mockReturnValue(builder);
    expect(await getCommandBoards()).toHaveLength(12);
  });

  it("treats a column without a count row as empty", async () => {
    const { builder } = boardsBuilder({
      data: [board("b1", "2026-10-01T00:00:00Z", [{ position: 0, cards: [], latest: [] }])],
      error: null,
    });
    fromMock.mockReturnValue(builder);
    expect((await getCommandBoards())[0]).toMatchObject({ total: 0, done: 0 });
  });

  it("throws a generic error when the query fails", async () => {
    const { builder } = boardsBuilder({ data: null, error: { code: "X", message: "secret detail" } });
    fromMock.mockReturnValue(builder);
    await expect(getCommandBoards()).rejects.toThrow("Failed to load boards");
  });
});

describe("getCommandBoardsAction", () => {
  it("refuses a signed-out caller without touching the database", async () => {
    requireUserIdMock.mockResolvedValue({ error: "unauthenticated" });
    expect(await getCommandBoardsAction()).toEqual({ success: false, error: "unauthenticated" });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns the boards for a signed-in member", async () => {
    requireUserIdMock.mockResolvedValue({ userId: "u1" });
    const { builder } = boardsBuilder({
      data: [board("b1", "2026-10-01T00:00:00Z", [column(0, 1)], true)],
      error: null,
    });
    fromMock.mockReturnValue(builder);
    expect(await getCommandBoardsAction()).toEqual({
      success: true,
      data: [{ id: "b1", name: "b1", href: "/te-doen/b1", isFavorite: true, total: 1, done: 1 }],
    });
  });

  it("answers generic without leaking the database error", async () => {
    requireUserIdMock.mockResolvedValue({ userId: "u1" });
    const { builder } = boardsBuilder({ data: null, error: { code: "X", message: "secret detail" } });
    fromMock.mockReturnValue(builder);
    expect(await getCommandBoardsAction()).toEqual({ success: false, error: "generic" });
  });
});
