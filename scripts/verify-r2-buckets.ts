#!/usr/bin/env -S npx tsx
// #360: verifies the R2 bucket setup of ADR-0024 §6. Never runs automatically.
//
// Usage: pnpm exec tsx --env-file=.env scripts/verify-r2-buckets.ts \
//          --bucket <bucket the token is scoped to> --other <the other bucket> [--apply]
//   Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (token for --bucket).
//   (default) dry run: prints the checks it would make, performs no requests.
//   --apply   performs them: (a) anonymous GET on each bucket fails, (b) PUT to
//             --other is refused (403), (c) PUT+DELETE of a probe key in
//             --bucket succeeds. The probe key is deleted again.
// Self-contained minimal SigV4 (node:crypto) so it needs no dependency.
import { createHash, createHmac, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    bucket: { type: "string" },
    other: { type: "string" },
    apply: { type: "boolean", default: false },
  },
});

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};
const { bucket, other, apply } = values;
if (!bucket || !other) throw new Error("Pass --bucket <name> and --other <name>");

const account = env("R2_ACCOUNT_ID");
const accessKey = env("R2_ACCESS_KEY_ID");
const secretKey = env("R2_SECRET_ACCESS_KEY");
const host = `${account}.r2.cloudflarestorage.com`;
const probeKey = `verify-r2-buckets/${randomUUID()}.txt`;
const body = "r2 verify probe";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (key: string | Buffer, s: string) => createHmac("sha256", key).update(s).digest();

async function signed(method: "PUT" | "DELETE", bkt: string): Promise<number> {
  const payload = method === "PUT" ? body : "";
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const path = `/${bkt}/${probeKey}`;
  const payloadHash = sha256(payload);
  const headers = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonical = [method, path, "", headers, signedHeaders, payloadHash].join("\n");
  const scope = `${day}/auto/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
  const res = await fetch(`https://${host}${path}`, {
    method,
    body: method === "PUT" ? payload : undefined,
    headers: {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });
  return res.status;
}

async function anonymousGet(bkt: string): Promise<number> {
  return (await fetch(`https://${host}/${bkt}/${probeKey}`)).status;
}

type Check = { name: string; run: () => Promise<boolean> };
const checks: Check[] = [
  ...[bucket, other].map((b) => ({
    name: `anonymous GET https://${host}/${b}/<probe> is non-2xx`,
    run: async () => {
      const s = await anonymousGet(b);
      console.log(`    status ${s}`);
      return s < 200 || s >= 300;
    },
  })),
  {
    name: `PUT probe to OTHER bucket "${other}" is refused (403)`,
    run: async () => {
      const s = await signed("PUT", other);
      console.log(`    status ${s}`);
      if (s >= 200 && s < 300) await signed("DELETE", other); // token is NOT scoped: clean up
      return s === 403;
    },
  },
  {
    name: `PUT then DELETE probe in OWN bucket "${bucket}" succeeds`,
    run: async () => {
      const put = await signed("PUT", bucket);
      const del = put >= 200 && put < 300 ? await signed("DELETE", bucket) : 0;
      console.log(`    PUT ${put}, DELETE ${del}`);
      return put >= 200 && put < 300 && del >= 200 && del < 300;
    },
  },
];

async function main() {
  console.log(apply ? "APPLY: performing requests" : "DRY RUN (add --apply to perform):");
  let failed = 0;
  for (const c of checks) {
    console.log(`- ${c.name}`);
    if (!apply) continue;
    const ok = await c.run();
    console.log(`    ${ok ? "PASS" : "FAIL"}`);
    if (!ok) failed++;
  }
  if (apply) process.exitCode = failed ? 1 : 0;
}

void main();
