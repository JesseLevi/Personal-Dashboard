// The four default columns every board opens with (#95 "Create new board and
// open that board in empty state" — annotation 3878:9059 — "same as the
// schema default board"). Mirrors `seed_default_board()`'s own column insert
// in supabase/migrations/20260723000001_kanban_schema.sql exactly (name,
// icon, position spacing) — that trigger only fires on `auth.users` insert
// (a brand-new account's first board), so `createBoard` needs its own copy
// of the same four rows for every board created afterwards. Kept in one
// place rather than two independently-maintained literals.

export const DEFAULT_BOARD_COLUMNS = [
  { name: "Ideeën", icon: "Lightbulb" },
  { name: "Klaar", icon: "AlarmClockCheck" },
  { name: "Bezig", icon: "Loader" },
  { name: "Afgerond", icon: "CircleCheck" },
] as const;
