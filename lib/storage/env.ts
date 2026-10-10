// The only place R2_* env vars are read (check:server-only enforces it).
import "server-only";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

const VARS = {
  accountId: "R2_ACCOUNT_ID",
  accessKeyId: "R2_ACCESS_KEY_ID",
  secretAccessKey: "R2_SECRET_ACCESS_KEY",
  bucket: "R2_BUCKET_NAME",
} as const;

export function readR2Config(env: Record<string, string | undefined> = process.env): R2Config {
  const out = {} as R2Config;
  for (const [field, name] of Object.entries(VARS)) {
    const value = env[name];
    if (!value) throw new Error(`Object storage is not configured: ${name} is not set`);
    out[field as keyof R2Config] = value;
  }
  return out;
}
