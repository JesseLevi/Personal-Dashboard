import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import "./globals.css";

// #172: `appleWebApp` is what actually flips iOS from "Safari bookmark" to
// standalone app (manifest alone isn't enough on iOS). `statusBarStyle:
// "black-translucent"` is a deliberate user choice — full-bleed content
// under the status bar, not the ADR-safe "default" — which is why #113's
// `viewportFit: "cover"` below is a hard prerequisite and why every
// top-of-viewport chrome element (Sidebar, PageHeader, the mobile drawer)
// must itself account for `env(safe-area-inset-top)`; see design/notes/
// AppShell.md. `title` is the literal product name, same call as
// `metadata.title` above — not a next-intl key, see manifest.ts's header.
// `manifest` here is explicit/redundant with the auto-injected <link> Next
// generates for app/manifest.ts, kept because the ticket calls for it
// directly and it costs nothing extra.
export const metadata: Metadata = {
  title: "Atlas",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Atlas",
    statusBarStyle: "black-translucent",
  },
  // `other` works around a live Next 15.5 bug (confirmed against installed
  // node_modules and Next's own source comments): `appleWebApp.capable`
  // renders `name="mobile-web-app-capable"`, never the iOS-specific
  // `apple-mobile-web-app-capable` older iOS actually requires. See
  // design/notes/AppShell.md.
  other: { "apple-mobile-web-app-capable": "yes" },
};

// #113: `width`/`initialScale` restate Next's own default meta — the two
// additions are `viewportFit` and `themeColor`. `viewport-fit=cover` is the
// opt-in Safari requires before a page may extend under its translucent
// chrome, so without it `env(safe-area-inset-*)` resolves to 0 and the
// safe-area padding elsewhere (Sidebar, SidePanel) is inert. `themeColor` is
// literal hex (no CSS var this early); not under components/, so outside the
// raw-hex rule. Unverified on-device.
//
// #206: `themeColor` is now a light/dark pair — Next emits one `<meta
// name="theme-color" media="...">` per entry (Safari 15+, Chrome 93+ on
// installed PWAs read `media`; other browsers use the first). `#F5F5F4` /
// `#1C1917` are `surface-primary`'s light/dark values (stone-100/stone-900),
// both live in app/theme.css since #204; see design/notes/AppShell.md for why
// `app/manifest.ts`'s `theme_color` stays single-valued.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F4" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1917" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    // #206: `suppressHydrationWarning` is next-themes' documented requirement
    // — its inline script (first thing `ThemeProvider` renders, below) sets
    // `data-theme`/`style="color-scheme:…"` on this element synchronously,
    // before React hydrates, which would otherwise flag as a server/client
    // mismatch. See design/notes/AppShell.md.
    <html lang={locale} suppressHydrationWarning>
      <body className="bg-surface-primary text-text-primary antialiased">
        {/* #206: system preference only, no switch UI — not in Figma (docs/
            guides/ui-components.md). `attribute="data-theme"` is the exact
            selector app/theme.css's `[data-theme="dark"]` block and Ladle's
            toggle already key off — nothing in components/ changes.
            `enableColorScheme` (default true, left implicit) sets the CSS
            `color-scheme` property alongside the attribute, which is what
            flips native form controls/scrollbar. See design/notes/
            AppShell.md for the shell-regression check on the blocking
            inline script this renders. */}
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
