# ADR-0020: Curated ingredient mappings and an admin role

**Status**: Accepted (user decision, 2026-10-10). **Amends** ADR-0011 §1 (the `reference` schema is no longer migration-only for the tables named in §2) and ADR-0019 §2 (matching order).

## Context

- The import links ingredient lines to NEVO with `pg_trgm` and then the LLM (ADR-0019 §4). Common names still go wrong: "tomaten" normalises to "tomaat", and NEVO has about ten near-equal rows ("Tomaat gewoon rauw", "Tomaat rauw gem", "Tomaat tros- rauw" …). No candidate clears the margin, so the LLM guesses.
- Per-user aliases (`public.ingredient_aliases`, ADR-0019 §7) only learn after each user corrects a line themselves. Nothing shared improves everyone's matching.
- The user wants to curate common mappings once ("tomaten" → a NEVO row) and to add ingredients NEVO lacks, with their own nutrition values, without making each import's prompt longer.
- A user who adds an ingredient by hand in a recipe now gets a permanent `public.ingredients` row in their own list. The user wants that to stay a recipe-only name.
- Vision: solo/household use now, multi-user from the ground up. Nothing in the schema knows about roles yet.

## Decision

### 1. An admin role in `app_metadata`

- An admin has `app_metadata.role = 'admin'` on their `auth.users` row. Users cannot write `app_metadata` (only service_role or SQL by a human can), so the role cannot be self-granted. It is deliberately **not** a `profiles` column, because users can update their own profile under RLS.
- SQL helper `public.is_admin()`: `stable`, `security invoker`, reads `auth.jwt() -> 'app_metadata' ->> 'role'`. App helper `isAdmin()` next to `getAuthenticatedUserId()`, reading the same claim from `getClaims()`.
- Granting or revoking takes effect on the next token refresh. A revoked admin keeps access until the token expires (same trade-off as #168).
- Granting the role is a hosted write the user runs or explicitly authorises. The first grant was made on 2026-10-10.

### 2. `reference` gets admin-written tables (amends ADR-0011 §1)

The rule "no `user_id` in `reference`" stands. The rule "data changes only through migrations" is narrowed to: **NEVO and USDA rows change only through migrations**. Admins may write the following through the user's own RLS-bound client. service_role never enters a request path (ADR-0002/0003).

| Table | Admin may | Guard |
| --- | --- | --- |
| `reference.ingredient_aliases` (new: `alias_normalized` unique, `ingredient_id` → `reference.ingredients` on delete cascade) | insert / update / delete | `is_admin()` |
| `reference.ingredients` | insert / update / delete own rows | `is_admin() and source = 'eigen'` in both `using` and `with check` |
| `reference.ingredient_unit_masses` | insert / update / delete own rows | `is_admin() and source = 'eigen'` |

Everyone keeps select. RLS tests (ADR-0009) cover:
- a non-admin cannot write;
- an admin cannot change or delete a NEVO row, or relabel one as `eigen`.

### 3. Matching order (amends ADR-0019 §2)

```
own alias → shared alias → pg_trgm → LLM
```

- Both alias lookups are deterministic database steps. **No alias or substitution list is ever sent in a prompt.** Every line settled before the LLM is also left out of the link call, so curation lowers the token cost per import.
- The prepare call asks for search terms only for lines that are still unresolved. It still sees every line when it translates.
- A user's own alias wins over the shared one: their own correction is the more specific signal.

### 4. Own ingredients and the NEVO licence (ADR-0013)

- An admin-added ingredient is a `reference.ingredients` row with `source = 'eigen'`, `source_version` = the ISO date of the last edit, and `nutrient_basis = 'per_100g'`. Unknown values are `NULL`, never `0` (ADR-0011 §4).
- NEVO allows additions that are clearly marked as additions, and no amendments. NEVO rows are therefore never edited, not even by an admin. To "correct" NEVO, add an `eigen` row and map to it. The UI labels `eigen` rows, and the existing attribution line already reads "… and other data sources".
- Deleting an `eigen` row detaches users' `public.ingredients` rows (`on delete set null`, ADR-0011 §2) and removes its shared aliases (cascade).

### 5. Adding an ingredient by hand in a recipe or the shopping list

- The picker's "add as new" becomes **"use as plain name"**: the line keeps its name with `ingredient_id = null` and shows as "niet meegeteld". No `public.ingredients` row is created.
- Existing self-added rows stay as they are. No data migration.
- Permanent ingredients with nutrition values come only from the admin page (§4).

### 6. Admin page

- Route `/recepten/ingredienten`. The server checks `isAdmin()` and returns `notFound()` for everyone else, so the page is not discoverable. The entry point is an "Ingrediënten" button (lucide `library-big`) in the Recepten page header, rendered only for admins.
- Sections:
  - **Koppelingen**: shared aliases.
  - **Eigen ingrediënten**: add, edit, delete, including weight per unit.
  - **Nog te koppelen**: the admin's **own** `needs_review` lines grouped by normalised name.
- Designed by Claude in code from existing components and semantic tokens, responsive for mobile and desktop (user request 2026-10-10; `docs/guides/ui-components.md` → "Claude-designed UI").

## Consequences

- Fixing a common mismatch is one mapping and helps every user at zero token cost.
- The `reference` schema now has write grants for `authenticated`. RLS alone stands between a non-admin and shared data, so the RLS tests are the guard and must stay in CI.
- `check:rls-coverage`'s reference pass must accept these write policies. It still forbids `user_id` in `reference`.
- Role changes lag until token refresh.
- A recipe-only name never counts toward nutrition. Users who want it counted ask the admin to add or map it.

## Alternatives considered

- **Mapping list in the prompt**: costs tokens on every import, grows with curation, and still leaves the choice to the model.
- **Hidden URL without a role**: security through obscurity. Anyone who finds the URL could write shared data.
- **`profiles.is_admin` column**: self-grantable through the user's own profile update unless column-level grants are added. `app_metadata` is safe by construction.
- **Every user curates shared data**: one wrong mapping skews everyone's nutrition. Per-user aliases already give every user their own learning path.
- **"Nog te koppelen" across all users**: needs a `security definer` exception that shows one user's ingredient names to another. That breaks ADR-0001's isolation for little gain while the platform is solo/household.
- **Writes via service_role after an app-side admin check**: one missed check exposes shared data. RLS on the user's own client fails closed.
