import type { MetadataRoute } from "next";

// #223 follow-up: page-specific Web App Manifest for Recepten. Same shape
// and reasoning as app/(app)/te-doen/manifest.webmanifest/route.ts — see
// that file's header and design/notes/AppShell.md.
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: "/recepten",
    name: "Recepten",
    short_name: "Recepten",
    start_url: "/recepten",
    scope: "/",
    display: "standalone",
    background_color: "#F5F5F4",
    theme_color: "#F5F5F4",
    icons: [
      { src: "/icons/recepten-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icons/recepten-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icons/recepten-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/recepten-512.png",
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
