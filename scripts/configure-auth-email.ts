#!/usr/bin/env -S npx tsx
// #493 (ADR-0038): sets Resend SMTP and the login-code mail template on hosted Supabase.
//
// Usage: pnpm auth:email [--apply] [--templates-only]
//   Env: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, RESEND_API_KEY, AUTH_EMAIL_FROM,
//        AUTH_EMAIL_SENDER_NAME (the last three are skipped with --templates-only).
//   (default)         dry run: GETs the current auth config and prints a masked diff.
//   --apply           PATCHes it. A hosted write: needs the user's explicit go (ADR-0032).
//   --templates-only  leaves SMTP alone (Resend linked via its Supabase integration).
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  buildDiff,
  buildPayload,
  envSchema,
  formatDiff,
  templatesOnlyEnvSchema,
} from "./auth-email-lib";

const { values } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
    "templates-only": { type: "boolean", default: false },
  },
});
const templatesOnly = values["templates-only"] === true;

const parsed = (templatesOnly ? templatesOnlyEnvSchema : envSchema).safeParse(process.env);
if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  console.error(`Missing or invalid env: ${missing}. See .env.example (Auth e-mail).`);
  process.exit(1);
}
const env = parsed.data as Record<string, string>;

const template = readFileSync("supabase/templates/magic_link.html", "utf8");
const payload = buildPayload({
  template,
  templatesOnly,
  env: templatesOnly
    ? undefined
    : {
        RESEND_API_KEY: env.RESEND_API_KEY,
        AUTH_EMAIL_FROM: env.AUTH_EMAIL_FROM,
        AUTH_EMAIL_SENDER_NAME: env.AUTH_EMAIL_SENDER_NAME,
      },
});

const url = `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/config/auth`;
const headers = {
  Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
  "Content-Type": "application/json",
};

async function main() {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`GET auth config failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const current = (await res.json()) as Record<string, unknown>;
  console.log(formatDiff(buildDiff(current, payload)));

  if (!values.apply) {
    console.log("\nDry run: nothing written. Re-run with --apply after the user's go.");
    process.exit(0);
  }

  const patch = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(payload) });
  if (!patch.ok) {
    console.error(`PATCH auth config failed: HTTP ${patch.status}`);
    process.exit(1);
  }
  console.log("\nApplied.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
