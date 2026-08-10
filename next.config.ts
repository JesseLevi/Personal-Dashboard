import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
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
