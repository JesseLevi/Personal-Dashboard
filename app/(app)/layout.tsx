import { redirect } from "next/navigation";
import { after } from "next/server";
import { getAuthenticatedUserId } from "@/lib/boards/session";
import { ensureUserDefaults } from "@/lib/defaults/ensure";
import { runAssistant } from "@/lib/assistant/run";
import { runLazyEmbeddingDrain } from "@/lib/embeddings/lazy";
import { isEmbeddingConfigured } from "@/lib/ai";
import { getAiEnabled, getAvatarSrc, getLastName, getProfileForNav } from "@/lib/profile/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShellNav } from "./_components/AppShellNav";

// Auth guard for the whole (app) route group. #168 added middleware.ts,
// which refreshes the session cookie ahead of this render, but the redirect
// itself still lives here — middleware only refreshes tokens, it doesn't
// gate routes, so there is exactly one redirect rule for unauthenticated
// access (this one), not two competing ones. getAuthenticatedUserId() is
// cache()'d (lib/boards/session.ts), so this call is free if a query or
// action elsewhere in the same request already resolved the user.
//
// #265: also resolves the Sidebar account row + SettingsPanel's data here
// (one extra query, `getProfileForNav`, itself `cache()`'d) — server-side,
// same "browser never talks to Supabase directly" rule every other page
// data fetch in this codebase follows.
// after() shares this segment's max duration; the lazy embedding drain stays well under it.
export const maxDuration = 60;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  // #293: lazy, idempotent seeding for accounts the signup triggers never
  // reached (ADR-0017). Steady state = one indexed count in SQL.
  await ensureUserDefaults();

  // #404: separate, error-swallowing query so a not-yet-migrated last_name
  // column (and #434's avatar_path) cannot break the nav profile; all run in parallel.
  const [profile, lastName, avatarSrc, aiEnabled] = await Promise.all([
    getProfileForNav(),
    getLastName(),
    getAvatarSrc(),
    getAiEnabled(),
  ]);

  // ADR-0043 §5: the member's own backlog drains after the response, RLS client, never awaited.
  const supabase = await createSupabaseServerClient();
  after(() => runLazyEmbeddingDrain(supabase, userId));
  // ADR-0046 §7: rhythm signals in their own after(); claim_assistant_run() allows one run per 6 hours.
  after(() => runAssistant({ client: supabase, userId, path: "lazy" }));

  return (
    <AppShellNav
      displayName={profile.displayName}
      avatarSrc={avatarSrc}
      lastName={lastName}
      locale={profile.locale}
      aiEnabled={aiEnabled}
      aiAvailable={isEmbeddingConfigured()}
    >
      {children}
    </AppShellNav>
  );
}
