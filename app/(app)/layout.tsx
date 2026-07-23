import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShellNav } from "./_components/AppShellNav";

// Auth guard for the whole (app) route group. There is no session-refresh
// middleware yet (#8, Backlog), so this per-request check in the layout is
// the only gate until #8 takes it over.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <AppShellNav>{children}</AppShellNav>;
}
