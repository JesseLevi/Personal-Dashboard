// lib/storage seam (ADR-0024). The only module that touches R2.
import "server-only";
import { readR2Config } from "./env";
import { createR2Store } from "./r2";
import type { ObjectStore } from "./types";

export { objectKey, keyBelongsTo, modulePrefix } from "./keys";
export { redirectToStoredObject, STORED_OBJECT_CACHE_CONTROL } from "./deliver";
export type { RedirectToStoredObjectOptions } from "./deliver";
export type { ObjectStore, PutOptions, StoredObject } from "./types";

let store: ObjectStore | null = null;

/** Lazy: env is read on first use, so importing never throws. */
export function getObjectStore(): ObjectStore {
  store ??= createR2Store(readR2Config());
  return store;
}

/** R2 origin for `preconnect`, or null when storage is not configured. */
export function objectStoreOrigin(): string | null {
  try {
    return `https://${readR2Config().accountId}.r2.cloudflarestorage.com`;
  } catch {
    return null;
  }
}

/** Test-only: inject a fake (createFakeObjectStore); null resets. */
export function setObjectStoreForTesting(next: ObjectStore | null): void {
  store = next;
}
