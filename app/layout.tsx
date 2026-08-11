import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
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
  title: "Personal Dashboard",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Personal Dashboard",
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
// the literal hex a `<meta>` needs (no CSS var this early) — `stone-100` /
// `surface-primary` in design/tokens.json, the value `<body>` already paints;
// not under components/, so outside the raw-hex rule. Unverified on-device.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F5F5F4",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="bg-surface-primary text-text-primary antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
