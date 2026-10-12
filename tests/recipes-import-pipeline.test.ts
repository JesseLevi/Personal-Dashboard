import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/recipes/contents", () => ({ replaceRecipeContents: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/recipes/thumbnails", () => ({
  storeRecipeThumbnail: vi.fn(async () => ({ success: true, data: { path: "u1/thumb" } })),
  discardRecipeThumbnail: vi.fn(async () => {}),
}));
vi.mock("@/lib/recipes/import/match-ingredients", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/recipes/import/match-ingredients")>()),
  matchIngredients: vi.fn(),
  resolveIngredientId: vi.fn(),
  widenMatches: vi.fn(),
}));
vi.mock("@/lib/recipes/import/unit-grams", () => ({ loadUnitGrams: vi.fn() }));

import { AiError, setProviderForTests, type AiProvider } from "@/lib/ai";
import { SafeFetchError, type SafeFetchResult } from "@/lib/net/safe-fetch";
import { replaceRecipeContents, type IngredientLine, type StepLine } from "@/lib/recipes/contents";
import { matchIngredients, resolveIngredientId, widenMatches, type LineMatch } from "@/lib/recipes/import/match-ingredients";
import { loadUnitGrams } from "@/lib/recipes/import/unit-grams";
import { runRecipeImport, toImportErrorCode } from "@/lib/recipes/import/pipeline";
import { discardRecipeThumbnail, storeRecipeThumbnail } from "@/lib/recipes/thumbnails";
import { IMPORT_ERROR_CODES } from "@/lib/recipes/enums";
import { computeRecipeNutritionPerPerson } from "@/lib/recipes/nutrition";
import type { UnitCode } from "@/lib/recipes/units";
import type { MatcherClient } from "@/lib/recipes/import/match-ingredients";

const URL_ = "https://example.com/recept";
const JOB = { userId: "u1", recipeId: "r1", url: URL_, locale: "nl" as const };

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
  const unitWeights: Array<{ rows: unknown; options: unknown }> = [];
  const supabase = {
    from: vi.fn(() => ({
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        const chain = { eq: () => chain, then: (resolve: (v: unknown) => void) => resolve({ error: null }) };
        return chain;
      },
      upsert: (rows: unknown, options: unknown) => {
        unitWeights.push({ rows, options });
        return Promise.resolve({ error: null });
      },
    })),
  } as unknown as MatcherClient;
  return { supabase, updates, unitWeights };
}

const review = (): LineMatch => ({ ingredientId: null, chosen: null, needsReview: true, candidates: [] });
const own = (id: string): LineMatch => ({
  ingredientId: id,
  chosen: { source: "own", id, name: "x", score: 1 },
  needsReview: false,
  candidates: [],
});

type Answers = { prepare?: unknown; link?: unknown; text?: unknown };

/** Fake provider answering per call purpose; an unset answer is an empty, valid one. */
function aiAnswers(answers: Answers) {
  const provider: AiProvider = {
    generateObject: vi.fn(async (req: { purpose?: string }) => {
      if (req.purpose === "recipe_text_extract") return answers.text;
      if (req.purpose === "recipe_prepare") return answers.prepare ?? { lines: [], translated: null };
      return answers.link ?? { lines: [], stepRefs: [] };
    }) as AiProvider["generateObject"],
  };
  setProviderForTests(provider);
  return provider;
}

function contentsCall() {
  const call = vi.mocked(replaceRecipeContents).mock.calls[0]!;
  return { ingredients: call[3] as IngredientLine[], steps: call[4] as StepLine[] };
}

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.mocked(replaceRecipeContents).mockClear();
  vi.mocked(replaceRecipeContents).mockResolvedValue({ ok: true });
  vi.mocked(storeRecipeThumbnail).mockClear();
  vi.mocked(discardRecipeThumbnail).mockClear();
  vi.mocked(matchIngredients).mockReset();
  vi.mocked(resolveIngredientId).mockReset();
  vi.mocked(resolveIngredientId).mockImplementation(async (_s, _u, chosen) =>
    chosen.source === "own" ? chosen.id : "own-from-ref",
  );
  vi.mocked(widenMatches).mockReset();
  vi.mocked(widenMatches).mockImplementation(async (_s, _u, matches) => matches);
  vi.mocked(loadUnitGrams).mockReset();
  vi.mocked(loadUnitGrams).mockResolvedValue(() => null);
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

  it("with a key: one prepare call and one link call, step references saved", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("a"), own("b"), own("c"), own("d")]);
    const provider = aiAnswers({ link: { lines: [], stepRefs: [{ step: 0, ingredients: [0] }, { step: 1, ingredients: [2, 99] }] } });
    const { supabase } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd())) });
    expect(provider.generateObject).toHaveBeenCalledTimes(2);
    expect(contentsCall().steps.map((s) => s.ingredientRefs)).toEqual([[0], [2]]);
  });

  it("searches unmatched lines again under the LLM's Dutch search terms", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("a"), review(), own("c"), own("d")]);
    aiAnswers({ prepare: { lines: [{ i: 1, reparsed: null, name: null, note: null, searchTerms: ["knoflook"] }], translated: null } });
    const { supabase } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd())) });
    const terms = vi.mocked(widenMatches).mock.calls[0]![3];
    expect(terms[1]).toEqual(["knoflook"]);
  });

  it("the link step's choice links an unmatched line (e.g. 'ui' -> NEVO 'Ui rauw')", async () => {
    const ui: LineMatch = {
      ingredientId: null,
      chosen: null,
      needsReview: true,
      candidates: [{ source: "reference", referenceId: "ref-ui-rauw", name: "Ui rauw", score: 0.38 }],
    };
    vi.mocked(matchIngredients).mockResolvedValue([ui]);
    aiAnswers({ link: { lines: [{ i: 0, choice: "c1", grams: null, amount: null }], stepRefs: [] } });
    const { supabase } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd({ recipeIngredient: ["200 g ui"] }))) });
    expect(contentsCall().ingredients[0]).toMatchObject({ name: "ui", quantity: 200, unit: "gram", ingredientId: "own-from-ref", needsReview: false });
  });
});

