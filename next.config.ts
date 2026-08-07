import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // lib/recipes/thumbnail-validation.ts's MAX_THUMBNAIL_BYTES allows
      // 5 MiB thumbnails; Next's default Server Action body limit is 1 MB,
      // which rejected every real-world photo upload with a 413 before this
      // (`uploadRecipeThumbnail` in app/(app)/recepten/actions.ts sends the
      // file as FormData through a Server Action). 6mb covers the 5 MiB file
      // plus multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
};

export default withNextIntl(nextConfig);
