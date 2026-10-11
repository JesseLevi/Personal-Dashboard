import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import {
  THUMBNAIL_VARIANTS,
  thumbnailVariantPath,
  type ThumbnailVariant,
} from "@/lib/recipes/thumbnail-processing";
import { redirectToStoredObject } from "@/lib/storage";

// Same-origin thumbnail URL (`?size=...&v=<updated_at>`) for a plain <img>
// (never next/image). 302 to a presigned R2 URL (ADR-0024 §5).
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
  const userId = await getAuthenticatedUserId();
  if (!userId) return new NextResponse(null, { status: 401 });

  // RLS-bound lookup, run once; reused via ownerCheck.
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

  return redirectToStoredObject({
    userId,
    ownerCheck: async () => thumbnailVariantPath(stem, size),
  });
}
