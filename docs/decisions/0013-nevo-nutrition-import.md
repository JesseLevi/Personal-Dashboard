# ADR-0013: NEVO-online as the nutrition source, amending ADR-0011 §5

**Status**: Accepted (user decision, 2026-08-06)

**Amends**: ADR-0011 §5, which barred NEVO from this repository outright. That prohibition is lifted. Everything else in ADR-0011 — the `reference` schema's rules (§1), the two-layer ingredient library (§2), user-first mass resolution (§3), `NULL` never meaning `0` (§4), and the extended RLS coverage gate (§6) — stands unchanged.

**Authored by**: Claude Code, at the user's explicit instruction, on the same footing and with the same caveat as ADR-0011 itself: every other ADR in this directory comes from the architecture layer, these two do not. That provenance is recorded deliberately so a later reader can weigh it accordingly.

## Context

ADR-0011 §5 read: **"NEVO (RIVM) must not enter the repository."** Its reasoning was licence-based and, on the evidence then available, sound. RIVM's own conditions document states:

> "Using the information from NEVO online is only allowed **unchanged** and stating the source and version number."

and, under *Additional conditions → Data*:

> "The user is entitled to make **additions** to NEVO-online version 2025/9.0 provided that due care is exercised and that it is clear these are additional to the original dataset and to what part(s) they apply. The user is **not** entitled to make amendment to the NEVO online version 2025/9.0."

Reshaping 2,328 rows of a 143-column composition table into a normalised five-column seed is not "unchanged" under any ordinary reading. ADR-0011 concluded the repository could not carry it. That was the right call on that evidence.

Two things have since changed the evidence.

**1. The Dutch government's own open-data catalogue publishes NEVO under CC-BY 4.0.** `data.overheid.nl`'s entry for the *Nederlands Voedingsstoffenbestand* states `License: CC-BY (4.0)`, with the note that users must accept RIVM's conditions before downloading. CC-BY 4.0 expressly grants the right to "remix, transform, and build upon the material for any purpose", conditioned only on attribution. This is a materially different permission from the conditions PDF's "unchanged", published by the official national open-data portal for the same dataset.

**2. The user has confirmed the use case directly with RIVM.** The user has a personal working relationship with RIVM and reports that RIVM has no objection to this project's use — displaying nutritional values without altering them.

**The conflict between the two licence statements is real and is not resolved here.** `data.overheid.nl` says CC-BY 4.0; RIVM's conditions PDF says unchanged-use-only. They cannot both be the operative terms. This ADR does not adjudicate that; it records that the permissive reading is supported by an official government publication *and* by direct confirmation from the rightsholder, and that the project proceeds on that combined basis. A future reader who finds this insufficient should treat the conditions PDF as controlling and revisit §5 below rather than assume the question was never asked.

## Decision

### 1. NEVO-online 2025/9.0 is the nutrition source for `reference.ingredients`

The hand-curated 13-row seed from ADR-0011's migration is **replaced** by the full NEVO food list. `public.ingredients.reference_id` is `on delete set null`, so any existing user row that pointed at a curated row is detached rather than destroyed — it keeps its own `name` and stays fully renderable, exactly as ADR-0011 §2 requires of an unlinked row.

This reverses ADR-0011 §5's "the canonical Dutch names are ours, hand-curated" for the *seed*. The principle survives where it matters: `public.ingredients.name` is still the user's own, still renameable, and still what renders. What changes is that the shared layer beneath it is now a real composition database instead of thirteen names with no numbers.

Note the cost, accepted knowingly: NEVO's names are clinical (`Aardappelen rauw`, `Pasta witte rauw`), not the friendly labels the design mock used. The picker will surface them as-is. Curating friendlier display names on top is deliberate future work, not a defect of this import.

### 2. Attribution is a UI obligation, not only a schema one

ADR-0011 §5 made attribution a schema obligation (`source`, `source_version` columns). NEVO's conditions go further, and this is binding regardless of which licence reading applies — CC-BY 4.0 also requires attribution:

> "Any output from software for nutritional calculations produced by the user must contain one of the following references: 'Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven' or 'Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven and other data sources'."

A rendered per-person macro figure **is** output from software for nutritional calculations. The reference therefore appears in the UI, in each of the four macro dropdowns on the recipe detail page — the exact place a computed figure is shown, and existing Figma-designed surfaces, so no UI is invented outside the design system.

The second wording ("and other data sources") is the one to use, because the row also renders `recipes.time_minutes`, which is not NEVO data.

**A consequence with teeth:** the conditions also state *"The user is not allowed to charge (end)users for the use of NEVO online 2025/9.0 data."* Any future monetisation of a surface that displays these figures needs this clause re-examined first.

### 3. Nutrient scope: five columns, chosen deliberately

NEVO carries ~140 nutrients. This import takes five: energy (kcal), protein, available carbohydrate, fat, and dietary fibre. The first four fill ADR-0011 §4's existing columns; fibre adds `fiber_g_per_100g`.

Fibre is stored and computed but **not displayed**. Figma's `NutritionalData` row (`3997:15948` mobile / `3997:15543` desktop) draws six buttons — time, kcal, carbs, protein, fat, servings — and none of them is fibre. Building a seventh would be inventing UI absent from Figma, which `CLAUDE.md` forbids. The data is imported now because a second pass over a populated table is worse than one extra column today; the display question is recorded in `docs/open-questions.md` as `nutrition-fiber-has-no-figma-button`.

Importing the remaining ~135 nutrients would require a key/value nutrient table rather than columns. Out of scope; the current shape does not preclude it.

