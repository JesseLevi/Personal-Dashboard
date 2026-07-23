import { z } from "zod";

// Validates every server-action input in this module (#92), same pattern as
// lib/auth/schemas.ts. Zod is the shape/format gate; ownership (does this
// uuid actually belong to the requesting user, and — for moveCard — does the
// target column belong to the same board as the card) is checked separately
// against the database, never inferred from the shape being valid.

const name = z.string().trim().min(1).max(200);
const description = z.string().trim().max(5000).nullable();
const priority = z.enum(["low", "medium", "urgent"]);
const size = z.enum(["s", "m", "l", "xl"]).nullable();
const dueAt = z.iso.datetime({ offset: true }).nullable();
// board_columns.icon: free-text column, validated against the IconName union
// at render time (components/atoms/Icon.tsx) — the data layer only rejects
// empty input, matching the CLAUDE.md line for this column.
const icon = z.string().trim().min(1).max(100);

export const boardIdSchema = z.object({
  boardId: z.uuid(),
});

export const createBoardSchema = z.object({
  name,
});

export const renameBoardSchema = z.object({
  boardId: z.uuid(),
  name,
});

export const createColumnSchema = z.object({
  boardId: z.uuid(),
  name,
  icon,
});

export const renameColumnSchema = z.object({
  columnId: z.uuid(),
  name,
});

export const createCardSchema = z.object({
  columnId: z.uuid(),
  title: name,
  description: description.optional(),
  priority: priority.optional(),
  size: size.optional(),
  dueAt: dueAt.optional(),
});

export const updateCardSchema = z.object({
  cardId: z.uuid(),
  title: name.optional(),
  description: description.optional(),
  priority: priority.optional(),
  size: size.optional(),
  dueAt: dueAt.optional(),
});

export const deleteCardSchema = z.object({
  cardId: z.uuid(),
});

// The drop target's index within the destination column's card list (after
// the move), as a drag & drop UI naturally reports it — not a raw `position`
// value. The action resolves that index to the actual neighbor rows and
// computes the fractional position server-side (lib/boards/positioning.ts),
// so a client can influence where a card lands but never inject an arbitrary
// position number for it.
export const moveCardSchema = z.object({
  cardId: z.uuid(),
  columnId: z.uuid(),
  targetIndex: z.int().nonnegative(),
});
