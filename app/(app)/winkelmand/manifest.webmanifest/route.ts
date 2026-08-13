import type { MetadataRoute } from "next";

// #223 follow-up: page-specific Web App Manifest for Winkelmand. Same shape
// and reasoning as app/(app)/te-doen/manifest.webmanifest/route.ts — see
// that file's header and design/notes/AppShell.md.
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: "/winkelmand",
    name: "Winkelmand",
    short_name: "Winkelmand",
    start_url: "/winkelmand",
    scope: "/",
    display: "standalone",
    background_color: "#F5F5F4",
    theme_color: "#F5F5F4",
    icons: [
      {
        src: "/icons/winkelmand-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/winkelmand-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/winkelmand-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/winkelmand-512.png",
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
