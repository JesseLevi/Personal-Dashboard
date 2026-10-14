import type { MetadataRoute } from "next";

// Page-level Web App Manifest, linked from `app/(app)/agenda/page.tsx`: a
// separate home-screen install from the root one (same shape as Te doen,
// design/notes/AppShell.md).
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: "/agenda",
    name: "Agenda",
    short_name: "Agenda",
    start_url: "/agenda",
    scope: "/",
    display: "standalone",
    background_color: "#F5F5F4",
    theme_color: "#F5F5F4",
    icons: [
      { src: "/icons/agenda-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/agenda-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/agenda-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/agenda-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
