# ADR-0011: Canonical ingredient library, unit mass resolution, and a `reference` schema for shared data

**Status**: Accepted (user decisions, 2026-07-29 and 2026-07-30). §1 amended by ADR-0020 (2026-10-10): admins may write `eigen` rows and shared aliases in `reference`; NEVO/USDA rows stay migration-only.


## Context

Phase 4 (Recepten) stores each ingredient as three fields — name, numeric quantity, unit — so that recipes can be scaled per servings and units converted. ADR-0004's build order puts Recepten before Boodschappenlijst precisely because the latter consumes the former's ingredients.

Three forces converged on a decision that the original `Architecture.md` §4.2 model (`recipe_ingredients (recipe_id, name, quantity, unit, position)` — free text throughout) cannot carry:

1. **Unit conversion needs a closed vocabulary.** Free-text units make conversion silently unreliable. Settled 2026-07-29: units come from a fixed list, conversion is same-dimension only (volume↔volume, mass↔mass), and there is no density table.
2. **Portion scaling and shopping-list merging need canonical identity.** "Havermout", "havermout" and "Havermout grof" are three strings and one ingredient. Free text makes merging the same ingredient across two recipes a string-matching problem.
3. **Nutrition is now a stated direction.** The user asked (2026-07-30) whether an ingredient library helps if recipes should later yield calories and macronutrients. It does not merely help — it is a precondition, and it reopens the volume↔mass question, because nutrition tables are expressed per 100 g while recipes are written in cups, scoops and pieces.

The design caught up on 2026-07-30: node `3957:10309` (`Add recipi/ingredientList/Mobile`, desktop `3957:10595`) now draws a search field over a fixed, checkbox-selectable ingredient list, and node `3717:2844`'s ingredient name field opens it (annotation on `I3740:4302;3761:8982`: *"OnClick slide in #Add recipi/ingredientList/Mobile"*). Canonical identity is therefore a designed product behaviour, not an inferred one.

`Vision.md` still lists "voedingswaarde-informatie" as explicitly out of scope for Recepten. This ADR knowingly moves that boundary for the **schema only**, not for any user-facing feature.

## Decision

### 1. A `reference` schema holds shared, non-user data

Ingredient reference data is not user data. "Rolled oats weigh 81 g per US cup" is a fact about the world, not about an account, and copying it per user would be both wasteful and wrong.

- Shared reference tables live in a **`reference` schema**, never in `public`.
- `reference` tables carry **no `user_id` column**. ADR-0001 is therefore untouched: its invariant ("every table carries `user_id not null`") continues to hold for every table in `public`, which is where all user data continues to live.
- `authenticated` receives **`select` only** (`anon` too until migration 20261024000004, which revoked its access: the app never reads this schema anonymously). No `insert`, `update` or `delete` is granted to any client role. Reference data changes exclusively through migrations.
- RLS is nonetheless **enabled** on every `reference` table, with a single permissive `select using (true)` policy and no write policies at all. The grants already prevent writes; the policy is defence in depth, so a mistaken future grant cannot silently open a write path.

This is not a way around `scripts/check-rls-coverage.sh` — that gate reads `pg_tables where schemaname = 'public'` and would simply not see these tables. Leaving it that way would be the hack. The gate is therefore **extended** (see §6).

### 2. The ingredient library is two layers, joined by one nullable link

```
reference.ingredients          -- global, seeded, read-only
public.ingredients             -- per-user, user_id not null, nullable reference_id
public.recipe_ingredients      -- one FK: ingredient_id -> public.ingredients
```

- **`reference.ingredients`** — canonical Dutch name, English name, category, `source`, `source_ref` (the upstream identifier, e.g. a USDA `fdc_id`), `source_version`. Immutable between migrations.
- **`public.ingredients`** — the user's own ingredient list. `user_id not null` per ADR-0001. A nullable `reference_id` points into `reference.ingredients`. Picking a library ingredient materialises (or reuses) a user-owned row that links to the reference row; adding an unknown ingredient creates a row with `reference_id is null`.
- **`public.recipe_ingredients`** gains a single `ingredient_id` FK into `public.ingredients`. No polymorphic FK, no exclusive-arc CHECK, no nullable-`user_id` table.

Two consequences worth naming. Materialising per-user rows duplicates a few hundred rows per account — negligible, and it buys something real: a user can rename an ingredient or correct its unit mass without mutating global data. And `recipe_ingredients` **keeps its denormalised `name` column**: it is always populated, it is what renders, and it keeps `Architecture.md` §103's `pg_trgm` index working. The FK is an *enrichment* link used for conversion and nutrition, never a precondition for displaying a recipe. A recipe row whose `ingredient_id` is null still renders correctly; it simply cannot be converted or costed.

### 3. Unit mass resolves user-first, reference-second

Converting "1 cup havermout" to grams, or "1 ei" to 58 g, is a per-*(ingredient, unit)* fact, not a per-unit constant — a cup of oats and a cup of flour differ. Two tables mirror the two layers:

