import type { Instrumentation } from "next";

// ADR-0049: server errors go to private.app_errors. Node runtime only; the
// edge middleware has no Supabase client.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportRequestError } = await import("./lib/monitoring/report-error");
  await reportRequestError(error, request, context);
};
