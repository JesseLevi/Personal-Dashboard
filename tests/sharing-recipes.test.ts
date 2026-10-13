import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/recipes/session", () => ({
  getAuthenticatedUserId: async () => session.userId,
  requireUserId: async () =>
    session.userId ? { userId: session.userId } : { error: "unauthenticated" as const },
}));

type Row = {
  share_id: string;
  recipe_id: string;
  title: string;
  time_minutes: number | null;
  thumbnail_path: string | null;
  inviter_id: string;
  inviter_display_name: string;
  invited_at: string;
};
const db = vi.hoisted(() => ({
  pending: [] as unknown[],
  accept: { data: null as unknown, error: null as { code?: string; message: string } | null },
  acceptCalls: [] as string[],
  updates: [] as { values: Record<string, unknown>; filters: Record<string, string> }[],
  updateError: null as { code?: string; message: string } | null,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (name: string, args?: { p_share_id: string }) => {
      if (name === "pending_recipe_shares") return { data: db.pending, error: null };
      db.acceptCalls.push(args?.p_share_id ?? "");
      return db.accept;
    },
    from: () => ({
      update: (values: Record<string, unknown>) => {
        const filters: Record<string, string> = {};
        const q = {
          eq: (col: string, val: string) => {
            filters[col] = val;
            return q;
          },
          then: (resolve: (v: { error: unknown }) => void) => {
            db.updates.push({ values, filters });
            resolve({ error: db.updateError });
          },
        };
        return q;
      },
    }),
  }),
}));

import {
  acceptRecipeShare,
  copyRecipeThumbnail,
  pendingRecipeShares,
  toPendingRecipeShare,
} from "@/lib/sharing/recipes";
import { setObjectStoreForTesting } from "@/lib/storage";
import { createFakeObjectStore } from "@/lib/storage/fake";

const ME = "0b9f6d3e-7d5a-4c1e-9a52-3f6f2f1c8a11";
const SENDER = "7c1d0a52-1b3e-4f0a-8c44-9d2e5b6a7f10";
const OTHER = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const SHARE = "3f1c2a40-6b7d-4e8a-9c10-5a2b3c4d5e6f";
const RECIPE = "aaaaaaaa-1111-4222-8333-444444444444";
const U = "11111111-2222-4333-8444-555555555555";
const sourceStem = `${SENDER}/recipes/${U}`;

let store: ReturnType<typeof createFakeObjectStore>;

function row(overrides: Partial<Row> = {}): Row {
  return {
    share_id: SHARE,
    recipe_id: RECIPE,
    title: "Pannenkoeken",
    time_minutes: 30,
    thumbnail_path: sourceStem,
    inviter_id: SENDER,
    inviter_display_name: "Olga",
    invited_at: "2026-10-13T10:00:00Z",
    ...overrides,
  };
}

async function seedSource(stem = sourceStem) {
  const bytes = new Uint8Array([1, 2, 3]);
  const options = { contentType: "image/webp" };
  await store.put(`${stem}_card.webp`, bytes, options);
  await store.put(`${stem}_full.webp`, bytes, options);
}

beforeEach(() => {
  store = createFakeObjectStore();
  setObjectStoreForTesting(store);
  session.userId = ME;
  db.pending = [row()];
  db.accept = { data: [{ recipe_id: RECIPE, source_thumbnail_path: sourceStem }], error: null };
  db.acceptCalls = [];
  db.updates = [];
  db.updateError = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  setObjectStoreForTesting(null);
  vi.restoreAllMocks();
});

describe("toPendingRecipeShare", () => {
  it("maps the RPC row to camelCase and never carries the stored path", () => {
    const mapped = toPendingRecipeShare(row(), "https://img/x");
    expect(mapped).toEqual({
      shareId: SHARE,
      recipeId: RECIPE,
      title: "Pannenkoeken",
      timeMinutes: 30,
      thumbnailUrl: "https://img/x",
      inviterFirstName: "Olga",
      invitedAt: "2026-10-13T10:00:00Z",
    });
    expect(JSON.stringify(mapped)).not.toContain(sourceStem);
  });

  it("turns a blank first name into null and keeps a missing time as null", () => {
    const mapped = toPendingRecipeShare(row({ inviter_display_name: "  ", time_minutes: null }), null);
    expect(mapped.inviterFirstName).toBeNull();
    expect(mapped.timeMinutes).toBeNull();
    expect(mapped.thumbnailUrl).toBeNull();
  });
});

describe("pendingRecipeShares", () => {
  it("presigns the card variant server-side for the sender's own stem", async () => {
    const [share] = await pendingRecipeShares();
    expect(share?.thumbnailUrl).toContain(`${sourceStem}_card.webp`);
    expect(JSON.stringify(share)).not.toContain("thumbnail_path");
  });

  it("gives no URL for a recipe without a photo", async () => {
    db.pending = [row({ thumbnail_path: null })];
    const [share] = await pendingRecipeShares();
    expect(share?.thumbnailUrl).toBeNull();
  });

  it("never presigns a stem outside the sender's namespace", async () => {
    db.pending = [row({ thumbnail_path: `${OTHER}/recipes/${U}` })];
    const [share] = await pendingRecipeShares();
    expect(share?.thumbnailUrl).toBeNull();
  });

  it("never presigns a stem in another module of the sender", async () => {
    db.pending = [row({ thumbnail_path: `${SENDER}/avatar/${U}` })];
    const [share] = await pendingRecipeShares();
    expect(share?.thumbnailUrl).toBeNull();
  });

  it("is empty when signed out", async () => {
    session.userId = null;
    expect(await pendingRecipeShares()).toEqual([]);
  });
});

