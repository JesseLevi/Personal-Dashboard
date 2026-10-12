import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/profile/session";
import { redirectToStoredObject } from "@/lib/storage";

// Same-origin avatar URL (`?v=<updated_at>`) for a plain <img>. Access is
// decided in SQL by avatar_path_for (self, or a share relation, ADR-0035):
// no photo and no access are both 404. 302 to a presigned R2 URL (ADR-0024 §5).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId: rawId } = await params;
  const target = z.uuid().safeParse(rawId);
  if (!target.success) return new NextResponse(null, { status: 404 });

  const userId = await getAuthenticatedUserId();

  return redirectToStoredObject({
    userId,
    keyOwnerId: target.data,
    ownerCheck: async () => {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.rpc("avatar_path_for", { p_user_id: target.data });
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
