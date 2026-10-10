import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MATCH_MARGIN,
  MATCH_THRESHOLD,
  decideMatch,
  matchIngredients,
  mergeCandidates,
  normalizeIngredientName,
  resolveIngredientId,
  upsertAlias,
  widenMatches,
  type Candidate,
  type LineMatch,
  type MatcherClient,
} from "@/lib/recipes/import/match-ingredients";

// pg_trgm's similarity(), re-implemented to justify MATCH_THRESHOLD/MARGIN:
// lowercase, split on non-alphanumerics, pad each word with two leading and
// one trailing space, Jaccard over the trigram sets.
function trigrams(text: string): Set<string> {
  const set = new Set<string>();
  for (const word of text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) set.add(padded.slice(i, i + 3));
  }
  return set;
}
function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

describe("normalizeIngredientName", () => {
  it.each([
    ["Uien", "ui"],
    ["  Verse   Peterselie ", "peterselie"],
    ["Crème fraîche", "creme fraiche"],
    ["tomaten", "tomaat"],
    ["bananen", "banaan"],
    ["bonen", "boon"],
    ["noten", "noot"],
    ["walnoten", "walnoot"],
    ["peren", "peer"],
    ["kippen", "kip"],
    ["bessen", "bes"],
    ["kruiden", "kruid"],
    ["rozijnen", "rozijn"],
    ["aardbeien", "aardbei"],
    ["eieren", "ei"],
    ["olijven", "olijf"],
    ["champignons", "champignon"],
    ["wortels", "wortel"],
    ["paprika's", "paprika"],
    ["kiwi's", "kiwi"],
    ["fijngehakte knoflook", "knoflook"],
    ["Biologische grote tomaten", "tomaat"],
    ["kleine uien", "ui"],
    ["peterselie of koriander", "peterselie koriander"],
    ["tomaten, gesneden", "tomaat"],
    ["olijfolie (extra vierge)", "olijfolie"],
    ["extra virgin olive oil", "olive oil"],
    ["fresh basil", "basil"],
    ["chopped onions", "onion"],
    ["cherry tomatoes", "cherry tomato"],
    ["potatoes", "potato"],
    ["peaches", "peach"],
    ["radishes", "radish"],
    ["cherries", "cherry"],
    ["berries", "berry"],
    ["carrots", "carrot"],
    ["peas", "pea"],
    ["chickpeas", "chickpea"],
    ["cloves", "clove"],
    ["dates", "date"],
    ["rode-wijn azijn", "rode wijn azijn"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeIngredientName(input)).toBe(expected);
  });

  it.each(["kaas", "ananas", "bloem", "citroen", "groen", "hummus", "couscous", "asparagus", "radijs", "mais", "rijst", "boter", "ei", "olijfolie", "gember", "tahin", "cress", "grass"])(
    "leaves %s alone",
    (word) => {
      expect(normalizeIngredientName(word)).toBe(word);
    },
  );

  it("keeps the words when everything is a stopword", () => {
    expect(normalizeIngredientName("verse")).toBe("verse");
    expect(normalizeIngredientName("")).toBe("");
    expect(normalizeIngredientName("   ")).toBe("");
  });

  it("is idempotent on its own output for common names", () => {
    for (const name of ["ui", "tomaat", "olijfolie", "kaas", "banaan", "boon", "noot"]) {
      expect(normalizeIngredientName(normalizeIngredientName(name))).toBe(
        normalizeIngredientName(name),
      );
    }
  });
});

describe("threshold and margin constants (trigram scores)", () => {
  it("accepts a vowel-length slip and rejects stem-sharing different products", () => {
    expect(similarity("tomat", "tomaat")).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
    expect(similarity("tomaat", "tomaat")).toBe(1);
    expect(similarity("paprika", "paprikapoeder")).toBeLessThan(MATCH_THRESHOLD);
    expect(similarity("melk", "kokosmelk")).toBeLessThan(MATCH_THRESHOLD);
    expect(similarity("bloem", "volkorenbloem")).toBeLessThan(MATCH_THRESHOLD);
  });

  it("keeps the documented values", () => {
    expect(MATCH_THRESHOLD).toBe(0.55);
    expect(MATCH_MARGIN).toBe(0.1);
  });
});

const own = (id: string, score: number, name = id): Candidate => ({ source: "own", id, name, score });
const ref = (referenceId: string, score: number, name = referenceId): Candidate => ({
  source: "reference",
  referenceId,
  name,
  score,
});