describe("copyRecipeThumbnail", () => {
  it("copies both variants under the caller's own recipes prefix", async () => {
    await seedSource();
    const stem = await copyRecipeThumbnail(ME, SENDER, sourceStem);
    expect(stem).toMatch(new RegExp(`^${ME}/recipes/[0-9a-f-]{36}$`));
    expect(stem).not.toBe(sourceStem);
    const copy = store.objects.get(`${stem}_card.webp`);
    expect(copy?.contentType).toBe("image/webp");
    expect(copy?.cacheControl).toBeTruthy();
    expect(store.objects.has(`${stem}_full.webp`)).toBe(true);
    expect(store.objects.has(`${sourceStem}_card.webp`)).toBe(true);
  });

  it("returns null and writes nothing when a source variant is missing", async () => {
    await store.put(`${sourceStem}_card.webp`, new Uint8Array([1]), { contentType: "image/webp" });
    expect(await copyRecipeThumbnail(ME, SENDER, sourceStem)).toBeNull();
    expect([...store.objects.keys()]).toEqual([`${sourceStem}_card.webp`]);
  });

  it("removes the first variant when the second write fails", async () => {
    await seedSource();
    const put = store.put;
    let calls = 0;
    store.put = async (...args) => {
      calls += 1;
      if (calls === 2) throw new Error("r2 down");
      return put(...args);
    };
    expect(await copyRecipeThumbnail(ME, SENDER, sourceStem)).toBeNull();
    expect([...store.objects.keys()].filter((k) => k.startsWith(`${ME}/`))).toEqual([]);
  });

  it("refuses a stem that is not in the sender's namespace", async () => {
    await seedSource(`${OTHER}/recipes/${U}`);
    expect(await copyRecipeThumbnail(ME, SENDER, `${OTHER}/recipes/${U}`)).toBeNull();
    expect([...store.objects.keys()].filter((k) => k.startsWith(`${ME}/`))).toEqual([]);
  });
});

describe("acceptRecipeShare", () => {
  it("copies the thumbnail and attaches it to the new recipe", async () => {
    await seedSource();
    const result = await acceptRecipeShare({ shareId: SHARE });
    expect(result).toEqual({ success: true, data: { recipeId: RECIPE } });
    expect(db.acceptCalls).toEqual([SHARE]);
    expect(db.updates).toHaveLength(1);
    const [update] = db.updates;
    expect(update?.filters).toEqual({ id: RECIPE, user_id: ME });
    expect(String(update?.values.thumbnail_path)).toMatch(new RegExp(`^${ME}/recipes/[0-9a-f-]{36}$`));
  });

  it("still succeeds, without a photo, when the thumbnail copy fails", async () => {
    // The source objects do not exist in R2.
    const result = await acceptRecipeShare({ shareId: SHARE });
    expect(result).toEqual({ success: true, data: { recipeId: RECIPE } });
    expect(db.updates).toEqual([]);
    expect([...store.objects.keys()]).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it("still succeeds when R2 is not configured", async () => {
    setObjectStoreForTesting(null);
    vi.stubEnv("R2_ACCOUNT_ID", "");
    const result = await acceptRecipeShare({ shareId: SHARE });
    vi.unstubAllEnvs();
    expect(result.success).toBe(true);
    expect(db.updates).toEqual([]);
  });

  it("skips the copy for a recipe without a photo", async () => {
    db.accept = { data: [{ recipe_id: RECIPE, source_thumbnail_path: null }], error: null };
    const result = await acceptRecipeShare({ shareId: SHARE });
    expect(result.success).toBe(true);
    expect(db.updates).toEqual([]);
  });

  it("does not copy a source stem outside the sender's namespace", async () => {
    const foreign = `${OTHER}/recipes/${U}`;
    await seedSource(foreign);
    db.accept = { data: [{ recipe_id: RECIPE, source_thumbnail_path: foreign }], error: null };
    const result = await acceptRecipeShare({ shareId: SHARE });
    expect(result.success).toBe(true);
    expect(db.updates).toEqual([]);
    expect([...store.objects.keys()].filter((k) => k.startsWith(`${ME}/`))).toEqual([]);
  });

  it("removes the copied objects when attaching the path fails", async () => {
    await seedSource();
    db.updateError = { code: "XX000", message: "boom" };
    const result = await acceptRecipeShare({ shareId: SHARE });
    expect(result.success).toBe(true);
    expect([...store.objects.keys()].filter((k) => k.startsWith(`${ME}/`))).toEqual([]);
  });

  it("reports not-found without calling the RPC when the offer is not the caller's", async () => {
    db.pending = [];
    expect(await acceptRecipeShare({ shareId: SHARE })).toEqual({ success: false, error: "not-found" });
    expect(db.acceptCalls).toEqual([]);
  });

  it("maps a guard failure from the RPC to not-found", async () => {
    db.accept = { data: null, error: { code: "42501", message: "nope" } };
    expect(await acceptRecipeShare({ shareId: SHARE })).toEqual({ success: false, error: "not-found" });
    expect(db.updates).toEqual([]);
  });

  it("rejects bad input and signed-out callers", async () => {
    expect(await acceptRecipeShare({ shareId: "nope" })).toEqual({ success: false, error: "invalid-input" });
    session.userId = null;
    expect(await acceptRecipeShare({ shareId: SHARE })).toEqual({ success: false, error: "unauthenticated" });
    expect(db.acceptCalls).toEqual([]);
  });
});
