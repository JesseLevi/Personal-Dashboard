import type { AssistantLogResult } from "../../lib/assistant/log-types";

// Ladle stand-in for lib/assistant/log-actions.ts ("use server"); wired in .ladle/vite.config.mjs.
// Stories seed the panel through `initialLog`, so this only runs for an unseeded panel.
export const loadAssistantLog = async (): Promise<AssistantLogResult> => ({
  success: true,
  data: { runs: [], traces: [] },
});
