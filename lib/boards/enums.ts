// Shared client-safe enum lists for cards.priority/cards.size. The DB CHECK
// constraint isn't reflected in codegen'd types (lib/database.types.ts types
// both columns as plain `string`), so every UI surface that renders or edits
// them needs the same runtime guard against the same closed list — this used
// to be a local copy inside TeDoenBoard.tsx alone; #94 added a second
// consumer (CardDetailPanel.tsx), so it moved here rather than drifting into
// two independently-maintained copies. Framework-free, safe to import from
// client components (no Supabase, no "server-only").

export const PRIORITIES = ["low", "medium", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

export const SIZES = ["s", "m", "l", "xl"] as const;
export type Size = (typeof SIZES)[number];
export function isSize(value: string): value is Size {
  return (SIZES as readonly string[]).includes(value);
}
