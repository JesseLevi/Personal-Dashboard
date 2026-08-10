import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // #173: Next's documented default for lucide-react's ~1500-icon barrel.
    // Measured before/after here: no production bundle-size change, because
    // lucide-react already declares sideEffects:false and ships one ESM
    // module per icon, so standard tree-shaking already dropped everything
    // components/atoms/Icon.tsx doesn't import. Kept anyway — Next's own
    // docs recommend it for this package and it isn't harmful — but the
    // real fix if lucide-react ever regresses this lives in
    // design/notes/Icon.md, not here.
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      // lib/recipes/thumbnail-validation.ts's MAX_THUMBNAIL_BYTES allows
      // 10 MiB thumbnails (#174: raised from 5 MiB now that uploads are
      // re-encoded server-side into small WebP derivatives rather than
      // stored as-is, so the input cap no longer needs to track what the
      // bucket stores); Next's default Server Action body limit is 1 MB,
      // which rejected every real-world photo upload with a 413 before this
      // (`uploadRecipeThumbnail` in app/(app)/recepten/actions.ts sends the
      // file as FormData through a Server Action). 11mb covers the 10 MiB
      // file plus multipart overhead.
      bodySizeLimit: "11mb",
    },
  },
};

export default withNextIntl(nextConfig);
