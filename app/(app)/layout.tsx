import { redirect } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/boards/session";
import { getProfileForNav } from "@/lib/profile/queries";
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
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const profile = await getProfileForNav();

  return (
    <AppShellNav
      displayName={profile.displayName}
      avatarUrl={profile.avatarUrl}
      locale={profile.locale}
    >
      {children}
    </AppShellNav>
  );
}
