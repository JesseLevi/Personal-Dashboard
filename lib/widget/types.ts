export type WidgetTokenItem = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type WidgetErrorCode = "invalid-input" | "unauthenticated" | "limit" | "unavailable" | "generic";

export type WidgetActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: WidgetErrorCode };
