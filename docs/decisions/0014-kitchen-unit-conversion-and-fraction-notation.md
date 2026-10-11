# ADR-0014: Kitchen unit conversion (volume ↔ mass) and fraction notation

**Status**: Accepted (user decisions, 2026-08-07)

**Amends**: ADR-0011 §3 (which barred volume↔mass conversion outright) and ADR-0013's #163 amendment (which deferred all volume units to "Layer 2"). Closes `docs/open-questions.md#fraction-notation-vs-decimal-formatter`.


## Context

The user's stated goal is cooking convenience, not nutrition completeness: *"1 cup rijst in plaats van een weegschaal voor 190 gram"*. That is the **inverse** of what #164 was written to solve. #164 asks how a recipe entered in `cup`/`ml` can yield macronutrients (volume → grams); the user asks how a recipe entered in grams can be cooked with measuring cups (grams → volume). Both need the same one number per ingredient, but only the second changes what the product feels like, and only the second explains why the shipped "Amerikaans" toggle felt broken: it converted 190 g of rice to `6.7 ounce`, which is arithmetically correct and useless in a kitchen.

### What was measured before deciding

#164 proposed two data sources. Both were tested against the real files, and both failed.

**Source 2 — paired gram/ml rows in NEVO Portie-online — yields nothing.** Across all 11 547 rows of the 26 CSVs, 88 of 2108 NEVO codes carry both a `gram` row and an `ml` row, but **zero** carry both for the same `Maat`. NEVO gives exactly one unit per (product, measure), so no density is derivable. Only 6 rows (3 products) state a density outright in `Maat-Toelichting`. The ticket's premise — *"the same food often has both a gram row and an ml row, which yields a true density"* — is false; #164 carries a comment recording this so it is not retried.

**Source 1 — deriving density from #163's eetlepel masses (grams ÷ 15) — is not honest.** 181 of 700 (26%) land outside a plausible 0.2–1.6 g/ml: cocoa powder implies 0.13, mashed potato 3.20. The latter would render "1 cup aardappelpuree = 768 g". A spoon of a heaped paste is not a volume measure, and no automatic criterion separates the sound 70% from the broken 30%.

**A third option, broad automated NEVO → USDA name matching, was measured and also failed.** Two attempts, each audited by hand on 25 random matches:

| Attempt | Universe | Kept | Precision |
| --- | --- | --- | --- |
| Head-noun matching | 2328 | 1189 | 20% (5/25) |
| Strict scorer + category restriction | 531 | 47 | 56% (14/25) |

Even after honestly restricting the universe to the 531 rows in categories that are cup-measurable at all, fewer than 1 in 10 rows matched and over half of those were wrong (buttermilk powder → whole-milk powder, dried peas → fresh peas). A silently wrong cup weight is worse in a kitchen than no conversion, so the fallback the user pre-authorised — a hand-curated core selection — is what shipped.

## Decision

### 1. Density is stored as a `milliliter` row, not a new column

#164 proposed a `density_g_per_ml` column on `reference.ingredients`. Rejected: **no schema change is needed at all.**

`reference.ingredient_unit_masses (ingredient_id, unit, grams)` already stores grams per one unit. A `milliliter` row with `grams = 1.03` *is* that ingredient's density. When the resolver converts a volume unit to millilitres first (exactly, via `units.ts`'s existing factors) and then applies that single row, `deciliter`/`liter`/`cup`/`fluid_ounce` all follow arithmetically. That achieves #164's own stated goal — *"one bridge, not 9 units × 2328 ingredients"* — while storing the number once and touching no schema.

ADR-0011 §3's separation survives intact, and this is the load-bearing point: `units.ts` stays ingredient-blind and still converts only within a magnitude; the table still only stores per-(ingredient, unit) facts; the two are composed one layer up, in `lib/recipes/mass-resolution.ts`. The mechanisms are joined at a call site, not merged into each other.

### 2. Solids and liquids are seeded differently, on purpose

- **Solids** get `cup`/`tablespoon`/`teaspoon` rows and **no `milliliter` row**. The packing density of rice is not a density. The deliberate consequence is that "1 liter rijst" stays unresolved and renders `?` — correct, because it is not a measurement anyone performs.
- **Liquids** get a `milliliter` row only. `cup` follows from it correctly, because a cup of milk really is 240 ml × 1.03.

An explicit row always outranks a bridged one, so a unit can never resolve two ways.

### 3. Resolution precedence

1. user override for the exact unit
2. reference row for the exact unit
3. user override via bridge
4. reference row via bridge
5. unresolved

