import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/anon", () => ({ createSupabaseAnonClient: () => ({ rpc }) }));

import { reportRequestError, toErrorReport } from "@/lib/monitoring/report-error";

const request = { path: "/notities/abc?q=secret", method: "post" };

afterEach(() => {
  vi.unstubAllEnvs();
  rpc.mockReset();
});

describe("toErrorReport", () => {
  it("keeps the route pattern, never the query string", () => {
    const report = toErrorReport(new TypeError("boom"), request, { routePath: "/notities/[noteId]", routeType: "render" });
    expect(report).toEqual({
      route: "/notities/[noteId]",
      method: "POST",
      kind: "render",
      digest: null,
      errorName: "TypeError",
      message: "boom",
    });
  });

  it("drops the query string when there is no route pattern", () => {
    expect(toErrorReport(new Error("x"), request, {})?.route).toBe("/notities/abc");
  });

  it("truncates the message", () => {
    expect(toErrorReport(new Error("m".repeat(1000)), request, {})?.message).toHaveLength(300);
  });

  it("ignores Next's control-flow throws", () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    const notFound = Object.assign(new Error("x"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect(toErrorReport(redirect, request, {})).toBeNull();
    expect(toErrorReport(notFound, request, {})).toBeNull();
  });

  it("keeps a real digest", () => {
    const err = Object.assign(new Error("x"), { digest: "123456" });
    expect(toErrorReport(err, request, {})?.digest).toBe("123456");
  });
});

describe("reportRequestError", () => {
  it("does nothing without the secret", async () => {
    vi.stubEnv("APP_ERROR_REPORT_SECRET", "");
    await reportRequestError(new Error("x"), request, {});
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends only the thin report", async () => {
    vi.stubEnv("APP_ERROR_REPORT_SECRET", "s".repeat(32));
    vi.stubEnv("SUPABASE_URL", "http://localhost");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon");
    rpc.mockResolvedValue({ data: null, error: null });
    await reportRequestError(new Error("x"), request, { routePath: "/notities/[noteId]", routeType: "action" });
    expect(rpc).toHaveBeenCalledWith("report_app_error", {
      p_secret: "s".repeat(32),
      p_route: "/notities/[noteId]",
      p_method: "POST",
      p_kind: "action",
      p_digest: "",
      p_error_name: "Error",
      p_message: "x",
    });
  });

  it("never throws when the log itself fails", async () => {
    vi.stubEnv("APP_ERROR_REPORT_SECRET", "s".repeat(32));
    vi.stubEnv("SUPABASE_URL", "http://localhost");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon");
    rpc.mockRejectedValue(new Error("db down"));
    await expect(reportRequestError(new Error("x"), request, {})).resolves.toBeUndefined();
  });
});
