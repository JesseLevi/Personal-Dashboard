// #364 part 1: per-row logic of the Supabase -> R2 thumbnail backfill (ADR-0024 §7).
// Kept apart from the CLI so tests can drive it with the storage fake and a
// mocked Supabase surface. No service_role here; the CLI wires the real client.
import { isLegacyThumbnailStem, thumbnailVariantPath, type ThumbnailVariant } from "@/lib/recipes/thumbnail-processing";
import { STORED_OBJECT_CACHE_CONTROL, objectKey, type ObjectStore } from "@/lib/storage";

const VARIANTS: ThumbnailVariant[] = ["card", "full"];

export interface LegacyRow {
  id: string;
  user_id: string;
  thumbnail_path: string;
}

/** The slice of Supabase the migration needs. */
export interface LegacySource {
  /** Bytes of one object in the old bucket, or null when missing. */
  download(key: string): Promise<Uint8Array | null>;
  remove(keys: string[]): Promise<void>;
  /** Guarded update (matches the old path); resolves false when no row changed. */
  updateThumbnailPath(row: LegacyRow, newStem: string): Promise<boolean>;
}

export type RowResult =
  | { status: "migrated" | "would-migrate"; bytes: number }
  | { status: "failed"; error: string };

export function isMigratable(row: { thumbnail_path: string | null }): row is LegacyRow {
  return !!row.thumbnail_path && isLegacyThumbnailStem(row.thumbnail_path);
}

/**
 * New stem reuses the legacy uuid, so a half-done earlier run just overwrites
 * the same R2 keys (idempotent) instead of leaving random orphans.
 */
export function newStemFor(row: LegacyRow): string {
  const uuid = row.thumbnail_path.split("/")[1];
  return objectKey(row.user_id, "recipes", uuid);
}

/**
 * Order: put both variants to R2 -> verify by reading back -> update the row
 * -> delete the old objects. A failure before the update leaves the row on the
 * old, still-intact path; after it the row already resolves from R2.
 */
export async function migrateRow(
  row: LegacyRow,
  deps: { source: LegacySource; store: ObjectStore; apply: boolean },
): Promise<RowResult> {
  const { source, store, apply } = deps;
  const oldStem = row.thumbnail_path;
  const newStem = newStemFor(row);
  const oldKeys = VARIANTS.map((v) => thumbnailVariantPath(oldStem, v));

  const payloads: { variant: ThumbnailVariant; bytes: Uint8Array }[] = [];
  for (const variant of VARIANTS) {
    let bytes: Uint8Array | null;
    try {
      bytes = await source.download(thumbnailVariantPath(oldStem, variant));
    } catch (error) {
      return { status: "failed", error: `download ${variant}: ${errorMessage(error)}` };
    }
    if (!bytes) {
      // Half-done earlier run: the variant may already be in R2.
      const existing = await store.get(thumbnailVariantPath(newStem, variant)).catch(() => null);
      if (!existing) return { status: "failed", error: `${variant} missing in Supabase and R2` };
      bytes = existing.bytes;
    }
    payloads.push({ variant, bytes });
  }
  const bytes = payloads.reduce((n, p) => n + p.bytes.length, 0);
  if (!apply) return { status: "would-migrate", bytes };

  try {
    for (const { variant, bytes: data } of payloads) {
      const key = thumbnailVariantPath(newStem, variant);
      await store.put(key, data, { contentType: "image/webp", cacheControl: STORED_OBJECT_CACHE_CONTROL });
      const back = await store.get(key);
      if (!back || back.bytes.length !== data.length || !back.bytes.every((b, i) => b === data[i])) {
        return { status: "failed", error: `verify ${variant}: R2 copy differs from source` };
      }
    }
  } catch (error) {
    return { status: "failed", error: `R2 put: ${errorMessage(error)}` };
  }

  try {
    if (!(await source.updateThumbnailPath(row, newStem))) {
      return { status: "failed", error: "row not updated (changed concurrently?)" };
    }
  } catch (error) {
    return { status: "failed", error: `row update: ${errorMessage(error)}` };
  }

  // Row already resolves from R2; a failed delete only leaves dead storage.
  try {
    await source.remove(oldKeys);
  } catch (error) {
    console.error(`  WARN old objects not deleted: ${errorMessage(error)}`);
  }
  return { status: "migrated", bytes };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
