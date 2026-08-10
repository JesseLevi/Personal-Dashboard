#!/usr/bin/env -S npx tsx
// #174/#171: one-off backfill for `recipes.thumbnail_path` rows still on the
// legacy `<user_id>/<uuid>.<ext>` object-path convention. Chunks 1-2
// (commits d07cc34/de30b3d) changed the column's meaning to a *stem*
// (`<user_id>/<uuid>`, no extension) backed by two real objects --
// `<stem>_card.webp` / `<stem>_full.webp`, named by
// lib/recipes/thumbnail-processing.ts's `thumbnailVariantPath` -- so any row
// still holding the old shape now points at an object
// app/api/recipe-thumbnail/[recipeId]/route.ts can't resolve, and the
// recipe renders as a missing photo until this runs. See
// supabase/migrations/20260801000001_recipe_thumbnails_storage.sql for the
// bucket/RLS this walks under; the service_role client below is a
// worker/script module, not app code, so it's exempt from
// ADR-0002/0003's "browser never talks to Supabase directly" boundary the
// same way worker/index.ts is.
//
// Usage: pnpm exec tsx scripts/backfill-recipe-thumbnails.ts [--apply]
//   (default, no flag) dry run -- downloads + re-encodes every candidate
//   row for real before/after size numbers, but performs NO writes.
//   --apply    performs the writes for real: upload both new variants,
//              update the row, delete the old object. Strictly one row at a
//              time, never `Promise.all` over writers -- parallel writers
//              against this project's Supabase have previously produced
//              hundreds of duplicate rows (docs/incidents.md's #161 entry).
//
// Crash-safety order per row: upload the new variants FIRST, then update
// `recipes.thumbnail_path`, then delete the old object. A crash between any
// two steps must never leave a row pointing at nothing:
//   - crash after upload, before DB update: row still points at the old
//     (still-present) object -- unresolved variant objects are orphaned but
//     harmless, and the next run reprocesses the row from scratch.
//   - crash after DB update, before delete: row already resolves correctly
//     via the new stem; the old object is now unreferenced dead storage,
//     cleaned up (or left, harmlessly) on a later run -- but the script no
//     longer selects this row (thumbnail_path lost its extension), so
//     nothing deletes it retroactively; that's an acceptable, documented
//     leftover, not silent breakage.

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  renderThumbnailVariants,
  thumbnailVariantPath,
  type ThumbnailVariant,
} from "@/lib/recipes/thumbnail-processing";

const RECIPE_THUMBNAILS_BUCKET = "recipe-thumbnails";

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

interface LegacyRow {
  id: string;
  user_id: string;
  thumbnail_path: string;
}

interface MigrationOutcome {
  oldBytes: number;
  cardBytes: number;
  fullBytes: number;
}

/**
 * True when `path` still carries a file extension on its last path segment
 * -- the legacy `<user_id>/<uuid>.<ext>` convention chunks 1-2 (#174/#171)
 * replaced with an extension-less stem. A migrated row's `thumbnail_path`
 * never has one, so this single check both selects legacy rows and makes
 * re-running this script a no-op on rows it already fixed (idempotent).
 */
