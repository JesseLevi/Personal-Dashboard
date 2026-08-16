"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import clsx from "clsx";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Sidebar,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  type SidebarItemId,
} from "@/components/organisms/Sidebar";
import { Button } from "@/components/atoms/Button";
import { signOut } from "@/app/login/actions";
import type { Locale } from "@/lib/profile/types";
import { SettingsPanel } from "./SettingsPanel";

// Only the routes a ticket has actually built (#88, #177, #230); ids without
// an entry (assistant) have no page yet, so clicking them is a deliberate
// no-op rather than a link to a 404.
const ROUTES: Partial<Record<SidebarItemId, string>> = {
  todo: "/te-doen",
  notes: "/notities",
  recipes: "/recepten",
  shopping: "/winkelmand",
};

function activeItemForPath(pathname: string): SidebarItemId | undefined {
  const match = Object.entries(ROUTES).find(([, href]) => pathname.startsWith(href));
  return match?.[0] as SidebarItemId | undefined;
}

// Mobile drawer focus handling (#101) — same overlay/focus-trap/inert shape
// `SidePanel` already established (bg-text-primary/60 scrim, focus moves in on open
// and back to whatever triggered it on close, Tab is trapped, Escape
// closes), reimplemented here rather than imported: SidePanel is a
// `role="dialog"` bottom/side-sheet with its own title contract, not a
// full-height nav drawer, and it's owned by a parallel ticket. See
// design/notes/Sidebar.md for the full call.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// #265: closes the account dropdown on an outside pointerdown — same
// reasoning/shape as `TeDoenHeader.tsx`'s own `useCloseOnOutsidePointerDown`
// (reimplemented here, not imported/shared: two near-identical 10-line
// hooks in two files with a single caller each isn't worth a shared module
// yet, same "wait for a third consumer" call this codebase already made for
// Sidebar's own focus-trap duplication, see design/notes/Sidebar.md's #101
// entry). `ref` is the EXISTING desktop-wrapper/mobile-drawer container —
// the account trigger + its dropdown are both rendered inside `Sidebar`,
// which isn't `forwardRef`, so this checks "was the click inside this
// whole Sidebar subtree" rather than needing a ref threaded into the atom.
function useCloseOnOutsidePointerDown(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!active) return;
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [active, ref, onClose]);
}

export interface AppShellNavProps {
  children: React.ReactNode;
  /** #265: `profiles.display_name`, resolved server-side (`getProfileForNav`) — null falls back to a generic translated label. */
  displayName: string | null;
  /** #265: `profiles.avatar_url` — null renders the Sidebar's initials fallback. No upload UI yet. */
  avatarUrl: string | null;
  /** #265: current locale, seeds SettingsPanel's Taal field. */
  locale: Locale;
}

