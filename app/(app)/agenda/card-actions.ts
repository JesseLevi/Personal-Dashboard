"use server";

import { requireUserId } from "@/lib/boards/session";
import { getQuickAddBoard } from "@/lib/agenda/queries";
import { createPlannedCardSchema, type AgendaActionResult } from "@/lib/agenda/schemas";
import { createCard } from "../te-doen/actions";

// A new card from quick add (ADR-0041): one step into the first column of the favourite board, planned on a
// day. It is `createCard` with the column found server-side, so access stays with the cards policies
// (ADR-0033, ADR-0035). Errors carry a code only; no board to put it on is `not-found`.
export async function createPlannedCard(input: unknown): Promise<AgendaActionResult<{ id: string }>> {
  const parsed = createPlannedCardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  let board;
  try {
    board = await getQuickAddBoard();
  } catch {
    return { success: false, error: "generic" };
  }
  if (!board) return { success: false, error: "not-found" };

  const result = await createCard({ columnId: board.columnId, title: parsed.data.title, plannedFor: parsed.data.plannedFor });
  if (result.success) return { success: true, data: { id: result.data.id } };
  return { success: false, error: result.error === "column-mismatch" ? "generic" : result.error };
}
