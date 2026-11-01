"use server";

import { requireUserId } from "@/lib/boards/session";
import { getCommandBoards } from "@/lib/command/boards";
import { getCommandProjects } from "@/lib/command/projects";
import type { CommandBoard, CommandProject } from "@/lib/command/types";
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

type CommandProjectsResult = { success: true; data: CommandProject[] } | { success: false; error: RecipesErrorCode };

/** ADR-0053 §6: the palette's Projecten group, for the signed-in member only. */
export async function getCommandProjectsAction(): Promise<CommandProjectsResult> {
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  try {
    return { success: true, data: await getCommandProjects() };
  } catch {
    console.error("[command] getCommandProjectsAction failed");
    return { success: false, error: "generic" };
  }
}
