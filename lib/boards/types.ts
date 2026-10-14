import type { Database } from "@/lib/database.types";

// Read-side shapes returned by lib/boards/queries.ts.
export type BoardRow = Database["public"]["Tables"]["boards"]["Row"];
export type BoardColumnRow = Database["public"]["Tables"]["board_columns"]["Row"];
export type CardRow = Database["public"]["Tables"]["cards"]["Row"];
export type LabelRow = Database["public"]["Tables"]["labels"]["Row"];

export type CardWithLabels = CardRow & { labels: LabelRow[] };
export type BoardColumnWithCards = BoardColumnRow & { cards: CardWithLabels[] };
export type BoardWithColumns = BoardRow & { columns: BoardColumnWithCards[] };

// Every write action (app/(app)/te-doen/actions.ts) returns one of these
// instead of throwing or returning a bare string, so the UI can look up a
// translated message via `t(\`boards.errors.${error}\`)` — same shape as
// app/login/actions.ts's `auth.errors.*` redirect codes, just returned
// instead of round-tripped through a redirect query param. `error` is a
// closed set of codes, never a message string: messages can carry
// user/database content, codes can't (see the i18n note in each action).
export type BoardsErrorCode =
  | "invalid-input"
  | "unauthenticated"
  | "not-found"
  | "column-mismatch"
  | "read-only"
  | "generic";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: BoardsErrorCode };
