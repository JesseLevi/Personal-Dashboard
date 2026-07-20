import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tAuth = await getTranslations("auth");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      {user ? (
        <div className="flex items-center gap-3 text-sm text-text-muted">
          <span>{t("loggedInAs", { email: user.email ?? "" })}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded border border-border px-3 py-1 font-semibold"
            >
              {tAuth("signOut")}
            </button>
          </form>
        </div>
      ) : (
        <Link href="/login" className="text-sm font-semibold text-accent">
          {tAuth("signIn")}
        </Link>
      )}
    </main>
  );
}
