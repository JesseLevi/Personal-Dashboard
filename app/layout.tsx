import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Dashboard",
};

// #113: `width`/`initialScale` restate Next's own default meta — the two
// additions are `viewportFit` and `themeColor`. `viewport-fit=cover` is the
// opt-in Safari requires before a page may extend under its translucent
// chrome, so without it `env(safe-area-inset-*)` resolves to 0 and the
// safe-area padding elsewhere (Sidebar, SidePanel) is inert. `themeColor` is
// the literal hex a `<meta>` needs (no CSS var this early) — `stone-100` /
// `surface-muted` in design/tokens.json, the value `<body>` already paints;
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
      <body className="bg-surface-muted text-text antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
