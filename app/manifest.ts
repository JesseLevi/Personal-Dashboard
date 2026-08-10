import type { MetadataRoute } from "next";

// #172: powers iOS/Android "Add to Home Screen" (App Router auto-routes this
// to /manifest.webmanifest and injects the <link rel="manifest">). `name`/
// `short_name` are the literal product name, not next-intl keys — same call
// `app/layout.tsx`'s `metadata.title` already made (ADR-0007 covers UI
// copy; a manifest's app identity is closer to a package name than
// translatable text, and next-intl has no locale to key off here since this
// route is static). `background_color`/`theme_color` reuse the exact hex
// `app/layout.tsx`'s `viewport.themeColor` already uses — `stone-100` /
// `surface-muted` in design/tokens.json. Icons: see design/notes/AppShell.md
// for the Figma source (node 4055:14328) and the flatten-for-iOS call.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Personal Dashboard",
    short_name: "Dashboard",
    start_url: "/te-doen",
    scope: "/",
    display: "standalone",
    background_color: "#F5F5F4",
    theme_color: "#F5F5F4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
