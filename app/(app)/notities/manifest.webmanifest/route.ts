import type { MetadataRoute } from "next";

// #390: page-specific Web App Manifest for Notities. Same shape
// and reasoning as app/(app)/te-doen/manifest.webmanifest/route.ts — see
// that file's header and design/notes/AppShell.md.
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: "/notities",
    name: "Notities",
    short_name: "Notities",
    start_url: "/notities",
    scope: "/",
    display: "standalone",
    background_color: "#F5F5F4",
    theme_color: "#F5F5F4",
    icons: [
      {
        src: "/icons/notities-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/notities-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/notities-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/notities-512.png",
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