describe("decideMatch", () => {
  it("links a lone candidate at or above the threshold", () => {
    expect(decideMatch([own("a", MATCH_THRESHOLD)])).toEqual(own("a", MATCH_THRESHOLD));
  });
  it("needs review below the threshold", () => {
    expect(decideMatch([own("a", MATCH_THRESHOLD - 0.01)])).toBeNull();
  });
  it("needs review without candidates", () => {
    expect(decideMatch([])).toBeNull();
  });
  it("links when the lead over the runner-up equals the margin", () => {
    expect(decideMatch([own("a", 0.8), ref("b", 0.8 - MATCH_MARGIN)])?.source).toBe("own");
  });
  it("needs review when the runner-up is too close", () => {
    expect(decideMatch([own("a", 0.8), ref("b", 0.8 - MATCH_MARGIN + 0.01)])).toBeNull();
  });
  it("links a reference candidate that clearly leads", () => {
    expect(decideMatch([ref("r", 0.9), own("a", 0.4)])).toEqual(ref("r", 0.9));
  });
  it("an exact own match beats an exact reference tie", () => {
    expect(decideMatch([own("a", 1), ref("r", 1)])).toEqual(own("a", 1));
  });
  it("an exact reference does not beat an exact own tie the other way round", () => {
    expect(decideMatch([ref("r", 1), own("a", 1)])).toBeNull();
  });
  it("two close own candidates need review even when exact", () => {
    expect(decideMatch([own("a", 1), own("b", 1)])).toBeNull();
  });
});

type Rows = { data: unknown; error: { code: string; message: string } | null };

function fakeClient(opts: { aliases?: Rows; shared?: Rows; rpc?: Rows; upsert?: Rows }) {
  const calls = { rpc: vi.fn(), upsert: vi.fn(), aliasIn: vi.fn(), sharedIn: vi.fn(), insert: vi.fn() };
  const client = {
    schema: (name: string) => {
      if (name !== "reference") throw new Error(`unexpected schema ${name}`);
      return {
        from: (table: string) => {
          if (table !== "ingredient_aliases") throw new Error(`unexpected reference table ${table}`);
          return {
            select: () => ({
              in: (...args: unknown[]) => {
                calls.sharedIn(...args);
                return Promise.resolve(opts.shared ?? { data: [], error: null });
              },
            }),
          };
        },
      };
    },
    from: (table: string) => {
      if (table === "ingredient_aliases") {
        return {
          select: () => ({
            eq: () => ({
              in: (...args: unknown[]) => {
                calls.aliasIn(...args);
                return Promise.resolve(opts.aliases ?? { data: [], error: null });
              },
            }),
          }),
          upsert: (...args: unknown[]) => {
            calls.upsert(...args);
            return Promise.resolve(opts.upsert ?? { data: null, error: null });
          },
        };
      }
      if (table === "ingredients") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
            }),
          }),
          insert: (...args: unknown[]) => {
            calls.insert(...args);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: "new-own-id" }, error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: (...args: unknown[]) => {
      calls.rpc(...args);
      return Promise.resolve(opts.rpc ?? { data: [], error: null });
    },
  };
  return { client: client as unknown as MatcherClient, calls };
}

const row = (input_index: number, source: "own" | "reference", id: string, name: string, score: number) => ({
  input_index,
  source,
  id,
  name,
  score,
});

