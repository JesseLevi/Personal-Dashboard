import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/recipes/contents", () => ({ replaceRecipeContents: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/recipes/thumbnails", () => ({
  storeRecipeThumbnail: vi.fn(async () => ({ success: true, data: { path: "u1/thumb" } })),
}));
vi.mock("@/lib/recipes/import/match-ingredients", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/recipes/import/match-ingredients")>()),
  matchIngredients: vi.fn(),
  resolveIngredientId: vi.fn(),
}));

import { AiError, setProviderForTests, type AiProvider } from "@/lib/ai";
import { SafeFetchError, type SafeFetchResult } from "@/lib/net/safe-fetch";
import { replaceRecipeContents, type IngredientLine, type StepLine } from "@/lib/recipes/contents";
import { matchIngredients, resolveIngredientId, type LineMatch } from "@/lib/recipes/import/match-ingredients";
import { runRecipeImport, toImportErrorCode } from "@/lib/recipes/import/pipeline";
import { storeRecipeThumbnail } from "@/lib/recipes/thumbnails";
import { IMPORT_ERROR_CODES } from "@/lib/recipes/enums";
import { computeRecipeNutritionPerPerson } from "@/lib/recipes/nutrition";
import type { UnitCode } from "@/lib/recipes/units";
import type { MatcherClient } from "@/lib/recipes/import/match-ingredients";

const URL_ = "https://example.com/recept";
const JOB = { userId: "u1", recipeId: "r1", url: URL_ };

function page(jsonLd: object | null, body = "<p>x</p>"): string {
  const ld = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : "";
  return `<!doctype html><html><head><title>Pagina</title>${ld}</head><body>${body}</body></html>`;
}

const recipeLd = (over: Record<string, unknown> = {}) => ({
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Tomatensoep",
  recipeYield: "4 personen",
  totalTime: "PT45M",
  image: "https://example.com/soep.jpg",
  recipeIngredient: ["2 x 400 g blik tomaten", "1 teentje knoflook", "Voor de saus:", "1 el olijfolie", "zout"],
  recipeInstructions: [{ "@type": "HowToStep", text: "Kook de tomaten." }, { "@type": "HowToStep", text: "Roer de olie erdoor." }],
  ...over,
});

function fetcher(html: string, image: { contentType: string } | "fail" = { contentType: "image/jpeg" }) {
  return vi.fn(async (url: string, opts?: { allowImages?: boolean }): Promise<SafeFetchResult> => {
    if (opts?.allowImages) {
      if (image === "fail") throw new SafeFetchError("http_error", "nope", 404);
      return { url, status: 200, contentType: image.contentType, body: Buffer.from([1, 2, 3]) };
    }
    return { url, status: 200, contentType: "text/html", body: Buffer.from(html) };
  });
}

function fakeSupabase() {
  const updates: Array<Record<string, unknown>> = [];
  const supabase = {
    from: vi.fn(() => ({
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        const chain = { eq: () => chain, then: (resolve: (v: unknown) => void) => resolve({ error: null }) };
        return chain;
      },
    })),
  } as unknown as MatcherClient;
  return { supabase, updates };
}

const review = (): LineMatch => ({ ingredientId: null, chosen: null, needsReview: true, candidates: [] });
const own = (id: string): LineMatch => ({
  ingredientId: id,
  chosen: { source: "own", id, name: "x", score: 1 },
  needsReview: false,
  candidates: [],
});