### 4. `nutrient_basis` records what the numbers are per

53 of NEVO's 2,328 rows are expressed **per 100 ml**, not per 100 g — all of them in the `Flesvoeding en preparaten` (infant formula) group. The other 2,275 are per 100 g.

Writing a per-100-ml figure into a column named `kcal_per_100g` would be a silent lie of exactly the kind ADR-0011 §4 exists to prevent. So `reference.ingredients` gains:

```sql
nutrient_basis text not null check (nutrient_basis in ('per_100g', 'per_100ml'))
```

The read layer treats a `per_100ml` row's nutrients as **unknown** — the same `EMPTY_NUTRIENTS` path an unlinked ingredient takes — so those rows render `?` rather than a wrong number. That is honest and costs nothing real: infant formula is not a recipe ingredient. Handling volume-based nutrients properly would mean teaching `nutrition.ts` a volume path, which is a separate mechanism and stays separate (ADR-0011 §3's standing rule).

### 5. The import is a checked-in script, not a one-off

`scripts/import-nevo.ts` reads the upstream CSV and emits the seed migration. It is committed; the 108 MB of raw NEVO CSVs are **not** (`.gitignore`). Three reasons: the next NEVO version is a re-run rather than an archaeology exercise; the parsing rules below are testable in isolation; and the repository carries a derived, attributed extract rather than a wholesale copy of the upstream dump.

Two parsing rules the script must enforce, both verified against the real file rather than assumed:

- **The decimal separator is a comma** (`12,3`, `1,8`). Parsing these as if they were points silently truncates values — `1,8` becoming `1` is a 44% error that no test of "did it import?" would catch.
- **Empty means unknown.** kcal, protein, carbohydrate and fat are populated for all 2,328 rows; **fibre is empty for 7**. Those seven become `NULL`, never `0`, per ADR-0011 §4.

### 6. Category becomes bilingual, alongside names

NEVO supplies both `Voedingsmiddelgroep` and `Food group`. ADR-0011's single `category` column is replaced by `category_nl`/`category_en`, mirroring the existing `name_nl`/`name_en` pair, so the whole shared layer is bilingual rather than half of it.

Display selects on the active locale. Today `i18n/request.ts` hardcodes `'nl'` and never reads `profiles.locale`, so Dutch is what renders in practice; the wiring that makes this actually vary is issue #162. The ingredient layer is built locale-driven now so that ticket needs no further work here — ADR-0007's multi-language obligation applies to the shared reference layer, not to `recipe_ingredients.name`, which is user-entered text and is never translated.

## Consequences

- **ADR-0011 §5's NEVO prohibition is void.** Its USDA/CIQUAL analysis is not: those remain viable supplements, and its "never mix sources within one ingredient's nutrient set" rule is now load-bearing, because every NEVO row's five nutrients must stay a NEVO set. A row's `source`/`source_ref`/`source_version` describe *where its numbers came from*, which is precisely why a friendlier future name on top of a NEVO row does not violate anything.
- **`ingredient_unit_masses` stays empty.** NEVO carries no household-measure weights. Mass-magnitude units (`gram`, `kilogram`, `ounce`, `pound`) now yield real figures; `stuk`, `cup`, `eetlepel` and friends still resolve to `?` until a portion-weight source lands. This import makes nutrition *partially* available, and the `?` fallback remains correct behaviour rather than a bug for the remainder.
- **Attribution now constrains the UI, not just the schema.** Removing the reference line from the macro dropdowns is a licence violation, not a styling choice. It is not decoration.
- **Monetisation is now encumbered** on any surface showing these figures (§2).
- **`Vision.md`'s "voedingswaarde-informatie buiten scope"** was already narrowed to the UI by ADR-0011; that narrowing now has real data behind it. The feature scope is still not reopened — this ADR fills existing designed slots, it does not add a nutrition feature.
- **A licence conflict is documented and unresolved** (Context). If RIVM's conditions PDF is ever held to be controlling over `data.overheid.nl`'s CC-BY 4.0, this import must be revisited. The user's direct confirmation from RIVM is part of the record precisely so that reassessment starts from what was actually known.

## Amendment (2026-08-06, #163): `ingredient_unit_masses` is no longer empty

The Consequences bullet above — "`ingredient_unit_masses` stays empty" — is superseded. #163 seeds `reference.ingredient_unit_masses` from **NEVO Portie-online 2025/9.0** (26 CSVs of household-measure weights, a separate NEVO export from the composition table this ADR otherwise concerns), via `scripts/import-nevo-portions.ts` and `supabase/migrations/20260806000002_nevo_unit_masses.sql`.

**Populated**: `eetlepel`, `theelepel`, `stuk` — the only three units that exist in both NEVO's `Maat` column and `public.recipe_unit`. 1175 `(ingredient, unit)` pairs across 1026 of 2328 ingredients (44%): 683 eetlepel, 336 stuk, 156 theelepel.

**Deliberately still unresolved** (render `?`, which is correct behaviour, not a gap):
- `snufje`, `scoop`, `cup`, `teaspoon`, `tablespoon` — no corresponding NEVO `Maat` measure maps to these.
- All volume units (`milliliter`, `deciliter`, `liter`, `fluid_ounce`) — density conversion from NEVO's `ml`-denominated portion rows is Layer 2, out of scope for #163 and explicitly deferred to its own future ticket (ADR-0011 §3: the mass and volume mechanisms never merge).
- The ~1.3% of Portie-online NEVO-codes with no matching `reference.ingredients` row (seeded by #161's separate import).