- `reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)`
- `public.ingredient_unit_masses (user_id, ingredient_id, unit, grams)`

Resolution order is **user override → reference → unresolved**. "Unresolved" is a first-class, visible outcome, never a silent zero and never a guess.

This is what makes `count` units (stuk, scoop, snufje) tractable without reopening the density decision: the conversion library still refuses volume↔mass arithmetic on units alone, but an *ingredient-specific* mass per unit is a lookup, not a conversion. Same-dimension unit conversion (ADR-scope of 2026-07-29) and ingredient-specific unit mass are two separate mechanisms and must stay that way in code.

### 4. Nutrition columns exist now and stay empty

`reference.ingredients` carries nullable `kcal_per_100g`, `protein_g_per_100g`, `carbs_g_per_100g`, `fat_g_per_100g` from the first migration. No import, no UI, no aggregation in Phase 4.

The columns cost nothing now and avoid a second migration against a table that by then holds real data. `NULL` means *unknown* and must never be coerced to `0` — the CIQUAL documentation is explicit that missing values are not zeros, and an aggregate that silently treats them as such produces a confidently wrong calorie count, which is worse than none.

### 5. Data sourcing is constrained by licence, not by coverage

No single source provides Dutch names, household-measure weights and per-100 g macronutrients under a licence that permits redistribution in this repository. The library is therefore assembled, not imported:

- **The canonical Dutch names are ours**, hand-curated and small to start. Every row records where its numbers came from.
- **USDA FoodData Central** (SR Legacy + Foundation Foods for composition, FNDDS for portion weights) is the backbone. It is the only researched source combining macronutrients *and* household-measure weights under an uncontested licence — data.gov publishes the dataset under `https://www.usa.gov/publicdomain/label/1.0/`. Note the caveat: that licence statement was verified via data.gov's catalogue metadata, not verbatim on `fdc.nal.usda.gov` itself.
- **CIQUAL** (ANSES) is an acceptable European supplement for composition under the Licence Ouverte / Etalab, which permits reuse and modification provided the source *and version date* are cited. It contains no portion weights.
- **NEVO (RIVM) must not enter the repository.** Its terms read: *"Using the information from NEVO online is only allowed unchanged and stating the source and version number"*, and the user *"is not entitled to make amendment"*. Reshaping it into a normalised seed does not survive "unchanged". NEVO may be consulted during development to validate Dutch naming; its values must not be committed.
- **FAO/INFOODS Density Database** is `"All rights reserved"` with non-commercial use free *upon request*. Not usable without first obtaining written permission.
- **Open Food Facts** (ODbL, share-alike) covers branded products rather than raw ingredients, and its `serving_size` is unstructured free text. Out of scope for this library; potentially relevant to Boodschappenlijst later, where its share-alike obligation would need its own analysis.

**Attribution is a schema obligation, not a README one.** CIQUAL and the Open Government Licence both require citing source *and version*, so `source` and `source_version` are columns on every reference row, and any exported or displayed nutrition figure must be able to name its provenance.

Never mix sources within one ingredient's nutrient set: composition tables use different protein conversion factors (CIQUAL varies Jones factors by food group), so per-nutrient cherry-picking yields energy values that do not add up. One source per ingredient row.

### 6. The RLS coverage gate is extended, not bypassed

`scripts/check-rls-coverage.sh` currently enumerates `public` only. It gains a second pass asserting, for every table in `reference`:

- no `user_id` column exists (user data must never land here),
- `authenticated` holds `select` and nothing else, and `anon` holds nothing,
- RLS is enabled.

A new shared schema that the security gate cannot see would be exactly the kind of silent gap ADR-0009 exists to prevent.

## Consequences

- **`Architecture.md` §4.2 is now materially out of date for Recepten** — `recipe_ingredients` gains `ingredient_id`, `unit` becomes an enum, and two new schemas' worth of tables appear. §4.2 must be updated; this ADR is the source of truth until it is.
- **`Vision.md`'s "voedingswaarde-informatie buiten scope" is narrowed to the UI.** The schema anticipates nutrition; no feature ships in Phase 4.
- **Phase 5 gets cheaper and better.** Shopping-list merging keys on `ingredient_id` rather than string similarity, and "send to list" can resolve quantities to grams where a unit mass exists.
- **Phase 7 gets a cleaner embedding target.** Canonical ingredient rows are a better semantic-search unit than free-text recipe lines, though `recipe_ingredients.name` remains indexed for the unlinked case.
- **A real curation cost is accepted.** Somebody must build and maintain the Dutch canonical list and its mapping to upstream identifiers. This is deliberate: the alternative is machine-translated USDA names in a Dutch-first product.
- **The seed is a migration, not a per-user trigger.** Unlike the Kanban default-board seed in `20260723000001_kanban_schema.sql`, reference data is loaded once for the deployment, not once per account.
- **`reference` is now a precedent.** Any future shared, non-user dataset belongs there under the same rules. It is not a general-purpose escape from ADR-0001, and a table holding anything user-identifiable in `reference` is a defect.