export function isLegacyThumbnailPath(path: string): boolean {
  const lastSegment = path.split("/").pop() ?? "";
  return /\.[A-Za-z0-9]+$/.test(lastSegment);
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

function formatSavedPct(oldBytes: number, newBytes: number): string {
  if (oldBytes === 0) return "n/a";
  return `${(((oldBytes - newBytes) / oldBytes) * 100).toFixed(1)}%`;
}

/**
 * Migrates one legacy row: download the old object, re-encode both
 * variants with the exact same pipeline `uploadRecipeThumbnail` uses
 * (lib/recipes/thumbnail-processing.ts -- no duplicated encode settings),
 * and, only when `apply` is true, write the new objects/row/cleanup in the
 * crash-safe order documented at the top of this file. Returns the
 * measured byte counts (real even in dry-run, since the whole point of the
 * dry run is real numbers) or `null` if the row couldn't be processed.
 */
async function migrateRow(row: LegacyRow, apply: boolean): Promise<MigrationOutcome | null> {
  const oldPath = row.thumbnail_path;
  console.log(`\n[recipe ${row.id}] ${oldPath}`);

  const { data: downloaded, error: downloadError } = await supabase.storage
    .from(RECIPE_THUMBNAILS_BUCKET)
    .download(oldPath);
  if (downloadError || !downloaded) {
    console.error(`  SKIP -- download failed: ${downloadError?.message ?? "no data"}`);
    return null;
  }
  const oldBytes = new Uint8Array(await downloaded.arrayBuffer());

  let variants: Record<ThumbnailVariant, Uint8Array>;
  try {
    variants = await renderThumbnailVariants(oldBytes);
  } catch (error) {
    console.error(`  SKIP -- renderThumbnailVariants failed: ${error}`);
    return null;
  }

  const outcome: MigrationOutcome = {
    oldBytes: oldBytes.length,
    cardBytes: variants.card.length,
    fullBytes: variants.full.length,
  };
  console.log(
    `  ${formatBytes(outcome.oldBytes)} -> card ${formatBytes(outcome.cardBytes)} + full ${formatBytes(outcome.fullBytes)}` +
      ` (${formatSavedPct(outcome.oldBytes, outcome.cardBytes + outcome.fullBytes)} saved)`,
  );

  if (!apply) {
    console.log("  DRY RUN -- no writes performed");
    return outcome;
  }

  const stem = `${row.user_id}/${randomUUID()}`;
  const cardPath = thumbnailVariantPath(stem, "card");
  const fullPath = thumbnailVariantPath(stem, "full");

  // 1. Upload both new variants first.
  const { error: cardError } = await supabase.storage
    .from(RECIPE_THUMBNAILS_BUCKET)
    .upload(cardPath, variants.card, { contentType: "image/webp", upsert: false });
  if (cardError) {
    console.error(`  ABORT -- card upload failed: ${cardError.message}`);
    return null;
  }
  const { error: fullError } = await supabase.storage
    .from(RECIPE_THUMBNAILS_BUCKET)
    .upload(fullPath, variants.full, { contentType: "image/webp", upsert: false });
  if (fullError) {
    console.error(`  ABORT -- full upload failed: ${fullError.message}`);
    await supabase.storage.from(RECIPE_THUMBNAILS_BUCKET).remove([cardPath]);
    return null;
  }

  // 2. Update the row to point at the new stem.
  const { error: updateError } = await supabase
    .from("recipes")
    .update({ thumbnail_path: stem })
    .eq("id", row.id);
  if (updateError) {
    console.error(
      `  ABORT -- recipes row update failed: ${updateError.message} ` +
        `(new objects already at ${stem} are now orphaned -- the old row is` +
        ` untouched and still resolves, safe to rerun)`,
    );
    return null;
  }

  // 3. Only now delete the old object -- the row already resolves via the
  // new stem regardless of whether this cleanup succeeds.
  const { error: removeError } = await supabase.storage
    .from(RECIPE_THUMBNAILS_BUCKET)
    .remove([oldPath]);
  if (removeError) {
    console.error(
      `  WARN -- old object cleanup failed (row already migrated safely): ${removeError.message}`,
    );
  }

  console.log(`  MIGRATED -- ${oldPath} -> ${stem}`);
  return outcome;
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`backfill-recipe-thumbnails: mode=${apply ? "APPLY (writes enabled)" : "DRY RUN (no writes)"}`);

  const { data: rows, error } = await supabase
    .from("recipes")
    .select("id, user_id, thumbnail_path")
    .not("thumbnail_path", "is", null);
  if (error) {
    console.error("Failed to query recipes:", error.message);
    process.exit(1);
  }

  const legacyRows: LegacyRow[] = (rows ?? []).filter(
    (row): row is LegacyRow => row.thumbnail_path !== null && isLegacyThumbnailPath(row.thumbnail_path),
  ) as LegacyRow[];

  console.log(
    `Found ${rows?.length ?? 0} recipe(s) with a thumbnail_path, ${legacyRows.length} on the legacy convention.`,
  );
  if (legacyRows.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  // Strictly sequential -- never Promise.all over writers (see header
  // comment / docs/incidents.md's #161 duplicate-row lesson).
  let totalOld = 0;
  let totalCard = 0;
  let totalFull = 0;
  let processed = 0;
  for (const row of legacyRows) {
    const outcome = await migrateRow(row, apply);
    if (outcome) {
      totalOld += outcome.oldBytes;
      totalCard += outcome.cardBytes;
      totalFull += outcome.fullBytes;
      processed += 1;
    }
  }

  console.log(`\n--- ${apply ? "Applied" : "Dry-run"} totals (${processed}/${legacyRows.length} rows) ---`);
  console.log(`old:  ${formatBytes(totalOld)}`);
  console.log(`new:  ${formatBytes(totalCard)} card + ${formatBytes(totalFull)} full = ${formatBytes(totalCard + totalFull)}`);
  console.log(`saved: ${formatSavedPct(totalOld, totalCard + totalFull)}`);
  if (!apply) {
    console.log("\nThis was a dry run -- rerun with --apply to perform the writes.");
  }
}

main().catch((err) => {
  console.error("backfill-recipe-thumbnails: fatal", err);
  process.exit(1);
});
