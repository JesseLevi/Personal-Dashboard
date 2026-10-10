// Object-store contract for lib/storage. Rationale: ADR-0024.
import "server-only";

export type PutOptions = { contentType: string; cacheControl?: string };
export type StoredObject = { bytes: Uint8Array; contentType: string };

export interface ObjectStore {
  put(key: string, bytes: Uint8Array, options: PutOptions): Promise<void>;
  /** Null when the key does not exist. */
  get(key: string): Promise<StoredObject | null>;
  delete(keys: string[]): Promise<void>;
  /** Deletes every key starting with `prefix`; returns how many. */
  deletePrefix(prefix: string): Promise<number>;
  /** Hour-stable GET URL: same key and hour give the same URL (ADR-0024 §5). */
  presignGet(key: string, now?: Date): Promise<string>;
}

/** Signing time rounded down to the hour; URLs live 2 hours. */
export const PRESIGN_EXPIRES_SECONDS = 7200;

export function floorToHour(now: Date): Date {
  return new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
}
