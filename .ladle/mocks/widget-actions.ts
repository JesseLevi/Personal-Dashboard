import type { WidgetActionResult } from "../../lib/widget/types";

// Ladle stand-in for lib/widget/actions.ts ("use server"); wired in .ladle/vite.config.mjs.
export const createWidgetTokenAction = async (): Promise<WidgetActionResult<{ token: string }>> => ({
  success: true,
  data: { token: "atlas_wgt_Zm9yLWxhZGxlLXN0b3JpZXMtb25seS1ub3QtYS1yZWFsLXRva2Vu" },
});

export const deleteWidgetTokenAction = async (): Promise<WidgetActionResult> => ({
  success: true,
  data: undefined,
});
