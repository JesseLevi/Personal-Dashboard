import "server-only";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";

// Server error log (ADR-0049): instrumentation.ts hands every request error
// here; one row lands in private.app_errors via public.report_app_error.
// Never stores the query string, body, cookies, headers or user identity.
// Reporting must never fail or slow the request it reports on.

export interface ErrorReport {
  route: string;
  method: string;
  kind: string;
  digest: string | null;
  errorName: string;
  message: string;
}

// Next's control-flow throws (redirect, notFound, dynamic bail-outs) are not errors.
const CONTROL_FLOW_DIGEST = /^(NEXT_|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/;

const MESSAGE_MAX = 300;

export function toErrorReport(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string },
): ErrorReport | null {
  const digest =
    typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;
  if (digest && CONTROL_FLOW_DIGEST.test(digest)) return null;

  const route = (context.routePath || request.path || "?").split("?")[0] || "?";
  const errorName = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : "";
  return {
    route: route.slice(0, 200),
    method: (request.method || "?").toUpperCase().slice(0, 10),
    kind: context.routeType ?? "?",
    digest,
    errorName: errorName.slice(0, 100),
    message: message.slice(0, MESSAGE_MAX),
  };
}

export async function reportRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string },
): Promise<void> {
  const secret = process.env.APP_ERROR_REPORT_SECRET;
  if (!secret || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return;
  try {
    const report = toErrorReport(error, request, context);
    if (!report) return;
    await createSupabaseAnonClient().rpc("report_app_error", {
      p_secret: secret,
      p_route: report.route,
      p_method: report.method,
      p_kind: report.kind,
      p_digest: report.digest ?? "",
      p_error_name: report.errorName,
      p_message: report.message,
    });
  } catch {
    // The log is best effort; the runtime log still has console.error.
  }
}