describe("matchIngredients", () => {
  it("short-circuits on an alias hit without calling the RPC", async () => {
    const { client, calls } = fakeClient({
      aliases: { data: [{ alias_normalized: "bosui", ingredient_id: "ing-1" }], error: null },
    });
    const [result] = await matchIngredients(client, "user-1", ["Bosuien"]);
    expect(result).toMatchObject({ ingredientId: "ing-1", needsReview: false, candidates: [] });
    expect(calls.rpc).not.toHaveBeenCalled();
  });

  it("a shared alias links a reference candidate without trigram or review", async () => {
    const { client, calls } = fakeClient({
      shared: {
        data: [{ alias_normalized: "tomaat", ingredient_id: "ref-tomaat", ingredients: { name_nl: "Tomaat rauw" } }],
        error: null,
      },
    });
    const [result] = await matchIngredients(client, "user-1", ["tomaten"]);
    expect(result).toMatchObject({
      ingredientId: null,
      needsReview: false,
      chosen: { source: "reference", referenceId: "ref-tomaat", name: "Tomaat rauw" },
    });
    expect(calls.rpc).not.toHaveBeenCalled();
  });

  it("an own alias beats a shared alias and the shared lookup only gets the missed keys", async () => {
    const { client, calls } = fakeClient({
      aliases: { data: [{ alias_normalized: "tomaat", ingredient_id: "ing-own" }], error: null },
      shared: {
        data: [
          { alias_normalized: "tomaat", ingredient_id: "ref-tomaat", ingredients: { name_nl: "Tomaat rauw" } },
          { alias_normalized: "ui", ingredient_id: "ref-ui", ingredients: { name_nl: "Ui rauw" } },
        ],
        error: null,
      },
    });
    const [a, b] = await matchIngredients(client, "user-1", ["tomaten", "uien"]);
    expect(a).toMatchObject({ ingredientId: "ing-own", chosen: { source: "own" } });
    expect(b.chosen).toMatchObject({ source: "reference", referenceId: "ref-ui" });
    expect(calls.sharedIn).toHaveBeenCalledTimes(1);
    expect(calls.sharedIn).toHaveBeenCalledWith("alias_normalized", ["ui"]);
  });

  it("a shared alias beats a trigram candidate; only the rest goes to the RPC", async () => {
    const { client, calls } = fakeClient({
      shared: {
        data: [{ alias_normalized: "tomaat", ingredient_id: "ref-tomaat", ingredients: { name_nl: "Tomaat rauw" } }],
        error: null,
      },
      rpc: { data: [row(0, "reference", "ref-boter", "Boter", 1), row(0, "reference", "ref-other", "Tomaat saus", 1)], error: null },
    });
    const [a, b] = await matchIngredients(client, "user-1", ["tomaten", "boter"]);
    expect(a.chosen).toMatchObject({ referenceId: "ref-tomaat" });
    expect(calls.rpc).toHaveBeenCalledWith("match_ingredient_candidates", { p_names: ["boter"], p_limit: 5 });
    expect(b.needsReview).toBe(true); // two exact references tie in the fake RPC: margin rule, not the alias
  });

  it("throws on a shared alias lookup error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ shared: { data: null, error: { code: "42501", message: "nope" } } });
    await expect(matchIngredients(client, "user-1", ["boter"])).rejects.toThrow();
    spy.mockRestore();
  });

  it("only sends names without an alias to the RPC, keeping order", async () => {
    const { client, calls } = fakeClient({
      aliases: { data: [{ alias_normalized: "ui", ingredient_id: "ing-ui" }], error: null },
      rpc: { data: [row(0, "own", "ing-boter", "Boter", 1)], error: null },
    });
    const results = await matchIngredients(client, "user-1", ["uien", "boter"]);
    expect(calls.rpc).toHaveBeenCalledWith("match_ingredient_candidates", {
      p_names: ["boter"],
      p_limit: 5,
    });
    expect(results.map((r) => r.ingredientId)).toEqual(["ing-ui", "ing-boter"]);
  });

  it("links a clear own match and a clear reference match", async () => {
    const { client } = fakeClient({
      rpc: {
        data: [
          row(0, "own", "ing-1", "Boter", 1),
          row(0, "reference", "ref-1", "Boter, ongezouten", 0.5),
          row(1, "reference", "ref-2", "Halloumi", 1),
        ],
        error: null,
      },
    });
    const [a, b] = await matchIngredients(client, "user-1", ["boter", "halloumi"]);
    expect(a).toMatchObject({ ingredientId: "ing-1", needsReview: false });
    expect(a.candidates).toHaveLength(2);
    expect(b).toMatchObject({
      ingredientId: null,
      needsReview: false,
      chosen: { source: "reference", referenceId: "ref-2" },
    });
  });

  it("flags review and keeps candidates when the match is ambiguous or weak", async () => {
    const { client } = fakeClient({
      rpc: {
        data: [
          row(0, "own", "ing-1", "Rode ui", 0.7),
          row(0, "own", "ing-2", "Gele ui", 0.68),
          row(1, "reference", "ref-1", "Melk", 0.3),
        ],
        error: null,
      },
    });
    const [a, b, c] = await matchIngredients(client, "user-1", ["ui", "kokosmelk", "zout"]);
    expect(a).toMatchObject({ ingredientId: null, needsReview: true });
    expect(a.candidates).toHaveLength(2);
    expect(b).toMatchObject({ needsReview: true, chosen: null });
    expect(c).toMatchObject({ needsReview: true, candidates: [] });
  });

  it("returns review lines without any query for blank names", async () => {
    const { client, calls } = fakeClient({});
    const [result] = await matchIngredients(client, "user-1", ["  "]);
    expect(result.needsReview).toBe(true);
    expect(calls.aliasIn).not.toHaveBeenCalled();
    expect(calls.rpc).not.toHaveBeenCalled();
  });

  it("throws on database errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ rpc: { data: null, error: { code: "42501", message: "nope" } } });
    await expect(matchIngredients(client, "user-1", ["boter"])).rejects.toThrow();
    spy.mockRestore();
  });
});