function contentsCall() {
  const call = vi.mocked(replaceRecipeContents).mock.calls[0]!;
  return { ingredients: call[3] as IngredientLine[], steps: call[4] as StepLine[] };
}

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.mocked(replaceRecipeContents).mockClear();
  vi.mocked(replaceRecipeContents).mockResolvedValue({ ok: true });
  vi.mocked(storeRecipeThumbnail).mockClear();
  vi.mocked(matchIngredients).mockReset();
  vi.mocked(resolveIngredientId).mockReset();
  vi.mocked(resolveIngredientId).mockImplementation(async (_s, _u, chosen) =>
    chosen.source === "own" ? chosen.id : "own-from-ref",
  );
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  setProviderForTests(undefined);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("runRecipeImport: JSON-LD page", () => {
  it("saves through replace_recipe_contents and ends done in one update", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("tomaat"), review(), own("olie"), review()]);
    const { supabase, updates } = fakeSupabase();
    const fetchPage = fetcher(page(recipeLd()));
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetchPage });

    const { ingredients, steps } = contentsCall();
    // "2 x 400 g blik tomaten" is saved exactly like a manual 800 g entry.
    expect(ingredients[0]).toMatchObject({ name: "blik tomaten", quantity: 800, unit: "gram", ingredientId: "tomaat", needsReview: false, groupLabel: null });
    // Group headings become group_label on the lines below them.
    expect(ingredients[2]).toMatchObject({ name: "olijfolie", groupLabel: "Voor de saus", ingredientId: "olie" });
    expect(ingredients).toHaveLength(4);
    expect(steps.map((s) => s.instruction)).toEqual(["Kook de tomaten.", "Roer de olie erdoor."]);
    expect(updates).toEqual([
      expect.objectContaining({ title: "Tomatensoep", servings: 4, time_minutes: 45, thumbnail_path: "u1/thumb", import_status: "done", import_error: null }),
    ]);
  });

  it("acceptance: an imported '2 x 400 g blik tomaten' line has the same nutrition as a manual 800 g entry", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("tomaat"), own("k"), own("o"), own("z")]);
    const { supabase } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd())) });
    const imported = contentsCall().ingredients[0]!;
    const nutrients = { kcalPer100g: 18, proteinGPer100g: 0.9, carbsGPer100g: 3.5, fatGPer100g: 0.2, fiberGPer100g: 1.1 };
    const fromImport = computeRecipeNutritionPerPerson(
      [{ quantity: imported.quantity, unit: imported.unit as UnitCode, unitMassGrams: null, nutrients }],
      4,
    );
    const manual = computeRecipeNutritionPerPerson([{ quantity: 800, unit: "gram", unitMassGrams: null, nutrients }], 4);
    expect(fromImport).toEqual(manual);
    expect(fromImport.kcal).not.toBeNull();
  });

  it("a null unit becomes stuk + needs_review and the line is kept (never dropped)", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("a"), own("k"), own("o"), own("z")]);
    const { supabase } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd())) });
    const { ingredients } = contentsCall();
    const garlic = ingredients[1]!;
    expect(garlic).toMatchObject({ unit: "stuk", needsReview: true, ingredientId: "k" });
    expect(garlic.name).toContain("knoflook");
    expect(garlic.name).toContain("teentje");
    expect(ingredients[3]).toMatchObject({ name: "zout", unit: "stuk", needsReview: true });
    expect(ingredients.every((line) => line.unit)).toBe(true);
  });

  it("an unmatched line is saved with needs_review and no ingredient id", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([review(), review(), review(), review()]);
    const { supabase } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd())) });
    expect(contentsCall().ingredients[0]).toMatchObject({ ingredientId: null, needsReview: true, quantity: 800, unit: "gram" });
  });

  it("a reference match is adopted through resolveIngredientId", async () => {
    const reference: LineMatch = {
      ingredientId: null,
      chosen: { source: "reference", referenceId: "ref-1", name: "tomaat", score: 0.9 },
      needsReview: false,
      candidates: [],
    };
    vi.mocked(matchIngredients).mockResolvedValue([reference, review(), review(), review()]);
    const { supabase } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd())) });
    expect(contentsCall().ingredients[0]).toMatchObject({ ingredientId: "own-from-ref", needsReview: false });
  });

  it("always asks the LLM for step references when a key is configured, and saves them", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("a"), own("b"), own("c"), own("d")]);
    const provider: AiProvider = {
      generateObject: vi.fn(async () => ({ lines: [], stepRefs: [{ step: 0, ingredients: [0] }, { step: 1, ingredients: [2, 99] }] })) as AiProvider["generateObject"],
    };
    setProviderForTests(provider);
    const { supabase } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd())) });
    expect(provider.generateObject).toHaveBeenCalledTimes(1);
    expect(contentsCall().steps.map((s) => s.ingredientRefs)).toEqual([[0], [2]]);
  });

  it("without an API key the import still completes, with empty step references", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("a"), own("b"), own("c"), own("d")]);
    const { supabase, updates } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd())) });
    expect(contentsCall().steps.map((s) => s.ingredientRefs)).toEqual([[], []]);
    expect(updates.at(-1)).toMatchObject({ import_status: "done" });
  });

  it("a failing image fetch is skipped, the import still ends done", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("a"), own("b"), own("c"), own("d")]);
    const { supabase, updates } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd()), "fail") });
    expect(storeRecipeThumbnail).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({ import_status: "done" });
    expect(updates[0]).not.toHaveProperty("thumbnail_path");
  });

  it("an unsupported image type is not stored", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("a"), own("b"), own("c"), own("d")]);
    const { supabase } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd()), { contentType: "image/svg+xml" }) });
    expect(storeRecipeThumbnail).not.toHaveBeenCalled();
  });
});

