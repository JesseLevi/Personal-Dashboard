import type { MetadataRoute } from "next";

// #223 follow-up: page-specific Web App Manifest, linked from
// `app/(app)/te-doen/page.tsx` via `metadata.manifest`. Next's `manifest.ts`
// file convention is root-only (`isRootLayoutOrRootPage` gate — confirmed
// reading `next/dist/build/webpack/loaders/metadata/discover.js` and the
// Next.js docs), so a custom Route Handler is the supported alternative for
// a nested route. `id`/`start_url` are unique to this page so a home-screen
// install from here is a *separate* install from the root manifest's
// default (`app/manifest.ts`, `id: "/"`, `start_url: "/te-doen"`) — see
// design/notes/AppShell.md's "#223 follow-up" section for the full
// reasoning, including why `scope` stays `"/"` (shared with root) rather
// than narrowed to this page. UNVERIFIED on a real device — see
// docs/open-questions.md#per-page-home-screen-icon-unverified.
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: "/te-doen",
    name: "Te doen",
    short_name: "Te doen",
    start_url: "/te-doen",
    scope: "/",
    display: "standalone",
    background_color: "#F5F5F4",
    theme_color: "#F5F5F4",
    icons: [
      { src: "/icons/te-doen-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icons/te-doen-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icons/te-doen-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/te-doen-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
