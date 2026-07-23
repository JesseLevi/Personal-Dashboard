"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sidebar, type SidebarItemId } from "@/components/organisms/Sidebar";

// Only the routes this ticket (#88) actually builds; ids without an entry
// (notes, shopping, clothes, assistant) have no page yet, so clicking them
// is a deliberate no-op rather than a link to a 404.
const ROUTES: Partial<Record<SidebarItemId, string>> = {
  todo: "/te-doen",
  recipes: "/recepten",
};

function activeItemForPath(pathname: string): SidebarItemId | undefined {
  const match = Object.entries(ROUTES).find(([, href]) => pathname.startsWith(href));
  return match?.[0] as SidebarItemId | undefined;
}

// Client wrapper: owns the collapse toggle (client-side, expanded by default
// — the fetched desktop frames disagree on Collapsed, see design/notes/
// Sidebar.md) and derives the active item from the route. Sidebar has no
// directive of its own, so importing it here pulls it into the client
// bundle — the boundary stops at this file, which is why the layout above
// stays a Server Component and does the Supabase call.
export function AppShellNav({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("components.sidebar");

  const labels: Record<SidebarItemId, string> = {
    todo: t("items.todo"),
    notes: t("items.notes"),
    recipes: t("items.recipes"),
    shopping: t("items.shopping"),
    clothes: t("items.clothes"),
    assistant: t("items.assistant"),
  };
  const toggleLabel = collapsed ? t("expandLabel") : t("collapseLabel");

  return (
    <div className="flex min-h-screen items-stretch bg-surface-muted">
      <div className="hidden md:flex">
        <Sidebar
          collapsed={collapsed}
          navLabel={t("navLabel")}
          toggleLabel={toggleLabel}
          onToggle={() => setCollapsed((prev) => !prev)}
          activeItem={activeItemForPath(pathname)}
          labels={labels}
          onNavigate={(item) => {
            const href = ROUTES[item];
            if (href) router.push(href);
          }}
        />
      </div>
      <main className="flex flex-1 flex-col gap-6 pt-4 pb-20 pl-4 md:pt-20 md:pb-20 md:pl-32">
        {/* Figma's mobile frame (3680:1435) puts a standalone nav toggle
            here, above the Header. It is deliberately NOT rendered yet:
            below `md` the Sidebar is hidden, so the button would announce
            itself to a screen reader and then do nothing when activated —
            worse than absent. #89 (SidePanel) supplies the mobile drawer it
            is meant to open; it gets built with that. */}
        {children}
      </main>
    </div>
  );
}
