import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateWidgetToken, hashWidgetToken } from "@/lib/widget/token";
import type { WidgetErrorCode, WidgetTokenItem } from "@/lib/widget/types";

// Postgres undefined_table; PostgREST relation missing from the schema cache.
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

function mapError(code: string | undefined): WidgetErrorCode {
  if (code === "P0001") return "limit";
  if (code && MISSING_TABLE_CODES.has(code)) return "unavailable";
  return "generic";
}

/** The signed-in member's tokens, newest first; [] when the table is not there yet (before the hosted migration). */
export async function listWidgetTokens(): Promise<WidgetTokenItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("widget_tokens")
    .select("id, label, created_at, last_used_at")
    .order("created_at", { ascending: false });
  if (error) {
    if (!MISSING_TABLE_CODES.has(error.code)) {
      console.error("[widget] listWidgetTokens failed:", error.code, error.message);
    }
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

/** Inserts a token and returns its plaintext once; only the hash is stored. */
export async function createWidgetToken(
  label: string,
): Promise<{ token: string } | { error: WidgetErrorCode }> {
  const token = generateWidgetToken();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("widget_tokens")
    .insert({ label, token_hash: hashWidgetToken(token) });
  if (error) {
    const code = mapError(error.code);
    if (code === "generic") console.error("[widget] createWidgetToken failed:", error.code, error.message);
    return { error: code };
  }
  return { token };
}

export async function deleteWidgetToken(id: string): Promise<{ error: WidgetErrorCode } | null> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("widget_tokens").delete().eq("id", id);
  if (error) {
    console.error("[widget] deleteWidgetToken failed:", error.code, error.message);
    return { error: mapError(error.code) };
  }
  return null;
}
