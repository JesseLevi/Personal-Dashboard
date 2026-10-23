import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const createService = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: createService }));

import { GET } from "@/app/api/cron/embeddings/route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/embeddings", () => {
  it("answers 401 without the cron secret, before a service client exists", async () => {
    vi.stubEnv("CRON_SECRET", "x".repeat(32));
    for (const headers of [new Headers(), new Headers({ authorization: "Bearer fout" })]) {
      const response = await GET(new Request("http://localhost/api/cron/embeddings", { headers }));
      expect(response.status).toBe(401);
    }
    expect(createService).not.toHaveBeenCalled();
  });

  it("answers 401 when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(
      new Request("http://localhost/api/cron/embeddings", { headers: { authorization: "Bearer " } }),
    );
    expect(response.status).toBe(401);
    expect(createService).not.toHaveBeenCalled();
  });
});
