import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Dashboard",
};

// #113: no viewport export existed at all, so iOS Safari kept the layout
// viewport clipped to its own "safe" area and every `fixed inset-*` element
// in the app (SidePanel's scrim/panel, AppShellNav's mobile drawer) was
// constrained short of the true screen edges regardless of its own CSS —
// `viewportFit: "cover"` is the documented opt-in Safari requires before a
// page can extend under its translucent chrome at all. `themeColor` is the
// literal hex a `<meta>` tag needs (no CSS var possible this early) — it is
// `primitive.color.stone-100` / `semantic.surface-muted` in design/tokens.json,
// the same value `<body>` already paints; not componentised, so not subject
// to the components/-only raw-hex rule.
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
