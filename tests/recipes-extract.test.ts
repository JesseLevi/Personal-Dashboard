import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// "server-only" throws outside a react-server context, including Vitest.
vi.mock("server-only", () => ({}));

import {
  ExtractError,
  MAX_TEXT_CHARS,
  extractRecipe,
  parseIsoDuration,
  parseServings,
  type ExtractedRecipe,
} from "@/lib/recipes/import/extract";
import { parseIngredientLine } from "@/lib/recipes/import/parse-ingredient";

// #314 -- trimmed real pages in tests/fixtures/recipes (see its README).
const FIXTURES = path.join(__dirname, "fixtures", "recipes");
const load = (name: string) => fs.readFileSync(path.join(FIXTURES, `${name}.html`), "utf8");

function recipeOf(html: string, baseUrl?: string): ExtractedRecipe {
  const r = extractRecipe(html, baseUrl);
  if (r.kind !== "recipe") throw new Error("expected kind recipe");
  return r.recipe;
}

// "<" escaped like real sites do, so a "</script>" inside a value cannot end the block.
const ld = (obj: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script></head><body></body></html>`;

describe("fixtures (JSON-LD path)", () => {
  // [file, name, ingredients, steps, timeMinutes, servings, image]
  const rows: [string, string, number, number, number, number, string][] = [
    ["leukerecepten", "Pannenkoeken: het beste basis recept", 5, 4, 30, 8,
      "https://www.leukerecepten.nl/app/uploads/2021/08/pannenkoeken-recept-1.jpg"],
    ["24kitchen", "Pannenkoeken", 4, 6, 15, 4,
      "https://www.24kitchen.nl/files/styles/social_media_share/public/2020-04/shutterstock_558677326_0.jpg.webp?itok=mV9LyNzH"],
    ["bbc-good-food", "Easy pancakes", 6, 5, 30, 12,
      "https://images.immediate.co.uk/production/volatile/sites/30/2020/08/recipe-image-legacy-id-1273477_8-ad36e3b.jpg?resize=440,400"],
    ["jamie-oliver", "Chicken tikka masala", 25, 10, 90, 4,
      "https://asset.jamieoliver.com/images/cq7w2e71/production/7ac1a2406a986bcea99e8cc0bdb2fa72a29ac0e2-1387x2081.jpg/chickentikkareshot.webp?rect=0,348,1387,1387&w=1200&h=1200&fm=webp&q=75&fit=crop&auto=format"],
    ["recipetineats", "Chicken Tikka Masala", 30, 16, 60, 4,
      "https://www.recipetineats.com/tachyon/2018/04/Chicken-Tikka-Masala_0-SQ.jpg"],
    ["love-and-lemons", "Fluffy Homemade Pancakes", 8, 5, 20, 4,
      "https://cdn.loveandlemons.com/wp-content/uploads/2025/01/pancake-recipe-500x500.jpg"],
    ["uit-paulines-keuken", "Pannenkoeken traybake", 8, 4, 25, 4,
      "https://uitpaulineskeuken.nl/wp-content/uploads/2026/04/Sheetpan-pancake-2-2.jpg"],
  ];

  it.each(rows)("%s", (file, name, ingredients, steps, timeMinutes, servings, image) => {
    const r = recipeOf(load(file));
    expect(r.name).toBe(name);
    expect(r.recipeIngredient).toHaveLength(ingredients);
    expect(r.steps).toHaveLength(steps);
    expect(r.timeMinutes).toBe(timeMinutes);
    expect(r.servings).toBe(servings);
    expect(r.image).toBe(image);
    // plain text only
    for (const s of [r.name, r.description ?? "", ...r.recipeIngredient, ...r.steps]) {
      expect(s).not.toMatch(/<\/?[a-z][^>]*>/i);
      expect(s).not.toMatch(/&(?:amp|lt|gt|quot|nbsp|#\d+);/);
      expect(s).toBe(s.trim());
    }
  });

  it("runs through parseIngredientLine without throwing (informative only)", () => {
    const lines = recipeOf(load("leukerecepten")).recipeIngredient.map(parseIngredientLine);
    expect(lines.length).toBeGreaterThan(0);
    const high = lines.filter((l) => l.kind === "ingredient" && l.confidence === "high").length;
    console.info(`leukerecepten: ${high}/${lines.length} ingredient lines parsed with high confidence`);
  });
});

describe("fixture without Recipe JSON-LD (Readability path)", () => {
  it("returns kind text with title, image and main text, without page chrome", () => {
    const r = extractRecipe(load("article-no-jsonld"));
    if (r.kind !== "text") throw new Error("expected kind text");
    expect(r.title).toBe("Oma's appelmoes");
    expect(r.image).toBe("https://example.com/images/appelmoes.jpg");
    expect(r.text).toContain("1 kg goudreinetten");
    expect(r.text).toContain("Schil de appels");
    expect(r.text).not.toContain("Testpagina");
    expect(r.text).not.toMatch(/<[a-z]|&[a-z]+;/i);
  });

  it("caps the text at MAX_TEXT_CHARS", () => {
    const para = "<p>" + "Roer het beslag glad en laat het rusten. ".repeat(20) + "</p>";
    const html = `<html><head><title>Lang</title></head><body><article>${para.repeat(60)}</article></body></html>`;
    const r = extractRecipe(html);
    if (r.kind !== "text") throw new Error("expected kind text");
    expect(r.text.length).toBeLessThanOrEqual(MAX_TEXT_CHARS);
    expect(r.text.length).toBeGreaterThan(MAX_TEXT_CHARS - 100);
  });

  it("falls back to text when the Recipe has neither ingredients nor steps", () => {
    const html = `<html><head><title>Leeg</title><script type="application/ld+json">{"@type":"Recipe","name":"Leeg"}</script></head><body><article><p>${"Gewoon wat tekst over koken. ".repeat(30)}</p></article></body></html>`;
    expect(extractRecipe(html).kind).toBe("text");
  });

  it("throws no_content for a page without any text", () => {
    expect(() => extractRecipe("<html><head></head><body></body></html>")).toThrow(ExtractError);
  });
});

describe("parseIsoDuration", () => {
  it.each([
    ["PT1H30M", 90],
    ["P0DT45M", 45],
    ["PT90M", 90],
    ["PT2H", 120],
    ["P1DT2H", 1560],
    ["PT30S", 1],
    ["pt20m", 20],
    ["PT0M", null],
    ["P1M", null],
    ["PT", null],
    ["P", null],
    ["45 minuten", null],
    ["", null],
  ])("%s -> %s", (input, expected) => {
    expect(parseIsoDuration(input)).toBe(expected);
  });
  it("non-strings give null", () => {
    expect(parseIsoDuration(45)).toBeNull();
    expect(parseIsoDuration(undefined)).toBeNull();
  });
});

describe("parseServings", () => {
  it.each([
    [4, 4],
    ["4", 4],
    ["4 personen", 4],
    ["Makes 12", 12],
    ["4-6 servings", 4],
    ["2,0 porties", 2],
    [["4", "4 servings"], 4],
    [["serves a crowd", "6 servings"], 6],
    [0, null],
    ["enkele personen", null],
    [[], null],
    [{ value: 4 }, null],
    [null, null],
  ])("%j -> %s", (input, expected) => {
    expect(parseServings(input)).toBe(expected);
  });
});

describe("JSON-LD shapes", () => {
  const base = { "@type": "Recipe", name: "Test", recipeIngredient: ["1 ei"] };

  it("totalTime wins; else prepTime + cookTime", () => {
    expect(recipeOf(ld({ ...base, totalTime: "PT1H", prepTime: "PT5M", cookTime: "PT5M" })).timeMinutes).toBe(60);
    expect(recipeOf(ld({ ...base, prepTime: "PT10M", cookTime: "PT20M" })).timeMinutes).toBe(30);
    expect(recipeOf(ld({ ...base, cookTime: "PT20M" })).timeMinutes).toBe(20);
    expect(recipeOf(ld(base)).timeMinutes).toBeNull();
  });

  it("finds the Recipe inside @graph", () => {
    const r = recipeOf(ld({ "@context": "https://schema.org", "@graph": [{ "@type": "WebSite" }, base] }));
    expect(r.name).toBe("Test");
  });

  it("finds the Recipe in a top-level array", () => {
    expect(recipeOf(ld([{ "@type": "Organization" }, base])).name).toBe("Test");
  });

  it("accepts @type as an array", () => {
    expect(recipeOf(ld({ ...base, "@type": ["Thing", "Recipe"] })).name).toBe("Test");
  });

  it("tolerates invalid JSON-LD blocks and still uses a valid one", () => {
    const html = `<html><head>
      <script type="application/ld+json">{ not json,, }</script>
      <script type="application/ld+json"></script>
      <script type="application/ld+json">${JSON.stringify(base)}</script></head><body></body></html>`;
    expect(recipeOf(html).name).toBe("Test");
  });

  it("flattens nested HowToSection, HowToStep and plain strings", () => {
    const r = recipeOf(
      ld({
        ...base,
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "Beslag",
            itemListElement: [
              { "@type": "HowToStep", text: "Meng de bloem." },
              { "@type": "HowToStep", name: "Klop de eieren." },
            ],
          },
          { "@type": "HowToSection", name: "Bakken", itemListElement: { "@type": "HowToStep", text: "Bak gaar." } },
          "Serveer warm.",
        ],
      }),
    );
    expect(r.steps).toEqual(["Meng de bloem.", "Klop de eieren.", "Bak gaar.", "Serveer warm."]);
  });

  it("splits a plain-text instruction string on newlines and drops empties", () => {
    const r = recipeOf(ld({ ...base, recipeInstructions: "Stap een.\n\n  Stap twee.  \r\n\nStap drie." }));
    expect(r.steps).toEqual(["Stap een.", "Stap twee.", "Stap drie."]);
  });

  it("splits HTML list instructions into steps", () => {
    const r = recipeOf(ld({ ...base, recipeInstructions: "<ol><li>Eerst.</li><li>Dan.</li></ol>" }));
    expect(r.steps).toEqual(["Eerst.", "Dan."]);
  });

  it("strips tags, decodes entities, collapses whitespace, drops empty items", () => {
    const r = recipeOf(
      ld({
        "@type": "Recipe",
        name: "Mac &amp; Cheese&nbsp;<b>deluxe</b>",
        description: "<p>Zout  &amp;\n peper &#8211; &quot;lekker&quot; &lt;3</p>",
        recipeIngredient: ["  2 el  <strong>boter</strong> ", "", "   ", "Salt &amp; pepper"],
        recipeInstructions: [{ "@type": "HowToStep", text: "<p>Kook &amp; giet af.</p>" }, " ", ""],
      }),
    );
    expect(r.name).toBe("Mac & Cheese deluxe");
    expect(r.description).toBe('Zout & peper – "lekker" <3');
    expect(r.recipeIngredient).toEqual(["2 el boter", "Salt & pepper"]);
    expect(r.steps).toEqual(["Kook & giet af."]);
  });

  it("decodes double-encoded entities and never keeps script content", () => {
    const r = recipeOf(
      ld({ ...base, name: "Fish &amp;amp; Chips", description: "ok<script>alert(1)</script>" }),
    );
    expect(r.name).toBe("Fish & Chips");
    expect(r.description).toBe("ok");
  });

  it.each([
    ["string", "https://x.test/a.jpg"],
    ["ImageObject", { "@type": "ImageObject", url: "https://x.test/a.jpg" }],
    ["array of strings", ["https://x.test/a.jpg", "https://x.test/b.jpg"]],
    ["array of ImageObject", [{ "@type": "ImageObject", url: "https://x.test/a.jpg" }]],
  ])("image as %s", (_label, image) => {
    expect(recipeOf(ld({ ...base, image })).image).toBe("https://x.test/a.jpg");
  });

  it("falls back to og:image when the Recipe has no usable image", () => {
    const html = `<html><head><meta property="og:image" content="https://x.test/og.jpg">
      <script type="application/ld+json">${JSON.stringify({ ...base, image: { "@id": "#img" } })}</script></head><body></body></html>`;
    expect(recipeOf(html).image).toBe("https://x.test/og.jpg");
  });

  it("resolves relative image URLs against baseUrl and rejects non-http schemes", () => {
    expect(recipeOf(ld({ ...base, image: "/img/a.jpg" }), "https://x.test/recept/1").image).toBe("https://x.test/img/a.jpg");
    expect(recipeOf(ld({ ...base, image: "javascript:alert(1)" })).image).toBeNull();
  });

  it("uses the page title when the Recipe has no name", () => {
    const html = `<html><head><title>Titel</title><script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", recipeIngredient: ["1 ei"] })}</script></head><body></body></html>`;
    expect(recipeOf(html).name).toBe("Titel");
  });
});