Exactness outranks source: a measurement of the actual unit always beats one derived through a conversion. "Unresolved" remains first-class and visible (ADR-0011 §3) — never a silent zero, never a guess.

### 4. The spoon bridge is permitted; a cup bridge is not

An `eetlepel` row resolves `tablespoon` (× 14.79/15) and `theelepel` resolves `teaspoon` (× 4.93/5), bidirectionally. This is an exact volume conversion between two near-identical spoons applied to a measured value — not an inferred density — and it unlocks the 700 eetlepel and 160 theelepel rows #163 already seeded.

The same move to `cup` is forbidden: that is a 16× extrapolation across a semantic boundary, which is exactly the failure mode §Context measured at 26%. The spoon bridge is kept structurally separate in the code so it can be removed without touching the ml bridge.

### 5. Mixing NEVO nutrition with USDA unit masses on one ingredient is allowed

ADR-0011 §5 forbids mixing sources *within one ingredient's nutrient set*, because composition tables use different protein conversion factors and cherry-picking yields energies that do not add up. A unit mass is a different fact, and `ingredient_unit_masses` carries its own `source`/`source_version`/`source_ref` columns precisely so it can be attributed independently. Every seeded row records the USDA `fdc_id` it came from.

### 6. Fraction notation: ladder, tolerance, and where it applies

Resolves #157's four open questions:

- **Ladder**: eighths, quarters, thirds, halves — `1/8, 1/4, 1/3, 3/8, 1/2, 5/8, 2/3, 3/4, 7/8` — plus whole and mixed numbers (`1 1/2`). ASCII slash, matching what Figma draws. No Unicode glyphs, no `~` approximation marker.
- **Magnitude**: volume and count units only. Mass stays decimal — "3/8 gram" is nonsense.
- **Out of tolerance**: fall back to decimal (`0.45` stays `0.45`). Never an approximated fraction.
- **Scope**: display only — detail page ingredient cards and per-step Tags. The input form keeps decimals; a form field must round-trip a number.

**The tolerance is relative (5%), not absolute, and that is the substantive decision here.** It mirrors the precision of the instrument the number is about to be measured with: a cup scooped from a bag is not accurate to better than a few percent, so an absolute window makes the output worse rather than more honest. An absolute 0.02 window was implemented first and produced exactly the wrong readings for the case this feature exists to serve — 190 g of rice rendered as `1.03 cup` and 500 g as `2.7 cup`, where a cook needs `1 cup` and `2 2/3 cup`. Scaled quantities are unaffected: 5% of 0.33 is 0.0165, far too tight to let 0.33 drift off `1/3`, and `0.45` still stays decimal because `1/2` is 11% away.

Snapping picks the **nearest** candidate rather than the first one inside the window, so a value like 10.45 renders `10 1/2` instead of dropping half a cup to the whole number that also qualifies.

### 7. Small amounts step down to the spoon

Under "Amerikaans", a result under 1/4 cup becomes tablespoons, and under 1 tablespoon becomes teaspoons — including on the pure volume→volume path, which needs no ingredient data. "2 eetlepel" reads `2 tbs`, not `1/8 cup`. Under "Metrisch", `milliliter`/`deciliter`/`liter` are left alone: they are already good metric kitchen units, and rewriting "375 ml" as "386 gram" would be a regression.

## Consequences

- **`reference.ingredient_unit_masses` now carries three sources**: NEVO Portie-online (#163), USDA FNDDS, and USDA SR Legacy. Attribution is per row.
- **Coverage is deliberately partial and will stay that way.** 40 solid staples and 26 liquids, hand-verified. Extending it means curating more rows by hand — the automated path is measured and closed (§Context). Everything else renders `?`.
- **Two curation defects were caught in review and are recorded as anti-regressions**: canned chickpeas were first seeded from USDA's "solids and liquids" row (240 g/cup, i.e. including brine) instead of the drained figure (152 g/cup), a 58% overstatement; canned black beans had no drained row at all and were dropped rather than approximated. The script carries a comment forbidding their reinstatement.
- **`Vision.md`'s "voedingswaarde-informatie buiten scope" moves further**, as ADR-0013 already began: unit conversion is now a user-facing kitchen feature, not just a schema capability.
- **The 5% tolerance is a product decision that will be visible.** If a user reports a conversion reading "1 cup" for something they measured at 1.03 cups, that is this ADR working as intended, not a bug.
- **Phase 5 (Boodschappenlijst) inherits the bridge for free** — "send to list" can now resolve a cup or a millilitre quantity to grams wherever these rows exist.
