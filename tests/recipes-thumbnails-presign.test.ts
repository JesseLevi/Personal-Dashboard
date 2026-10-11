import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/recipes/session", () => ({ getAuthenticatedUserId: async () => null }));
const preconnect = vi.hoisted(() => vi.fn());
vi.mock("react-dom", () => ({ preconnect }));

import { CardContentRecipe } from "@/components/molecules/CardContentRecipe";
import { presignRecipeThumbnail, presignRecipeThumbnails } from "@/lib/recipes/thumbnails";
import { recipeThumbnailRouteUrl } from "@/lib/recipes/thumbnail-url";
import { objectStoreOrigin, setObjectStoreForTesting } from "@/lib/storage";
import { createFakeObjectStore } from "@/lib/storage/fake";
import { resolveImageSrc } from "@/lib/ui/image-fallback";

const A = "0b9f6d3e-7d5a-4c1e-9a52-3f6f2f1c8a11";
const B = "7c1d0a52-1b3e-4f0a-8c44-9d2e5b6a7f10";
const U = "11111111-2222-4333-8444-555555555555";
const stem = `${A}/recipes/${U}`;

beforeEach(() => {
  setObjectStoreForTesting(createFakeObjectStore());
  preconnect.mockClear();
});
afterEach(() => {
  setObjectStoreForTesting(null);
  vi.unstubAllEnvs();
});

describe("presignRecipeThumbnail", () => {
  it("presigns the requested variant for the owner", async () => {
    const url = await presignRecipeThumbnail(A, stem, "card");
    expect(url).toContain(`${stem}_card.webp`);
    expect(await presignRecipeThumbnail(A, stem, "full")).toContain(`${stem}_full.webp`);
  });

  it("returns null for another user's stem or no stem", async () => {
    expect(await presignRecipeThumbnail(B, stem, "card")).toBeNull();
    expect(await presignRecipeThumbnail(A, null, "card")).toBeNull();
  });

  it("returns null (no throw) when R2 is not configured", async () => {
    setObjectStoreForTesting(null);
    for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]) {
      vi.stubEnv(name, "");
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await presignRecipeThumbnail(A, stem, "card")).toBeNull();
    expect(await presignRecipeThumbnails(A, [{ id: "r1", thumbnail_path: stem }], "card")).toEqual({});
    expect(objectStoreOrigin()).toBeNull();
    spy.mockRestore();
  });
});

describe("presignRecipeThumbnails", () => {
  it("maps only recipes with a resolvable thumbnail and preconnects once", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "acct");
    vi.stubEnv("R2_ACCESS_KEY_ID", "k");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "s");
    vi.stubEnv("R2_BUCKET_NAME", "b");
    const out = await presignRecipeThumbnails(
      A,
      [
        { id: "r1", thumbnail_path: stem },
        { id: "r2", thumbnail_path: null },
        { id: "r3", thumbnail_path: `${B}/recipes/${U}` },
      ],
      "card",
    );
    expect(Object.keys(out)).toEqual(["r1"]);
    expect(preconnect).toHaveBeenCalledExactlyOnceWith("https://acct.r2.cloudflarestorage.com");
  });

  it("returns an empty map when signed out", async () => {
    expect(await presignRecipeThumbnails(null, [{ id: "r1", thumbnail_path: stem }], "card")).toEqual({});
  });
});

describe("image fallback", () => {
  it("swaps to the fallback only after the primary failed", () => {
    expect(resolveImageSrc("a", "b", null)).toBe("a");
    expect(resolveImageSrc("a", "b", "a")).toBe("b");
    expect(resolveImageSrc("a", undefined, "a")).toBe("a");
  });

  it("route URL is versioned by the stem uuid", () => {
    expect(recipeThumbnailRouteUrl("rid", stem, "full")).toBe(`/api/recipe-thumbnail/rid?v=${U}&size=full`);
  });

  it("CardContentRecipe renders the presigned URL, not the route", () => {
    const html = renderToStaticMarkup(
      createElement(CardContentRecipe, {
        name: "Pasta",
        imageUrl: "https://acct.r2.cloudflarestorage.com/b/x/card.webp?sig=1",
        imageFallbackUrl: "/api/recipe-thumbnail/rid?v=u&size=card",
      }),
    );
    expect(html).toContain('src="https://acct.r2.cloudflarestorage.com/b/x/card.webp?sig=1"');
    expect(html).not.toContain("/api/recipe-thumbnail");
  });
});
