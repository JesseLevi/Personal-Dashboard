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

import { getCommandProjectsAction } from "../app/(app)/command-actions";
import { getCommandProjects } from "@/lib/command/projects";

type Result = { data: unknown; error: { code: string; message: string } | null };

function projectsBuilder(result: Result) {
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
  b.limit = () => b;
  b.overrideTypes = async () => result;
  return { builder: b, orders, selects };
}

// A card on board b1 in a column at `position`; the board has columns 0..2.
const card = (id: string, position: number, subtasks: boolean[]) => ({
  id,
  title: `Titel ${id}`,
  updated_at: "2026-10-01T00:00:00Z",
  card_subtasks: subtasks.map((done) => ({ done })),
  column: { position, board: { id: "b1", name: "Bord b1", board_columns: [{ position: 0 }, { position: 1 }, { position: 2 }] } },
});

beforeEach(() => {
  fromMock.mockReset();
  requireUserIdMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getCommandProjects", () => {
  it("reads cards with subtasks in one query, newest first, and shapes the rows", async () => {
    const { builder, orders, selects } = projectsBuilder({ data: [card("c1", 0, [true, false, false])], error: null });
    fromMock.mockReturnValue(builder);

    const projects = await getCommandProjects();

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("cards");
    expect(selects[0]).toContain("card_subtasks!inner(done)");
    expect(orders).toEqual([["updated_at", { ascending: false }]]);
    expect(projects).toEqual([
      { id: "c1", title: "Titel c1", href: "/te-doen/b1?card=c1", boardName: "Bord b1", total: 3, done: 1 },
    ]);
  });

  it("keeps the database order and excludes cards in the done column (last by position)", async () => {
    const { builder } = projectsBuilder({
      data: [card("c1", 2, [true]), card("c2", 1, [false]), card("c3", 0, [false])],
      error: null,
    });
    fromMock.mockReturnValue(builder);
    expect((await getCommandProjects()).map((p) => p.id)).toEqual(["c2", "c3"]);
  });

  it("caps the list at 50", async () => {
    const many = Array.from({ length: 80 }, (_, i) => card(`c${i}`, 0, [false]));
    const { builder } = projectsBuilder({ data: many, error: null });
    fromMock.mockReturnValue(builder);
    expect(await getCommandProjects()).toHaveLength(50);
  });

  it("throws a generic error when the query fails", async () => {
    const { builder } = projectsBuilder({ data: null, error: { code: "X", message: "secret detail" } });
    fromMock.mockReturnValue(builder);
    await expect(getCommandProjects()).rejects.toThrow("Failed to load projects");
  });
});

describe("getCommandProjectsAction", () => {
  it("refuses a signed-out caller without touching the database", async () => {
    requireUserIdMock.mockResolvedValue({ error: "unauthenticated" });
    expect(await getCommandProjectsAction()).toEqual({ success: false, error: "unauthenticated" });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns the projects for a signed-in member", async () => {
    requireUserIdMock.mockResolvedValue({ userId: "u1" });
    const { builder } = projectsBuilder({ data: [card("c1", 0, [true, true])], error: null });
    fromMock.mockReturnValue(builder);
    expect(await getCommandProjectsAction()).toEqual({
      success: true,
      data: [{ id: "c1", title: "Titel c1", href: "/te-doen/b1?card=c1", boardName: "Bord b1", total: 2, done: 2 }],
    });
  });

  it("answers generic without leaking the database error", async () => {
    requireUserIdMock.mockResolvedValue({ userId: "u1" });
    const { builder } = projectsBuilder({ data: null, error: { code: "X", message: "secret detail" } });
    fromMock.mockReturnValue(builder);
    expect(await getCommandProjectsAction()).toEqual({ success: false, error: "generic" });
  });
});
