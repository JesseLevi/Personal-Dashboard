import { describe, expect, it } from "vitest";
import {
  boardIdSchema,
  createBoardSchema,
  createCardSchema,
  createColumnSchema,
  deleteCardSchema,
  moveCardSchema,
  renameBoardSchema,
  renameColumnSchema,
  updateCardSchema,
} from "../lib/boards/schemas";

const uuid = "123e4567-e89b-12d3-a456-426614174000";

describe("boardIdSchema", () => {
  it("accepts a uuid", () => {
    expect(boardIdSchema.safeParse({ boardId: uuid }).success).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    expect(boardIdSchema.safeParse({ boardId: "not-a-uuid" }).success).toBe(
      false,
    );
  });
});

describe("createBoardSchema", () => {
  it("accepts a non-empty name", () => {
    expect(createBoardSchema.safeParse({ name: "Werk" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(createBoardSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a whitespace-only name", () => {
    expect(createBoardSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects a name over 200 characters", () => {
    expect(
      createBoardSchema.safeParse({ name: "x".repeat(201) }).success,
    ).toBe(false);
  });
});

describe("renameBoardSchema", () => {
  it("accepts a boardId + name", () => {
    expect(
      renameBoardSchema.safeParse({ boardId: uuid, name: "Nieuwe naam" })
        .success,
    ).toBe(true);
  });

  it("rejects a missing boardId", () => {
    expect(renameBoardSchema.safeParse({ name: "Nieuwe naam" }).success).toBe(
      false,
    );
  });
});

describe("createColumnSchema", () => {
  it("accepts boardId + name + icon", () => {
    expect(
      createColumnSchema.safeParse({
        boardId: uuid,
        name: "In progress",
        icon: "Loader",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty icon", () => {
    expect(
      createColumnSchema.safeParse({ boardId: uuid, name: "X", icon: "" })
        .success,
    ).toBe(false);
  });
});

describe("renameColumnSchema", () => {
  it("accepts columnId + name", () => {
    expect(
      renameColumnSchema.safeParse({ columnId: uuid, name: "Klaar" }).success,
    ).toBe(true);
  });
});

describe("createCardSchema", () => {
  it("accepts the minimal shape (columnId + title only)", () => {
    expect(
      createCardSchema.safeParse({ columnId: uuid, title: "Boodschappen" })
        .success,
    ).toBe(true);
  });

  it("accepts every optional field filled in", () => {
    expect(
      createCardSchema.safeParse({
        columnId: uuid,
        title: "Boodschappen",
        description: "Melk, brood",
        priority: "urgent",
        size: "m",
        dueAt: "2026-08-01T10:00:00Z",
      }).success,
    ).toBe(true);
  });

  it("accepts a null description/size/dueAt", () => {
    expect(
      createCardSchema.safeParse({
        columnId: uuid,
        title: "Boodschappen",
        description: null,
        size: null,
        dueAt: null,
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid priority", () => {
    expect(
      createCardSchema.safeParse({
        columnId: uuid,
        title: "X",
        priority: "mid",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid size", () => {
    expect(
      createCardSchema.safeParse({ columnId: uuid, title: "X", size: "xxl" })
        .success,
    ).toBe(false);
  });

  it("rejects a non-ISO, non-date-text dueAt", () => {
    expect(
      createCardSchema.safeParse({
        columnId: uuid,
        title: "X",
        dueAt: "tomorrow",
      }).success,
    ).toBe(false);
  });

  // #94: the Datum field is plain text, dd-mm-yyyy/dd/mm/yyyy — parsed into
  // ISO server-side (lib/boards/dates.ts) rather than requiring the client
  // to already send ISO.
  it("accepts a dd-mm-yyyy dueAt and parses it to ISO", () => {
    const result = createCardSchema.safeParse({
      columnId: uuid,
      title: "X",
      dueAt: "23-07-2026",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueAt).toBe("2026-07-23T00:00:00.000Z");
    }
  });

  it("accepts a dd/mm/yyyy dueAt", () => {
    expect(
      createCardSchema.safeParse({
        columnId: uuid,
        title: "X",
        dueAt: "1/4/2026",
      }).success,
    ).toBe(true);
  });

  it("rejects a calendar-invalid dd-mm-yyyy dueAt (31 February)", () => {
    expect(
      createCardSchema.safeParse({
        columnId: uuid,
        title: "X",
        dueAt: "31-02-2026",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty-string dueAt (clearing is an explicit null, not '')", () => {
    expect(
      createCardSchema.safeParse({
        columnId: uuid,
        title: "X",
        dueAt: "",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty title", () => {
    expect(createCardSchema.safeParse({ columnId: uuid, title: "" }).success).toBe(
      false,
    );
  });
});

describe("updateCardSchema", () => {
  it("accepts a cardId with no other fields (still valid shape-wise)", () => {
    expect(updateCardSchema.safeParse({ cardId: uuid }).success).toBe(true);
  });

  it("accepts a partial update", () => {
    expect(
      updateCardSchema.safeParse({ cardId: uuid, priority: "low" }).success,
    ).toBe(true);
  });

  it("rejects a missing cardId", () => {
    expect(updateCardSchema.safeParse({ title: "X" }).success).toBe(false);
  });
});

describe("deleteCardSchema", () => {
  it("accepts a cardId", () => {
    expect(deleteCardSchema.safeParse({ cardId: uuid }).success).toBe(true);
  });

  it("rejects a non-uuid cardId", () => {
    expect(deleteCardSchema.safeParse({ cardId: "1" }).success).toBe(false);
  });
});

describe("moveCardSchema", () => {
  it("accepts cardId + columnId + a non-negative targetIndex", () => {
    expect(
      moveCardSchema.safeParse({ cardId: uuid, columnId: uuid, targetIndex: 0 })
        .success,
    ).toBe(true);
  });

  it("rejects a negative targetIndex", () => {
    expect(
      moveCardSchema.safeParse({
        cardId: uuid,
        columnId: uuid,
        targetIndex: -1,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-integer targetIndex", () => {
    expect(
      moveCardSchema.safeParse({
        cardId: uuid,
        columnId: uuid,
        targetIndex: 1.5,
      }).success,
    ).toBe(false);
  });
});
