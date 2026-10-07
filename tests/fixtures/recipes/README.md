# Recipe extraction fixtures (#314)

Trimmed excerpts of real recipe pages, used only as test fixtures for
`lib/recipes/import/extract.ts` (`tests/recipes-extract.test.ts`). Each file
keeps `<title>`, `og:*`/description meta, the JSON-LD scripts and an `<h1>`;
all other scripts, styles, SVG and body markup are removed. Recipe content
belongs to the respective sites. Fetched 2026-10-07.

| File | Source | Size |
| --- | --- | --- |
| `leukerecepten.html` | https://www.leukerecepten.nl/recepten/pannenkoeken/ | 11 KB |
| `24kitchen.html` | https://www.24kitchen.nl/recepten/pannenkoeken | 7.6 KB |
| `bbc-good-food.html` | https://www.bbcgoodfood.com/recipes/easy-pancakes | 5 KB |
| `jamie-oliver.html` | https://www.jamieoliver.com/recipes/chicken-recipes/chicken-tikka-masala/ | 5.8 KB |
| `recipetineats.html` (WPRM) | https://www.recipetineats.com/chicken-tikka-masala/ | 19.6 KB |
| `love-and-lemons.html` (WPRM) | https://www.loveandlemons.com/pancakes/ | 14 KB |
| `uit-paulines-keuken.html` | https://uitpaulineskeuken.nl/pannenkoeken/ | 5.9 KB |
| `article-no-jsonld.html` | handmade, no real source (Readability path) | 1.2 KB |

AH Allerhande (ah.nl) answered 403 to curl and Serious Eats answered 402, so
neither is included; Uit Paulines Keuken replaces AH as a second NL
blog-style site. Total about 70 KB.
