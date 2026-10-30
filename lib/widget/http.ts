// Pure HTTP helpers of the widget endpoint (ADR-0047 §2).

// atlas_wgt_ + 32 random bytes as base64url (43 characters).
const BEARER = /^Bearer (atlas_wgt_[A-Za-z0-9_-]{43})$/;

/** The token of a strict `Authorization: Bearer atlas_wgt_…` header, or null. */
export function parseBearerToken(header: string | null): string | null {
  return header === null ? null : (BEARER.exec(header)?.[1] ?? null);
}

export type WidgetOutcome = "ok" | "unauthorized" | "rate_limited" | "unavailable" | "error";

export function outcomeToHttp(outcome: WidgetOutcome): number {
  switch (outcome) {
    case "ok":
      return 200;
    case "unauthorized":
      return 401;
    case "rate_limited":
      return 429;
    case "unavailable":
      return 503;
    case "error":
      return 500;
  }
}
