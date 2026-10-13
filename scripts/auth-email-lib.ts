// Pure helpers for scripts/configure-auth-email.ts (#493, ADR-0038). No I/O, so it is unit-tested.
import { z } from "zod";

export const SECRET_KEYS = ["smtp_pass"] as const;

export const envSchema = z.object({
  SUPABASE_ACCESS_TOKEN: z.string().min(1),
  SUPABASE_PROJECT_REF: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  AUTH_EMAIL_FROM: z.string().email(),
  AUTH_EMAIL_SENDER_NAME: z.string().min(1),
});
export type AuthEmailEnv = z.infer<typeof envSchema>;

export const templatesOnlyEnvSchema = envSchema.pick({
  SUPABASE_ACCESS_TOKEN: true,
  SUPABASE_PROJECT_REF: true,
});

export const MAGIC_LINK_SUBJECT = "Je inlogcode voor Atlas / Your Atlas login code";

export type AuthConfigPayload = Record<string, string | number>;

export function buildPayload(opts: {
  template: string;
  env?: Pick<AuthEmailEnv, "RESEND_API_KEY" | "AUTH_EMAIL_FROM" | "AUTH_EMAIL_SENDER_NAME">;
  templatesOnly?: boolean;
}): AuthConfigPayload {
  const payload: AuthConfigPayload = {
    mailer_subjects_magic_link: MAGIC_LINK_SUBJECT,
    mailer_templates_magic_link_content: opts.template,
    mailer_otp_exp: 600,
    mailer_otp_length: 6,
  };
  if (opts.templatesOnly) return payload;
  if (!opts.env) throw new Error("SMTP env is required unless templatesOnly");
  return {
    ...payload,
    smtp_admin_email: opts.env.AUTH_EMAIL_FROM,
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: opts.env.RESEND_API_KEY,
    smtp_sender_name: opts.env.AUTH_EMAIL_SENDER_NAME,
    smtp_max_frequency: 60,
    rate_limit_email_sent: 30,
  };
}

export function maskValue(key: string, value: unknown): string {
  if ((SECRET_KEYS as readonly string[]).includes(key)) {
    return value ? "******** (set)" : "(empty)";
  }
  if (key === "mailer_templates_magic_link_content") {
    const s = String(value ?? "");
    return s ? `<${s.length} chars>` : "(empty)";
  }
  return value === undefined || value === null || value === "" ? "(empty)" : String(value);
}

export type DiffRow = { key: string; current: string; next: string; changed: boolean };

export function buildDiff(current: Record<string, unknown>, payload: AuthConfigPayload): DiffRow[] {
  return Object.keys(payload).map((key) => {
    const cur = current[key];
    // The API never returns the SMTP password; compare the rest by value.
    const changed = (SECRET_KEYS as readonly string[]).includes(key)
      ? true
      : String(cur ?? "") !== String(payload[key]);
    return { key, current: maskValue(key, cur), next: maskValue(key, payload[key]), changed };
  });
}

export function formatDiff(rows: DiffRow[]): string {
  return rows
    .map((r) => `${r.changed ? "~" : "="} ${r.key}: ${r.current} -> ${r.next}`)
    .join("\n");
}
