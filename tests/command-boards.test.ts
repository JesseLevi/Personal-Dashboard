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

// Records the order calls and resolves the final overrideTypes() to `result`.
function boardsBuilder(result: Result) {
  const orders: Array<[string, unknown]> = [];
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
  b.overrideTypes = async () => result;
  return { builder: b, orders, selects };
}

const column = (position: number, count: number) => ({ position, cards: [{ count }] });

beforeEach(() => {
  fromMock.mockReset();
  requireUserIdMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getCommandBoards", () => {
  it("reads boards, columns and card counts in one query, favourites first", async () => {
    const { builder, orders, selects } = boardsBuilder({
      data: [
        { id: "b1", name: "Werk", is_favorite: true, board_columns: [column(0, 2), column(3, 3), column(1, 1)] },
        { id: "b2", name: "Thuis", is_favorite: false, board_columns: [] },
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const boards = await getCommandBoards();

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("boards");
    expect(selects[0]).toContain("board_columns(position, cards(count))");
    expect(orders).toEqual([
      ["is_favorite", { ascending: false }],
      ["position", { ascending: true }],
    ]);
    expect(boards).toEqual([
      { id: "b1", name: "Werk", href: "/te-doen/b1", isFavorite: true, total: 6, done: 3 },
      { id: "b2", name: "Thuis", href: "/te-doen/b2", isFavorite: false, total: 0, done: 0 },
    ]);
  });

  it("treats a column without a count row as empty", async () => {
    const { builder } = boardsBuilder({
      data: [{ id: "b1", name: "Werk", is_favorite: false, board_columns: [{ position: 0, cards: [] }] }],
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
      data: [{ id: "b1", name: "Werk", is_favorite: true, board_columns: [column(0, 1)] }],
      error: null,
    });
    fromMock.mockReturnValue(builder);
    expect(await getCommandBoardsAction()).toEqual({
      success: true,
      data: [{ id: "b1", name: "Werk", href: "/te-doen/b1", isFavorite: true, total: 1, done: 1 }],
    });
  });

  it("answers generic without leaking the database error", async () => {
    requireUserIdMock.mockResolvedValue({ userId: "u1" });
    const { builder } = boardsBuilder({ data: null, error: { code: "X", message: "secret detail" } });
    fromMock.mockReturnValue(builder);
    expect(await getCommandBoardsAction()).toEqual({ success: false, error: "generic" });
  });
});
