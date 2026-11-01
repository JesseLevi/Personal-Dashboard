"use server";

import { requireUserId } from "@/lib/boards/session";
import { getCommandBoards } from "@/lib/command/boards";
import type { CommandBoard } from "@/lib/command/types";
import type { RecipesErrorCode } from "@/lib/recipes/types";

type CommandBoardsResult = { success: true; data: CommandBoard[] } | { success: false; error: RecipesErrorCode };

/** ADR-0048: the palette's Borden group, for the signed-in member only. */
export async function getCommandBoardsAction(): Promise<CommandBoardsResult> {
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  try {
    return { success: true, data: await getCommandBoards() };
  } catch {
    console.error("[command] getCommandBoardsAction failed");
    return { success: false, error: "generic" };
  }
}
