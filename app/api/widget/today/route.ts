import { NextResponse } from "next/server";
import { timeZoneSchema } from "@/lib/agenda/time-zone";
import { outcomeToHttp, parseBearerToken } from "@/lib/widget/http";
import { getWidgetToday } from "@/lib/widget/today";

// Day contract for the iPhone widget (ADR-0047). Authenticates by widget token
// only: no cookies, no session. Never cached.
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };

function reply(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

export async function GET(request: Request) {
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token) return reply({ error: "unauthorized" }, 401);

  const timeZone = timeZoneSchema.safeParse(new URL(request.url).searchParams.get("tz"));
  if (!timeZone.success) return reply({ error: "invalid_time_zone" }, 400);

  const result = await getWidgetToday(token, timeZone.data);
  if (result.outcome === "ok") return reply(result.day, 200);
  return reply({ error: result.outcome }, outcomeToHttp(result.outcome));
}