describe("runRecipeImport: text page", () => {
  const textPage = page(null, "<article><h1>Pannenkoeken</h1><p>" + "Een lekker recept met meel en melk. ".repeat(20) + "</p></article>");

  it("extracts through the LLM, then parses and saves", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("meel")]);
    const provider: AiProvider = {
      generateObject: vi.fn(async (req: { purpose?: string }) =>
        req.purpose === "recipe_text_extract"
          ? { isRecipe: true, name: "Pannenkoeken", description: null, recipeIngredient: ["250 g bloem"], steps: ["Meng."], timeMinutes: 20, servings: 4 }
          : { lines: [], stepRefs: [{ step: 0, ingredients: [0] }] },
      ) as AiProvider["generateObject"],
    };
    setProviderForTests(provider);
    const { supabase, updates } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(textPage) });
    expect(contentsCall().ingredients[0]).toMatchObject({ name: "bloem", quantity: 250, unit: "gram", ingredientId: "meel" });
    expect(contentsCall().steps[0]).toMatchObject({ ingredientRefs: [0] });
    expect(updates[0]).toMatchObject({ title: "Pannenkoeken", time_minutes: 20, import_status: "done" });
  });

  it("no API key -> failed with ai_unavailable, nothing written", async () => {
    const { supabase, updates } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(textPage) });
    expect(replaceRecipeContents).not.toHaveBeenCalled();
    expect(updates).toEqual([{ import_status: "failed", import_error: "ai_unavailable" }]);
  });
});

describe("runRecipeImport: failures end failed + code in one update", () => {
  it("safe-fetch errors keep their code", async () => {
    const { supabase, updates } = fakeSupabase();
    const fetchPage = vi.fn(async () => {
      throw new SafeFetchError("blocked_address", "blocked");
    });
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetchPage });
    expect(updates).toEqual([{ import_status: "failed", import_error: "blocked_address" }]);
  });

  it("an empty page -> no_content", async () => {
    const { supabase, updates } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher("<html><body></body></html>") });
    expect(updates).toEqual([{ import_status: "failed", import_error: "no_content" }]);
  });

  it("a failed contents write -> import_failed", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("a"), own("b"), own("c"), own("d")]);
    vi.mocked(replaceRecipeContents).mockResolvedValue({ ok: false });
    const { supabase, updates } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd())) });
    expect(updates).toEqual([{ import_status: "failed", import_error: "import_failed" }]);
  });

  it("a database error while matching -> import_failed", async () => {
    vi.mocked(matchIngredients).mockRejectedValue(new Error("db"));
    const { supabase, updates } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd())) });
    expect(updates).toEqual([{ import_status: "failed", import_error: "import_failed" }]);
  });
});

describe("toImportErrorCode", () => {
  it("only ever returns a code from the one list", () => {
    const errors = [new SafeFetchError("timeout", "t"), new Error("x"), new AiError("not_configured", "n")];
    for (const error of errors) expect(IMPORT_ERROR_CODES).toContain(toImportErrorCode(error));
  });
});