describe("runRecipeImport: the recipe keeps its amounts, the calculator gets a weight per unit", () => {
  const ld = (lines: string[]) => page(recipeLd({ recipeIngredient: lines }));

  it("'2 stuks selderij' stays as written and its estimated weight per piece is stored for the ingredient", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("selderij")]);
    aiAnswers({ link: { lines: [{ i: 0, choice: null, grams: 80 }], stepRefs: [] } });
    const { supabase, unitWeights } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(ld(["2 stuks selderij"])) });
    expect(contentsCall().ingredients[0]).toMatchObject({ name: "selderij", quantity: 2, unit: "stuk", ingredientId: "selderij", needsReview: false });
    expect(unitWeights).toEqual([
      {
        rows: [{ user_id: "u1", ingredient_id: "selderij", unit: "stuk", grams: 40 }],
        options: { onConflict: "user_id,ingredient_id,unit", ignoreDuplicates: true },
      },
    ]);
  });

  it("a weight NEVO (or the user) already has wins: nothing is stored", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("ui")]);
    vi.mocked(loadUnitGrams).mockResolvedValue((_id, unit) => (unit === "stuk" ? 100 : null));
    aiAnswers({ link: { lines: [{ i: 0, choice: null, grams: 150 }], stepRefs: [] } });
    const { supabase, unitWeights } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(ld(["1 ui"])) });
    expect(contentsCall().ingredients[0]).toMatchObject({ name: "ui", quantity: 1, unit: "stuk", needsReview: false });
    expect(unitWeights).toEqual([]);
  });

  it("an unmapped measure word has no unit to weigh, so that line is saved in grams", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("knoflook")]);
    aiAnswers({ link: { lines: [{ i: 0, choice: null, grams: 5 }], stepRefs: [] } });
    const { supabase, unitWeights } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(ld(["1 teentje knoflook"])) });
    expect(contentsCall().ingredients[0]).toMatchObject({ name: "knoflook (teentje)", quantity: 5, unit: "gram", needsReview: false });
    expect(unitWeights).toEqual([]);
  });

  it("a spoon without a known mass keeps '2 el' and stores the weight per spoon", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("olie"), own("pesto")]);
    vi.mocked(loadUnitGrams).mockResolvedValue((id, unit) => (id === "olie" && unit === "eetlepel" ? 13 : null));
    aiAnswers({ link: { lines: [{ i: 0, choice: null, grams: 14 }, { i: 1, choice: null, grams: 30 }], stepRefs: [] } });
    const { supabase, unitWeights } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(ld(["1 el olijfolie", "2 el pesto"])) });
    const [oil, pesto] = contentsCall().ingredients;
    expect(oil).toMatchObject({ name: "olijfolie", quantity: 1, unit: "eetlepel" });
    expect(pesto).toMatchObject({ name: "pesto", quantity: 2, unit: "eetlepel" });
    expect(unitWeights[0]!.rows).toEqual([{ user_id: "u1", ingredient_id: "pesto", unit: "eetlepel", grams: 15 }]);
  });

  it("the same ingredient and unit twice in one recipe is stored once", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("ui"), own("ui")]);
    aiAnswers({ link: { lines: [{ i: 0, choice: null, grams: 100 }, { i: 1, choice: null, grams: 220 }], stepRefs: [] } });
    const { supabase, unitWeights } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(ld(["1 ui", "2 uien"])) });
    expect(unitWeights[0]!.rows).toHaveLength(1);
  });

  it("an unlinked line keeps its amount, stays in review and stores nothing", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([review()]);
    aiAnswers({ link: { lines: [{ i: 0, choice: null, grams: 100 }], stepRefs: [] } });
    const { supabase, unitWeights } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(ld(["1 ui"])) });
    expect(contentsCall().ingredients[0]).toMatchObject({ name: "ui", quantity: 1, unit: "stuk", ingredientId: null, needsReview: true });
    expect(unitWeights).toEqual([]);
  });
});

