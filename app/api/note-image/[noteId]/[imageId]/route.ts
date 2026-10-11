import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/notes/session";
import { noteImageParamsSchema } from "@/lib/notes/schemas";
import { objectKey, redirectToStoredObject } from "@/lib/storage";

// Same-origin image URL stored in note documents (ADR-0022 §4): session +
// note ownership, then 302 to a presigned R2 URL (ADR-0024 §5).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ noteId: string; imageId: string }> },
) {
  const parsed = noteImageParamsSchema.safeParse(await params);
  if (!parsed.success) return new NextResponse(null, { status: 404 });
  const { noteId, imageId } = parsed.data;

  const userId = await getAuthenticatedUserId();
  return redirectToStoredObject({
    userId,
    ownerCheck: async (id) => {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from("notes")
        .select("id")
        .eq("id", noteId)
        .eq("user_id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? objectKey(id, "notes", noteId, `${imageId}.webp`) : null;
    },
  });
}