describe("widenMatches", () => {
  const review = (candidates: Candidate[] = []): LineMatch => ({ ingredientId: null, chosen: null, needsReview: true, candidates });
  const settled: LineMatch = {
    ingredientId: "ing-zout",
    chosen: { source: "own", id: "ing-zout", name: "zout", score: 1 },
    needsReview: false,
    candidates: [],
  };

  it("NEVO's 'Ui rauw' scores below the auto-link threshold for 'ui', so the link step has to choose", () => {
    expect(similarity("ui", "ui rauw")).toBeLessThan(MATCH_THRESHOLD);
  });

  it("looks up only lines in review, with the wider candidate limit, in one round trip", async () => {
    const { client, calls } = fakeClient({ rpc: { data: [], error: null } });
    await widenMatches(client, "user-1", [settled, review()], [["zout"], ["ui", "ui rode"]]);
    expect(calls.rpc).toHaveBeenCalledTimes(1);
    expect(calls.rpc).toHaveBeenCalledWith("match_ingredient_candidates", { p_names: ["ui", "ui rode"], p_limit: 8 });
  });

  it("merges every term's candidates (best score per ingredient) into the line's list", async () => {
    const { client } = fakeClient({
      rpc: {
        data: [
          row(0, "reference", "ref-ui-rauw", "Ui rauw", 0.38),
          row(0, "reference", "ref-ui-gekookt", "Ui gekookt", 0.3),
          row(1, "reference", "ref-ui-rauw", "Ui rauw", 0.45),
        ],
        error: null,
      },
    });
    const first: Candidate = { source: "reference", referenceId: "ref-uitjes", name: "Uitjes gebakken", score: 0.25 };
    const [line] = await widenMatches(client, "user-1", [review([first])], [["ui", "uien"]]);
    expect(line!.needsReview).toBe(true);
    expect(line!.candidates.map((c) => (c.source === "reference" ? c.referenceId : c.id))).toEqual([
      "ref-ui-rauw",
      "ref-ui-gekookt",
      "ref-uitjes",
    ]);
    expect(line!.candidates[0]!.score).toBe(0.45);
  });

  it("a term that settles (alias) links the line outright", async () => {
    const { client, calls } = fakeClient({
      aliases: { data: [{ alias_normalized: "ui", ingredient_id: "ing-ui" }], error: null },
    });
    const [line] = await widenMatches(client, "user-1", [review()], [["ui"]]);
    expect(line).toMatchObject({ ingredientId: "ing-ui", needsReview: false });
    expect(calls.rpc).not.toHaveBeenCalled();
  });

  it("no terms: no query, matches unchanged", async () => {
    const { client, calls } = fakeClient({});
    const matches = [review()];
    expect(await widenMatches(client, "user-1", matches, [[]])).toBe(matches);
    expect(calls.aliasIn).not.toHaveBeenCalled();
  });
});

describe("mergeCandidates", () => {
  it("dedupes own and reference rows by id, keeps the best score, caps the list", () => {
    const a: Candidate = { source: "own", id: "x", name: "X", score: 0.4 };
    const b: Candidate = { source: "reference", referenceId: "x", name: "X ref", score: 0.5 };
    const merged = mergeCandidates([[a], [{ ...a, score: 0.6 }, b]], 2);
    expect(merged).toEqual([{ ...a, score: 0.6 }, b]);
    expect(mergeCandidates([[a, b]], 1)).toEqual([b]);
  });
});

describe("resolveIngredientId", () => {
  it("returns an own id as-is", async () => {
    const { client, calls } = fakeClient({});
    expect(await resolveIngredientId(client, "user-1", own("ing-1", 1))).toBe("ing-1");
    expect(calls.insert).not.toHaveBeenCalled();
  });
  it("adopts a reference ingredient through the manual path", async () => {
    const { client, calls } = fakeClient({});
    expect(await resolveIngredientId(client, "user-1", ref("ref-1", 1, "Halloumi"))).toBe("new-own-id");
    expect(calls.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      reference_id: "ref-1",
      name: "Halloumi",
    });
  });
});

describe("upsertAlias", () => {
  it("upserts the normalized name on (user_id, alias_normalized)", async () => {
    const { client, calls } = fakeClient({});
    expect(await upsertAlias(client, "user-1", "Verse Bosuien", "ing-1")).toBe(true);
    expect(calls.upsert).toHaveBeenCalledWith(
      { user_id: "user-1", alias_normalized: "bosui", ingredient_id: "ing-1" },
      { onConflict: "user_id,alias_normalized" },
    );
  });
  it("refuses an empty name without querying", async () => {
    const { client, calls } = fakeClient({});
    expect(await upsertAlias(client, "user-1", "  ", "ing-1")).toBe(false);
    expect(calls.upsert).not.toHaveBeenCalled();
  });
  it("returns false on a database error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ upsert: { data: null, error: { code: "42501", message: "rls" } } });
    expect(await upsertAlias(client, "user-1", "ui", "ing-1")).toBe(false);
    spy.mockRestore();
  });
});