describe("runRecipeImport: translation into the user's language", () => {
  const englishLd = recipeLd({
    name: "Onion soup",
    recipeIngredient: ["2 onions"],
    recipeInstructions: [{ "@type": "HowToStep", text: "Chop the onions." }, { "@type": "HowToStep", text: "Fry them." }],
  });

  it("saves the translated title, ingredient names and steps", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("ui")]);
    aiAnswers({
      prepare: {
        lines: [{ i: 0, reparsed: null, name: "uien", note: null, searchTerms: ["ui"] }],
        translated: { title: "Uiensoep", steps: ["Snipper de uien.", "Bak ze."] },
      },
    });
    const { supabase, updates } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(englishLd)) });
    expect(contentsCall().ingredients[0]).toMatchObject({ name: "uien", quantity: 2, unit: "stuk" });
    expect(contentsCall().steps.map((s) => s.instruction)).toEqual(["Snipper de uien.", "Bak ze."]);
    expect(updates[0]).toMatchObject({ title: "Uiensoep", import_status: "done" });
  });

  it("the translated name is also a search term", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([review()]);
    aiAnswers({ prepare: { lines: [{ i: 0, reparsed: null, name: "uien", note: null, searchTerms: ["ui"] }], translated: null } });
    const { supabase } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(englishLd)) });
    expect(vi.mocked(widenMatches).mock.calls[0]![3]).toEqual([["uien", "ui"]]);
  });

  it("without a key the recipe is saved in its own language", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("ui")]);
    const { supabase, updates } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(englishLd)) });
    expect(contentsCall().steps.map((s) => s.instruction)).toEqual(["Chop the onions.", "Fry them."]);
    expect(updates[0]).toMatchObject({ title: "Onion soup" });
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

  it("a stored thumbnail is discarded when the import fails afterwards (#446)", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("a"), own("b"), own("c"), own("d")]);
    vi.mocked(replaceRecipeContents).mockResolvedValue({ ok: false });
    const { supabase, updates } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(page(recipeLd())) });
    expect(discardRecipeThumbnail).toHaveBeenCalledWith("u1/thumb");
    expect(updates).toEqual([{ import_status: "failed", import_error: "import_failed" }]);
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
    aiAnswers({
      text: { isRecipe: true, name: "Pannenkoeken", description: null, recipeIngredient: ["250 g bloem"], steps: ["Meng."], timeMinutes: 20, servings: 4 },
      link: { lines: [], stepRefs: [{ step: 0, ingredients: [0] }] },
    });
    const { supabase, updates } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetcher(textPage) });
    expect(contentsCall().ingredients[0]).toMatchObject({ name: "bloem", quantity: 250, unit: "gram", ingredientId: "meel" });
    expect(contentsCall().steps[0]).toMatchObject({ ingredientRefs: [0] });
    expect(updates[0]).toMatchObject({ title: "Pannenkoeken", time_minutes: 20, import_status: "done" });
  });

  // #446: thumbnails went missing on this path. The page's og:image must end up as
  // thumbnail_path, and the download must not wait for the (slow) LLM steps.
  const ogTextPage = textPage.replace("<head>", '<head><meta property="og:image" content="https://example.com/og.jpg">');
  const textAnswers = {
    text: { isRecipe: true, name: "Pannenkoeken", description: null, recipeIngredient: ["250 g bloem"], steps: ["Meng."], timeMinutes: 20, servings: 4 },
  };

  it("saves the og:image as thumbnail_path (#446)", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("meel")]);
    aiAnswers(textAnswers);
    const { supabase, updates } = fakeSupabase();
    const fetchPage = fetcher(ogTextPage);
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetchPage });
    expect(fetchPage).toHaveBeenCalledWith("https://example.com/og.jpg", { allowImages: true });
    expect(storeRecipeThumbnail).toHaveBeenCalledWith("u1", expect.any(Uint8Array));
    expect(updates[0]).toMatchObject({ import_status: "done", thumbnail_path: "u1/thumb" });
  });

  it("starts the image download before the LLM steps (#446)", async () => {
    vi.mocked(matchIngredients).mockResolvedValue([own("meel")]);
    const order: string[] = [];
    const provider: AiProvider = {
      generateObject: vi.fn(async (req: { purpose?: string }) => {
        order.push(`ai:${req.purpose}`);
        if (req.purpose === "recipe_text_extract") return textAnswers.text;
        if (req.purpose === "recipe_prepare") return { lines: [], translated: null };
        return { lines: [], stepRefs: [] };
      }) as AiProvider["generateObject"],
    };
    setProviderForTests(provider);
    const inner = fetcher(ogTextPage);
    const fetchPage = vi.fn(async (url: string, opts?: { allowImages?: boolean }) => {
      if (opts?.allowImages) order.push("image");
      return inner(url, opts);
    });
    const { supabase } = fakeSupabase();
    await runRecipeImport({ supabase, ...JOB }, { safeFetch: fetchPage });
    expect(order.indexOf("image")).toBeGreaterThan(-1);
    expect(order.indexOf("image")).toBeLessThan(order.indexOf("ai:recipe_prepare"));
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
