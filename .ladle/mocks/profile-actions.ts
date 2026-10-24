import type { ActionResult } from "../../lib/profile/types";

// Ladle stand-in for lib/profile/actions.ts ("use server", needs a Next request
// context); wired in .ladle/vite.config.mjs. Same signatures, no side effects.
const ok = async (): Promise<ActionResult> => ({ success: true, data: undefined });

export const updateLocale = ok;
export const updateName = ok;
export const uploadAvatar = ok;
export const removeAvatar = ok;
export const setAiEnabled = ok;
