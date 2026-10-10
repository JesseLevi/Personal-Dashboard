import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { setProviderForTests, type AiProvider } from "@/lib/ai";
import { linkIngredients, prepareRecipe } from "@/lib/recipes/import/ai-fill";
import { matchIngredients, type MatcherClient } from "@/lib/recipes/import/match-ingredients";
import { parseIngredientLine, type ParsedIngredient } from "@/lib/recipes/import/parse-ingredient";

// ADR-0020 §3, end to end over the real matcher and the real prompt builders:
// a line settled by a (shared) alias gets no search terms and no choice, and
// the number of aliases in the table never reaches a prompt.

function clientWithSharedAliases(extra: number): MatcherClient {
  const table = [
    { alias_normalized: "tomaat", ingredient_id: "ref-tomaat", ingredients: { name_nl: "Tomaat rauw" } },
    ...Array.from({ length: extra }, (_, n) => ({
      alias_normalized: `alias-${n}`,
      ingredient_id: `ref-${n}`,
      ingredients: { name_nl: `Naam ${n}` },
    })),
  ];
  return {
    schema: () => ({
      from: () => ({
        select: () => ({
          in: (_column: string, keys: string[]) =>
            Promise.resolve({ data: table.filter((row) => keys.includes(row.alias_normalized)), error: null }),
        }),
      }),
    }),
    from: () => ({ select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }) }),
    rpc: () => Promise.resolve({ data: [], error: null }),
  } as unknown as MatcherClient;
}

const line = (raw: string): ParsedIngredient => {
  const parsed = parseIngredientLine(raw);
  if (parsed.kind !== "ingredient") throw new Error("fixture must be an ingredient line");
  return parsed;
};

const RECIPE = { name: "Soep", steps: ["Snijd de tomaten.", "Bak de ui."] };

function recordingProvider() {
  const prompts: Array<{ purpose: string; prompt: string }> = [];
  setProviderForTests({
    generateObject: vi.fn(async (req: { purpose: string; prompt: string }) => {
      prompts.push({ purpose: req.purpose, prompt: req.prompt });
      return req.purpose === "recipe_prepare" ? { lines: [], translated: null } : { lines: [], stepRefs: [] };
    }) as AiProvider["generateObject"],
  });
  return prompts;
}

const payloadOf = (prompt: string) =>
  JSON.parse(prompt.replace("<untrusted_page_data>\n", "").replace("\n</untrusted_page_data>", ""));

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
});
afterEach(() => {
  setProviderForTests(undefined);
  vi.unstubAllEnvs();
});

describe("shared alias before trigram and LLM", () => {
  it("'tomaten' with a shared alias links without an LLM choice or search terms", async () => {
    const prompts = recordingProvider();
    const lines = [line("400 g tomaten"), line("1 ui")];
    const matches = await matchIngredients(clientWithSharedAliases(0), "user-1", lines.map((l) => l.name));
    expect(matches[0]).toMatchObject({ needsReview: false, chosen: { source: "reference", referenceId: "ref-tomaat" } });
    expect(matches[1]!.needsReview).toBe(true);

    await prepareRecipe(lines, RECIPE, "nl", matches.map((m) => m.needsReview));
    const prepare = payloadOf(prompts.find((p) => p.purpose === "recipe_prepare")!.prompt);
    expect(prepare.ingredients).toHaveLength(2); // translation still sees every line
    expect(prepare.ingredients.map((l: { wantsSearchTerms: boolean }) => l.wantsSearchTerms)).toEqual([false, true]);

    await linkIngredients(lines.map((parsed, i) => ({ parsed, match: matches[i]! })), RECIPE.steps);
    const link = payloadOf(prompts.find((p) => p.purpose !== "recipe_prepare")!.prompt);
    expect(JSON.stringify(link.ingredients)).not.toContain("candidates"); // no line is offered a choice
  });

  it("prompt payloads are identical with 0 and 500 aliases in the table", async () => {
    const run = async (extra: number) => {
      const prompts = recordingProvider();
      const lines = [line("400 g tomaten"), line("1 ui")];
      const matches = await matchIngredients(clientWithSharedAliases(extra), "user-1", lines.map((l) => l.name));
      await prepareRecipe(lines, RECIPE, "nl", matches.map((m) => m.needsReview));
      await linkIngredients(lines.map((parsed, i) => ({ parsed, match: matches[i]! })), RECIPE.steps);
      return prompts.map((p) => p.prompt);
    };
    expect(await run(500)).toEqual(await run(0));
  });
});
