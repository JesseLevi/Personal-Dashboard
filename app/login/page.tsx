import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendMagicLink, signInWithPassword } from "./actions";

// Deliberately plain — no Figma design exists for login (ADR-0004); a designed
// login goes through the Figma loop in a later round.

const ERROR_KEYS = [
  "invalid-input",
  "invalid-credentials",
  "magic-link-failed",
  "magic-link-invalid",
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error, notice } = await searchParams;
  const t = await getTranslations("auth");
  const errorKey = error
    ? (ERROR_KEYS.find((key) => key === error) ?? "generic")
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6">
        <h1 className="text-xl font-semibold">{t("title")}</h1>

        {errorKey ? (
          <p className="mt-4 rounded bg-priority-urgent-bg p-2 text-sm text-priority-urgent">
            {t(`errors.${errorKey}`)}
          </p>
        ) : null}
        {notice === "magic-link-sent" ? (
          <p className="mt-4 rounded bg-priority-low-bg p-2 text-sm text-priority-low">
            {t("magicLinkSent")}
          </p>
        ) : null}

        <form action={signInWithPassword} className="mt-6 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {t("emailLabel")}
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded border border-border bg-surface px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("passwordLabel")}
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="rounded border border-border bg-surface px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-accent px-3 py-2 text-sm font-semibold text-white"
          >
            {t("signIn")}
          </button>
        </form>

        <hr className="my-6 border-border-muted" />

        <form action={sendMagicLink} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {t("magicLinkLabel")}
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded border border-border bg-surface px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-border px-3 py-2 text-sm font-semibold"
          >
            {t("sendMagicLink")}
          </button>
        </form>
      </div>
    </main>
  );
}
