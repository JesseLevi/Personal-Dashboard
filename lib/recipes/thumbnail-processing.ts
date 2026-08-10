// #174/#171: server-side re-encode pipeline for recipe thumbnails. Recipe
// photos were being stored full-resolution (avg 790 kB) in the private
// `recipe-thumbnails` bucket and rendered into a 96x96 CSS slot -- on
// Supabase's free plan, egress (5 GB/month uncached), not storage, is the
// binding constraint, so every signed-URL download of a full-res original
// was paying for pixels nobody sees. This module re-encodes each upload
// into two WebP derivatives instead of storing the original at all:
//   - "card": 288x288 cover crop for the board's h-24 w-24 (96 CSS px) slot,
//     288 = 3x DPR so a Retina/high-DPI screen still gets a sharp image.
//   - "full": 1280 on the LONG EDGE, aspect preserved, for the detail hero
//     (aspect-[2/1] w-full, object-cover -- CSS does the crop). This used to
//     constrain only the width, which on the two real photos in the bucket
//     (both portrait 1638x2048) produced 1280x1600 -- a tall image of which
//     the 2:1 hero displays only the middle band, so ~40% of the shipped
//     bytes were cropped away by CSS and never seen. Constraining the long
//     edge instead yields 1024x1280 for those same two photos: 108.7 kB and
//     263.4 kB versus the old 149.9 kB and 375.3 kB -- a 29% cut on the full
//     variant, measured. A 2:1-cover crop baked in at encode time would have
//     saved more bytes still, but was deliberately rejected: originals are
//     not retained (see below), so baking today's hero aspect ratio into the
//     stored pixels would make a future change of that ratio unrecoverable.
//     Landscape sources are unaffected either way -- a 2:1 source still
//     comes out 1280x640 whether the constraint is on width or the long edge.
// Deliberately WITHOUT `import "server-only"` -- same rationale as
// lib/recipes/thumbnail-validation.ts's header: the server-only package
// throws outside a server/react-server context, including plain Node/
// Vitest, so pure/testable logic lives here and lib/recipes/thumbnails.ts
// is this module's `import "server-only"` caller. sharp is a plain Node
// native module and runs fine under Vitest.
//
// sharp's `.autoOrient()` reads the EXIF Orientation tag, physically
// rotates/flips pixels to match it, and then removes the tag (since it's
// now meaningless) -- so unlike the old hand-rolled stripper (which only
// deleted the EXIF segment/chunk and never looked at Orientation), a photo
// shot in portrait on a phone held sideways now actually comes out upright.
// sharp's WebP encoder also strips ALL metadata (EXIF/XMP/ICC/IPTC) from
// its output by default, which is what fully replaces the old per-format
// binary parser in thumbnail-validation.ts.
import sharp from "sharp";

export const THUMBNAIL_VARIANTS = ["card", "full"] as const;
export type ThumbnailVariant = (typeof THUMBNAIL_VARIANTS)[number];

/** Storage object key for one variant of a thumbnail `stem` (see thumbnails.ts's header for the `<user_id>/<uuid>` stem convention). */
export function thumbnailVariantPath(stem: string, variant: ThumbnailVariant): string {
  return `${stem}_${variant}.webp`;
}

/**
 * Decodes `bytes` once and renders both WebP derivatives from it. Throws
 * (propagates sharp's own error) on corrupt/unsupported input -- the
 * caller (lib/recipes/thumbnails.ts's `uploadRecipeThumbnail`) maps that to
 * an `"invalid-image"` ActionResult rather than a 500.
 */
export async function renderThumbnailVariants(
  bytes: Uint8Array,
): Promise<Record<ThumbnailVariant, Uint8Array>> {
  const base = sharp(bytes, { failOn: "none", limitInputPixels: 100_000_000 }).autoOrient();

  const card = await base
    .clone()
    .resize(288, 288, { fit: "cover", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  const full = await base
    .clone()
    .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();

  return { card, full };
}
