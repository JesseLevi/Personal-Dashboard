import { redirect } from "next/navigation";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { greetingKeyForHour } from "@/lib/auth/greeting";
import { LoginForm } from "./LoginForm";
import { sendMagicLink, signInWithPassword } from "./actions";

// figma: node-id=3929:25181 (Pages/Login — LogIn/Desktop 3929:25202,
// LogIn/Mobile 3929:25182). Server Component: auth-check + translations +
// layout + the decorative visual pane; LoginForm.tsx owns the interactive
// two-step animation. Full record: design/notes/LoginForm.md.
//
// Desktop only ever draws step 1 (StepAnimation didn't exist yet when that
// frame was made) — read as "desktop gets the same two-step behaviour as
// mobile", not "desktop has no step 3" (design/notes/LoginForm.md).
export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/te-doen");

  const greetingKey = greetingKeyForHour(new Date().getHours());

  return (
    <main className="min-h-screen p-4">
      <div className="mx-auto flex max-w-[1408px] flex-col md:flex-row md:items-center md:gap-6">
        <div className="flex w-full flex-col items-center md:w-[548px] md:shrink-0">
          <LoginForm
            signInWithPasswordAction={signInWithPassword}
            sendMagicLinkAction={sendMagicLink}
            serverGreetingKey={greetingKey}
          />
        </div>

        {/* Flat image-fill in Figma (both breakpoints) — exported once and
            committed as a static asset rather than re-fetched at build time
            (Figma URLs expire). Decorative: aria-hidden + empty alt. */}
        <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-surface-raised md:max-w-[836px] md:flex-1">
          <Image
            src="/login/login-visual-mobile.png"
            alt=""
            aria-hidden="true"
            fill
            sizes="(min-width: 768px) 0px, 370px"
            className="object-cover md:hidden"
          />
          <Image
            src="/login/login-visual-desktop.png"
            alt=""
            aria-hidden="true"
            fill
            sizes="(min-width: 768px) 836px, 0px"
            className="hidden object-cover md:block"
          />
        </div>
      </div>
    </main>
  );
}
