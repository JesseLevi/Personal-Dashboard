#!/usr/bin/env -S npx tsx --conditions react-server
// #364 part 1: copies legacy recipe thumbnails (`<user_id>/<uuid>_{card,full}.webp`
// in the Supabase bucket `recipe-thumbnails`) to R2 under `<user_id>/recipes/<uuid>`
// (ADR-0024 §7). service_role is allowed here: this is a script, not app code.
//
// Usage (env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ACCOUNT_ID,
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME):
//   pnpm backfill:thumbnails-r2            dry run: lists rows + sizes, writes nothing
//   pnpm backfill:thumbnails-r2 --apply    performs the migration
// `--conditions react-server` lets lib/storage's `server-only` import load outside Next.
// Strictly one row at a time (docs/incidents.md, #161). Re-running skips rows
// already migrated. Per-row order and crash-safety: see the core file.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getObjectStore, type ObjectStore } from "@/lib/storage";
import { isMigratable, migrateRow, type LegacyRow, type LegacySource } from "./backfill-recipe-thumbnails-to-r2-core";

const BUCKET = "recipe-thumbnails";
const PAGE = 500;
const apply = process.argv.includes("--apply");

const supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const source: LegacySource = {
  async download(key) {
    const { data, error } = await supabase.storage.from(BUCKET).download(key);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  },
  async remove(keys) {
    const { error } = await supabase.storage.from(BUCKET).remove(keys);
    if (error) throw new Error(error.message);
  },
  async updateThumbnailPath(row, newStem) {
    const { data, error } = await supabase
      .from("recipes")
      .update({ thumbnail_path: newStem })
      .eq("id", row.id)
      .eq("thumbnail_path", row.thumbnail_path)
      .select("id");
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) === 1;
  },
};

async function listLegacyRows(): Promise<LegacyRow[]> {
  const rows: LegacyRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("recipes")
      .select("id, user_id, thumbnail_path")
      .not("thumbnail_path", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`listing recipes failed: ${error.message}`);
    rows.push(...(data ?? []).filter(isMigratable));
    if ((data?.length ?? 0) < PAGE) return rows;
  }
}

/** Dry run works without R2 credentials: falls back to a store that finds nothing. */
function pickStore(): ObjectStore {
  try {
    return getObjectStore();
  } catch (error) {
    if (apply) throw error;
    return {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      deletePrefix: async () => 0,
      presignGet: async () => "",
    };
  }
}

async function main() {
  const rows = await listLegacyRows();
  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${rows.length} legacy row(s)`);
  const store = pickStore();
  let bytes = 0;
  let done = 0;
  let failures = 0;
  for (const row of rows) {
    const result = await migrateRow(row, { source, store, apply });
    if (result.status === "failed") {
      failures += 1;
      console.error(`[recipe ${row.id}] FAILED: ${result.error}`);
    } else {
      done += 1;
      bytes += result.bytes;
      console.log(`[recipe ${row.id}] ${result.status} ${row.thumbnail_path} (${(result.bytes / 1024).toFixed(1)} kB)`);
    }
  }
  console.log(`\n--- ${apply ? "Applied" : "Dry-run"}: ${done}/${rows.length} rows, ${(bytes / 1024).toFixed(1)} kB, ${failures} failure(s) ---`);
  if (!apply) console.log("Dry run only. Rerun with --apply to migrate.");
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("backfill-recipe-thumbnails-to-r2: fatal", err);
  process.exit(1);
});
