# MemberSearchPanel
Figma: `Winkelmand/04` empty `4231:16811`, `05` result `4231:17096`, `06` selected `4233:17340` (level-2 panel inside each frame; in `figma-map.json` as `4231:16811`) · Code: `components/organisms/MemberSearchPanel.tsx` (+ `.stories.tsx`)

## Anatomy
`SidePanel level={2}` supplies the chrome. Children: `InputField` (placeholder "Naam", trailing `Search`, no visible label), then one `Card` (Title=No) per result. Each Card holds a full-width `<button aria-pressed>`: `Avatar` (md), name (`text-base font-semibold`), and the e-mail (`text-sm`, secondary) only when the RPC returned it. Footer: filled `Button` "Annuleren" (`ArrowLeft`) and "Voeg toe" (`Plus`), equal width.

## Contract
- Generic: no basket knowledge. Props: `open`, `onClose`, `onSearch`, `onSelect`, `selectedId`, optional `initialQuery`.
- `onSearch(input: unknown) => Promise<ActionResult<MemberSearchResult[]>>` is called with `{ query }`. The panel never imports `"use server"` code; pass a stable reference (it is a dependency of the debounce effect).
- `onSelect(member)` fires once on "Voeg toe", then the panel closes. Never fired on cancel/close.
- `selectedId` is the person the caller already chose. They show as selected once they appear in a result set. "Voeg toe" is disabled until someone is selected.
- Everything (query, results, pick) resets on close.

## Deliberate decisions
- Debounced search of 250 ms, minimum 2 trimmed characters, `maxLength` 64: the bounds `public.search_members` enforces. Shorter queries show the prompt, make no request. Same `cancelled`-flag pattern as `IngredientSearchPanel`.
- Errors come from `sharing.errors.*` and are shown in place of the results, including `rate-limited` (30 searches per 15 minutes per user); a failure never renders as "no results".
- The e-mail only appears when the query was exactly that person's address (the RPC decides). The panel never reveals more than it is given.
- Avatar `src` is `/api/avatar/<id>?v=<updated_at>` only when `hasAvatar` (`memberAvatarSrc`, `lib/sharing/member.ts`); otherwise the letter fallback. A missing name renders `unnamedLabel`.
- Selected result: 1px border in `text-primary` on the Card's Type slot. Figma binds it to `Stroke/primary 2` (`#0C0A09`), which is not mirrored (`docs/open-questions.md#figma-stroke-primary-2-malformed-name`); `text-primary` is the existing token with that exact value, so no new token.
- Result card composition: Figma puts `Card-content/Recipe` in the slot, but its 96px thumbnail is a recipe photo. The issue asks for the `Avatar` atom, so the row is composed from `Avatar` + text inside `Card`, not a new molecule.
- Empty, no-results, searching and error states are designed in code (not drawn in Figma), plain text lines like `IngredientSearchPanel`.
- Result list is a `<ul>`; the selection model is single (v1 shares one person per basket, ADR-0035 point 11).

## Token gaps and flags
- No raw spacing. Result row `gap-inline-lg` (as `CardContentRecipe`), text column `gap-stack-sm`, list `gap-stack-md`, footer `gap-inline-sm`.

## Gotchas
- Stories: `Empty`, `Results`, `Selected`, `NoResults`, `RateLimited`, with mock actions; no result has `hasAvatar`, so the baselines need no avatar route.
