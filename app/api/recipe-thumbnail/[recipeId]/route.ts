import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import { THUMBNAIL_VARIANTS, thumbnailVariantPath, type ThumbnailVariant } from "@/lib/recipes/thumbnail-processing";

// #171/#174: same-origin thumbnail delivery, replacing the per-render
// signed-URL round trip (lib/recipes/thumbnails.ts) for the board/detail
// hero. This is a stable URL (`/api/recipe-thumbnail/<id>?size=...&v=...`)
// the browser's own HTTP cache can key on -- a signed URL can't be cached
// long-term since it's a one-shot token, and `next/image` can't front it
// either (its optimizer fetches server-side, without this request's
// cookies, so it can never read a private cookie-authenticated asset --
// see design/notes/CardContentRecipe.md). Auth is the request-scoped,
// RLS-bound client (ADR-0002/0003 -- never service_role); the storage
// select policy (20260801000001_recipe_thumbnails_storage.sql) already
// scopes reads to the caller's own `<user_id>/` prefix, and the
// `stem.startsWith` guard below fails fast on a mismatch without a storage
// round trip, same convention as thumbnails.ts's own helpers. `v` is an
// opaque, unvalidated cache-buster (`recipes.updated_at`) -- its only job
// is to change the URL when the photo changes, which is what makes
// `immutable` safe.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params;
  const parsedId = z.uuid().safeParse(recipeId);
  if (!parsedId.success) return new NextResponse(null, { status: 404 });

  const sizeParam = request.nextUrl.searchParams.get("size") ?? "card";
  if (!THUMBNAIL_VARIANTS.includes(sizeParam as ThumbnailVariant)) {
    return new NextResponse(null, { status: 400 });
  }
  const size = sizeParam as ThumbnailVariant;

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return new NextResponse(null, { status: 401 });

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("thumbnail_path")
    .eq("id", parsedId.data)
    .eq("user_id", userId)
    .maybeSingle();

  if (recipeError) {
    console.error("[recipes] recipe-thumbnail route lookup failed:", recipeError.message);
    return new NextResponse(null, { status: 404 });
  }

  const stem = recipe?.thumbnail_path;
  if (!stem || !stem.startsWith(`${userId}/`)) {
    return new NextResponse(null, { status: 404 });
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from("recipe-thumbnails")
    .download(thumbnailVariantPath(stem, size));

  if (downloadError || !file) {
    console.error("[recipes] recipe-thumbnail route download failed:", downloadError?.message);
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(file, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