// Client wrapper: owns the collapse toggle (client-side, expanded by default
// — the fetched desktop frames disagree on Collapsed, see design/notes/
// Sidebar.md), the mobile drawer's open state (#101 — the drawer #88 left
// for later), the account dropdown + Settings panel state (#265), and
// derives the active item from the route. Sidebar has no directive of its
// own, so importing it here pulls it into the client bundle — the boundary
// stops at this file, which is why the layout above stays a Server
// Component and does the Supabase call.
export function AppShellNav({ children, displayName, avatarUrl, locale }: AppShellNavProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("components.sidebar");

  const labels: Record<SidebarItemId, string> = {
    todo: t("items.todo"),
    notes: t("items.notes"),
    recipes: t("items.recipes"),
    shopping: t("items.shopping"),
    assistant: t("items.assistant"),
  };
  const toggleLabel = collapsed ? t("expandLabel") : t("collapseLabel");
  const accountName = displayName ?? t("accountFallbackName");
  const accountMenuId = "sidebar-account-menu";

  function handleNavigate(item: SidebarItemId) {
    const href = ROUTES[item];
    if (!href) return;
    setMobileOpen(false);
    router.push(href);
  }

  // #170: warms the Next.js router cache for a route before the click that
  // navigates to it — on `pointerenter`/`focus` per item (Sidebar.tsx), plus
  // unconditionally on mount for the two data-heavy sections so a cold
  // sidebar (no prior hover) still benefits.
  function handleItemHover(item: SidebarItemId) {
    const href = ROUTES[item];
    if (href) router.prefetch(href);
  }

  useEffect(() => {
    router.prefetch("/te-doen");
    router.prefetch("/recepten");
  }, [router]);

  const drawerRef = useRef<HTMLDivElement>(null);
  const desktopWrapperRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (mobileOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      getFocusable(drawerRef.current)[0]?.focus();
    } else {
      previouslyFocused.current?.focus();
      previouslyFocused.current = null;
    }
  }, [mobileOpen]);

  function handleDrawerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      setMobileOpen(false);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = getFocusable(drawerRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function closeAccountMenu() {
    setAccountMenuOpen(false);
  }
  // Both wrappers are checked — only one is ever visible/interactive at a
  // given viewport (the other is `display:none` via `hidden md:flex` /
  // `md:hidden`), so whichever is currently hidden simply never receives a
  // pointerdown and its listener is a no-op.
  useCloseOnOutsidePointerDown(desktopWrapperRef, accountMenuOpen, closeAccountMenu);
  useCloseOnOutsidePointerDown(drawerRef, accountMenuOpen, closeAccountMenu);

  // #265: clicking Settings closes the mobile drawer FIRST (the ticket's own
  // body text) before sliding in the panel — desktop has no drawer to close,
  // the rail stays put.
  function openSettingsFromMobile() {
    setAccountMenuOpen(false);
    setMobileOpen(false);
    setSettingsOpen(true);
  }
  function openSettingsFromDesktop() {
    setAccountMenuOpen(false);
    setSettingsOpen(true);
  }

  function handleLogout() {
    setAccountMenuOpen(false);
    // signOut() (app/login/actions.ts) redirects internally — no local
    // pending state needed, the navigation itself is the feedback.
    void signOut();
  }

  return (
    <div className="flex min-h-screen items-stretch bg-surface-primary">
      {/* Desktop: Sidebar itself renders `fixed` below (stays put while
          `main` scrolls); this is a same-width flow spacer so the row still
          reserves the right amount of horizontal space for it. Both this and
          the fixed Sidebar transition on the same duration/easing so `main`
          never lags behind the rail. */}
      <div
        aria-hidden="true"
        className={clsx(
          "hidden shrink-0 transition-[width] duration-[var(--duration-base)] ease-base motion-reduce:transition-none md:block",
          collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
        )}
      />
      <div
        ref={desktopWrapperRef}
        className="hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex"
      >
        <Sidebar
          collapsed={collapsed}
          navLabel={t("navLabel")}
          toggleLabel={toggleLabel}
          onToggle={() => setCollapsed((prev) => !prev)}
          activeItem={activeItemForPath(pathname)}
          labels={labels}
          onNavigate={handleNavigate}
          onItemHover={handleItemHover}
          accountName={accountName}
          accountAvatarUrl={avatarUrl}
          accountMenuOpen={accountMenuOpen}
          accountMenuId={accountMenuId}
          onAccountMenuToggle={() => setAccountMenuOpen((open) => !open)}
          settingsLabel={t("settingsLabel")}
          onSettingsClick={openSettingsFromDesktop}
          logoutLabel={t("logoutLabel")}
          onLogoutClick={handleLogout}
        />
      </div>

      {/* Mobile drawer: overlay + the same full-width Sidebar sliding in
          from the left, opened by the button inside `main` below. Stays
          mounted (but `inert`) while closed so both directions transition;
          z-40/z-50 match SidePanel's own overlay/panel layers. */}
      <div
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
        // `invisible`/`transition-discrete`: same fix as SidePanel's scrim
        // (#113) — opacity alone left this mounted and composited at
        // `opacity-0`, the prime suspect for a stale-tinted iOS status bar
        // after close (unverified on-device, see design/notes/Sidebar.md).
        className={clsx(
          "fixed inset-0 z-40 bg-text-primary/60 transition-[opacity,visibility] transition-discrete duration-[var(--duration-base)] ease-base motion-reduce:transition-none md:hidden",
          mobileOpen ? "visible opacity-100" : "invisible pointer-events-none opacity-0",
        )}
      />
      <div
        ref={drawerRef}
        inert={!mobileOpen}
        aria-hidden={!mobileOpen}
        onKeyDown={handleDrawerKeyDown}
        className={clsx(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-[var(--duration-base)] ease-base motion-reduce:transition-none md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar
          navLabel={t("navLabel")}
          toggleLabel={t("collapseLabel")}
          onToggle={() => setMobileOpen(false)}
          activeItem={activeItemForPath(pathname)}
          labels={labels}
          onNavigate={handleNavigate}
          onItemHover={handleItemHover}
          accountName={accountName}
          accountAvatarUrl={avatarUrl}
          accountMenuOpen={accountMenuOpen}
          accountMenuId={accountMenuId}
          onAccountMenuToggle={() => setAccountMenuOpen((open) => !open)}
          settingsLabel={t("settingsLabel")}
          onSettingsClick={openSettingsFromMobile}
          logoutLabel={t("logoutLabel")}
          onLogoutClick={handleLogout}
        />
      </div>

      {/* `min-w-0` is load-bearing (#102): without it this `flex-1` item
          never constrains its min-content width, so wide content (the
          Kanban carousel) stretches `main`/`body` instead of scrolling
          inside its own row. `pt-` (#172, mobile only — `md:pt-20` already
          clears any real inset): the hamburger button below is the
          topmost on-screen chrome on a notched iPhone in standalone mode,
          so it needs the same `max()` safe-area idiom #113 used on
          Sidebar/SidePanel, or it renders partly under the status bar. */}
      {/* spacing-flag: pt-[max(1rem,env(safe-area-inset-top))] md:pt-20 —
          Navigation/Main's paddingTop is bound spacing/layout/page-padding-
          top (16→80, self-switching), but folding it into `pt-page-top`
          either drops the safe-area max() everywhere or needs
          `md:pt-page-top`, which the token forbids since it already
          switches itself past 768px; keeping the mobile max() and the
          flat desktop value raw is the least-bad option — no behaviour
          change to #172's fix without a design call — design/notes/
          AppShell.md. */}
      <main className="flex min-w-0 flex-1 flex-col gap-page-stack pt-[max(1rem,env(safe-area-inset-top))] pb-page-bottom pl-page-left md:pt-20">
        <Button
          variant="filled"
          icon="PanelLeftOpen"
          aria-label={t("expandLabel")}
          onClick={() => setMobileOpen(true)}
          className="md:hidden"
        />
        {children}
      </main>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentLocale={locale}
      />
    </div>
  );
}
