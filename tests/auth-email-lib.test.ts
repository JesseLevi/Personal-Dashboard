import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDiff, buildPayload, envSchema, formatDiff } from "../scripts/auth-email-lib";

const template = readFileSync("supabase/templates/magic_link.html", "utf8");
const env = {
  RESEND_API_KEY: "re_secret_123",
  AUTH_EMAIL_FROM: "login@example.com",
  AUTH_EMAIL_SENDER_NAME: "Atlas",
};

describe("buildPayload", () => {
  it("sets SMTP, OTP and template fields", () => {
    const p = buildPayload({ template, env });
    expect(p).toMatchObject({
      smtp_host: "smtp.resend.com",
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: "re_secret_123",
      smtp_admin_email: "login@example.com",
      smtp_sender_name: "Atlas",
      mailer_otp_exp: 600,
      mailer_otp_length: 6,
    });
  });

  it("skips SMTP fields with templatesOnly", () => {
    const p = buildPayload({ template, templatesOnly: true });
    expect(Object.keys(p).some((k) => k.startsWith("smtp_"))).toBe(false);
    expect(p).not.toHaveProperty("rate_limit_email_sent");
    expect(p.mailer_otp_exp).toBe(600);
  });

  it("template carries the code and the fallback link", () => {
    const p = buildPayload({ template, templatesOnly: true });
    const html = String(p.mailer_templates_magic_link_content);
    expect(html).toContain("{{ .Token }}");
    expect(html).toContain("{{ .TokenHash }}");
    expect(html).toContain("/auth/confirm?token_hash=");
  });
});

describe("masking", () => {
  it("never prints the SMTP password or the template body", () => {
    const p = buildPayload({ template, env });
    const out = formatDiff(buildDiff({ smtp_pass: "old_secret" }, p));
    expect(out).not.toContain("re_secret_123");
    expect(out).not.toContain("old_secret");
    expect(out).toContain("smtp_pass");
    expect(out).not.toContain("<table");
  });

  it("marks unchanged values", () => {
    const rows = buildDiff({ mailer_otp_exp: 600 }, buildPayload({ template, templatesOnly: true }));
    expect(rows.find((r) => r.key === "mailer_otp_exp")?.changed).toBe(false);
  });
});

describe("envSchema", () => {
  it("fails on missing vars", () => {
    expect(envSchema.safeParse({}).success).toBe(false);
  });
});
