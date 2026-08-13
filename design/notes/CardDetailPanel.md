# CardDetailPanel (`app/(app)/te-doen/CardDetailPanel.tsx`)

- **Code:** `app/(app)/te-doen/CardDetailPanel.tsx` (+ `CardDetailPanel.stories.tsx`)
- **Node IDs:** `3779:4846`/`3779:4847` (mobile AddItem, SidePanel's own node) and `3779:4938`/`3779:4939` (desktop AddItem) — the same nodes `SidePanel.md` documents for the chrome; this file supplies its `children`/`footer`. Dev Mode annotations (fetched via REST, verbatim in the #94 ticket body): `3779:4853` (Status), `3779:4856` (Prioriteit), `3885:15830`/`3885:15855` (Grootte), `3779:4857` (Datum), and the card-click annotation on `I3680:1448;…;3624:4421`.

Built #94. Not a new atomic-design leaf — page-level composition of `SidePanel` + `InputField`/`Dropdown`/`Tag`/`Button` exactly as Figma nests them (same reasoning as `TeDoenBoard.md`), so it is **not** added to `design/figma-map.json`.

## Why this file lives in `app/(app)/te-doen/`, not `components/organisms/`

It renders concrete Figma content for one specific card shape (`cards.title`/`description`/`priority`/`size`/`due_at`/`column_id`), not a generic reusable slot-based organism the way `SidePanel`/`Dropdown`/`Button` are. Same precedent as `TeDoenBoard.tsx`.

## Why it never imports `next/navigation` or the `"use server"` actions module

Every mutation (`onCreateCard`/`onUpdateCard`/`onMoveCard`/`onDeleteCard`) and the post-mutation refresh (`onMutated`) are props, not imports. `TeDoenBoard.tsx` is the only file that imports `app/(app)/te-doen/actions.ts` and calls `useRouter()`, then passes them down — the same "props in, callback out" shape the ticket mandated for `BoardView`'s `onItemClick`, generalized here. This is what let `CardDetailPanel.stories.tsx` mock every mutation and render for real in Ladle: a first attempt that called `useRouter()` directly inside this file threw `invariant expected app router to be mounted` under Ladle's plain Vite runtime (no Next.js App Router present) — moving the router call up into `TeDoenBoard.tsx` (`onMutated={() => router.refresh()}`) fixed it without weakening the real app's wiring.

## Field-by-field mapping

| Figma "Field" | State | Code |
|---|---|---|
| Naam | text | `InputField` |
| Omschrijving | text, 144px | `InputField multiline` (new prop, see below) |
| Status | button-slot, dynamic | `Dropdown` directly (see below) |
| Prioriteit | button-slot, Tag | `Dropdown` directly |
| Grootte | button-slot, grey Tag | `Dropdown` directly |
| Datum | text + Calendar/Pencil icons | `InputField leadingIcon="Calendar" trailingIcon="Pencil"`, plain text |

## Status/Prioriteit/Grootte use `Dropdown` directly, not `InputField`'s `button` slot

The ticket's own field table says "alle met het bestaande `InputField`" — read here as "all six are Figma `Input-field` instances," not "all six are literally the `InputField.tsx` atom in code." Nesting `Dropdown` inside `InputField`'s `button` slot was tried first and rejected: both atoms render their own `rounded-xl border border-border` box, so nesting them doubles the chrome (two borders, two paddings) — Figma's fetched node shows exactly one bordered "Container" per field, with a single `Slot` inside it. `Dropdown`'s own `label` (rendered as a `text-base font-semibold text-text-muted` button, identical styling to `InputField`'s `label`) already reproduces the "field-title above a bordered box" shape on its own, and its `label`-click-to-toggle mechanic is exactly the "on click open dropdown" behaviour the annotations describe — using it directly, with `InputField` skipped entirely for these three fields, gives the correct one-box-per-field visual with real open/close behaviour instead of either doubling the chrome or reimplementing `Dropdown`'s disclosure logic a second time inside `InputField`. `Dropdown`'s own flagged gap (no chevron indicator, `design/notes/Dropdown.md`) is unchanged/out of scope here — not invented.

**Selected-item-first convention**, matching `Dropdown.stories.tsx`'s own established pattern (`Button variant="filled"` first, `variant="white"` rest): the current value is always the Dropdown's first child, the composer (this file) reorders on every render, not `Dropdown` itself. A `key` on each `Dropdown` (the selected column id / priority / size) forces a full remount on every selection, which both resets `isOpen` back to closed (there is no external open/close control on `Dropdown`, so this is the only way to collapse it programmatically after a pick) and lets the newly-selected value become the first child cleanly. Verified in a real browser (see below): picking "Klaar" on the Status field collapses the dropdown and shows "Klaar" as the trigger, with "Ideeën"/"Bezig"/"Afgerond" as the remaining options.

**Prioriteit/Grootte's non-selected options wrap a bare `Tag` in a plain `<button>`** (`Tag` itself is a presentational `<span>`, per `Tag.tsx`, with no interactive semantics) — `flex w-full rounded-lg text-left hover:bg-surface-hover`, no new visual language invented, just a real click target around an otherwise-inert atom.

**Grootte's nullable state**: `cards.size` is nullable (`supabase/migrations/20260723000001_kanban_schema.sql`, deliberately, "a card need not have a size"). When unset, the first (selected) slot renders a neutral `Tag` with a translated placeholder (`fields.sizePlaceholder`, "Geen grootte"/"No size") instead of inventing a fifth enum value — Figma's own sampled content ("XS") is stale placeholder text from whichever card was last dragged onto that instance in the canvas, the same kind of drift `TeDoenBoard.md`'s #97 entry already documents for Prioriteit's sampled Tag text, and is **not** used as a naming signal; the four real values are `s/m/l/xl` per the DB CHECK constraint and the ticket's own confirmation.

## FIXED (2026-08-04) — Grootte couldn't be cleared back to "Geen grootte" once set

Bug report: "Geen grootte" was only reachable while `size` was already `null` (first load / a fresh card) — `otherSizes` was `SIZES.filter((value) => value !== size)`, and `SIZES` (`lib/boards/enums.ts`) never contains `null`, so once any real size was picked there was no option left in the list to go back to no-size. `otherSizes` now starts from `[null, ...SIZES]` before excluding the current value (typed `(Size | null)[]`), matching the same "exclude only the currently-selected value" pattern the field already used. `key={value ?? "none"}` (React key can't be `null`) and the label falls back to `t("fields.sizePlaceholder")` when `value` is `null` instead of unconditionally calling `.toUpperCase()`. `setSize(null)` needs no cast — `size` state was already typed `Size | null` from its `useState` initializer. Persistence was already correct end-to-end and needed no change: `size` is `z.enum([...]).nullable().optional()` (`lib/boards/schemas.ts`), the panel's save payload always includes `size` (never omits it), and `updateCard` (`actions.ts`) writes it whenever the field is present (`!== undefined`) — `null` clears the column, `undefined` (field absent) leaves it untouched, so a real `null` was never the problem, only the missing UI affordance to select it. `TeDoenBoard.tsx`'s card-tile size tag (`card.size && <Tag>…`) already hides correctly for `null` and was left untouched.

## `InputField` gained `multiline` (textarea)

Figma's Omschrijving instance is the same `Input-field` component fixed at a 144px height (`Text:true`, no separate "textarea" component exists in Figma) — the atom itself only ever rendered a native `<input>`, which can't do real multi-line editing. Added a discriminated `multiline?: boolean` prop (`design/notes/InputField.md`'s own #94 entry has the full type-level writeup) rather than inventing a second component; every existing call site is unaffected (`multiline` defaults to `false`/absent). The Status/Prioriteit/Grootte "hide the input row, show only the button slot" gap `InputField.md` already flagged before this ticket is **not** resolved by this change — those three fields are built on `Dropdown` instead (above), so that gap stays open for whatever future field actually needs it.

## Datum is plain text, parsed server-side — `lib/boards/dates.ts` + a `lib/boards/schemas.ts` change

Figma's annotation is explicit ("For now date will be only text based") and the user confirmed no datepicker for this ticket. The field is a plain `InputField` (`type="text"`, no native `type="date"` — that would render browser calendar chrome Figma doesn't show). What the user types (dd-mm-yyyy or dd/mm/yyyy, matching the same shape `TeDoenBoard.tsx` already displays via `useFormatter`) is sent to the server **unparsed**; `lib/boards/schemas.ts`'s `dueAt` field now accepts either an already-ISO datetime (kept for backward compatibility — `createCardSchema`'s own test suite already exercised that shape) or free text, parsed via the new pure `lib/boards/dates.ts#parseDueAtText` inside a Zod `.transform()` — so the parse genuinely happens in the server action (Zod validation runs there, not in the browser), matching the ticket's explicit "parse server-side" requirement without adding a new server action. An empty text field is sent as an explicit `null` (never `""`) to clear the date — the schema rejects a bare `""` on purpose, so a caller can't accidentally "clear" a date by forgetting to trim.

## Status change writes `column_id` via `moveCard`, not `updateCard`

`updateCardSchema`/`updateCard` (#92) has no `columnId` field on purpose — changing a card's column also needs a new fractional `position` computed against the destination column's siblings (`lib/boards/positioning.ts`), which blindly overwriting `column_id` alongside title/description/etc. would skip, risking a colliding/out-of-order position. The ticket's own text ("opslaan schrijft column_id") undersells this: on save, if the Status field's selected column differs from the card's current `column_id`, this file calls the **existing** `moveCard` action (built for exactly this) with `targetIndex: Number.MAX_SAFE_INTEGER` — `moveCard`'s own server-side clamp (`Math.min(targetIndex, siblings.length)`) turns that into "append at the end of the destination column" without this file needing to know how many cards are already there. Verified against a mock `moveCard` in Ladle: changing Status from "Ideeën" to "Klaar" and saving calls `updateCard` (title/description/priority/size/dueAt) followed by `moveCard({cardId, columnId: "klaar", targetIndex: 9007199254740991})`, in that order.

## Two-step delete — footer swap, no dialog

Per the user's 2026-07-24 decision: clicking "Verwijderen" (destructive) swaps the *same* `SidePanel` footer to a confirm state (`t("deleteConfirmLabel")` text + `Button variant="outline"` Annuleren + `Button variant="destructive" icon="Trash"` Ja, verwijderen) — no `window.confirm`, no second dialog/chrome. "Annuleren" just flips a local `deleteConfirming` boolean back to `false`. No Figma node models this state (the ticket says so explicitly), so no new component was built for it — both buttons are existing `Button` variants already used elsewhere in this same footer.

## One component, create+edit — was remount-on-target-change, now reset-on-render (#103/#105)

**Superseded by #103/#105 (2026-07-25).** The paragraphs below describe the *original* #94 design; kept for history since the trade-off it describes is exactly what #105's bug report was about and #103's animation fix had to solve at the same time. See the replacement mechanism after it.

~~`CardDetailPanel` (outer, thin) computes a `key` from `target` (`edit-${card.id}` / `create-${columnId}`) and renders `CardDetailPanelForm` (inner, owns all state) under that key — switching targets always starts from fresh field state instead of carrying over unsaved edits from a different card. Toggling `open` alone does **not** change the key, so `SidePanel`'s own open/close CSS transition still animates normally.~~

~~**Known, accepted trade-off**: if the panel is already open (e.g. editing card A) and a *different* card B is clicked without closing first, the `key` changes mid-visible-panel and React remounts `SidePanel` entirely — the open transition doesn't replay and focus/scroll reset.~~

### Why the remount had to go

Two tickets landed on this mechanism from opposite directions and both were right:

- **#105**: opening "create" twice in the *same* column computes the *same* key both times, so no remount happens, so the previous (abandoned) draft's field state — including `deleteConfirming` and `error` — survives into the reopened panel. Bug: stale data on open.
- **#103**: diagnosed in a real browser (see `design/notes/SidePanel.md`'s own #103 entry for the full method) that the remount itself is *also* the root cause of the "no animation" bug — not just on the literal first click, but on every open whose target's key had never been mounted before. A fresh key mounts `SidePanel`'s dialog `<div>` as a brand-new DOM node already in the `open` position, with no previously-painted closed frame for the CSS transition to interpolate from.

Making the key vary on `open` (an obvious-looking fix for #105) would have made #103 *worse* — the subtree would remount on every close too, destroying the very content `SidePanel` needs to animate away from. Neither ticket could be fixed by patching the other's symptom; the mechanism itself was wrong.

### The replacement: reset during render, never remount

`CardDetailPanel` is now a single component (the outer/inner split existed only to host the `key`, so it was removed along with it). A `targetKey` string (`edit-${card.id}` / `create-${columnId}`, same shape as the old React `key`) is still computed, but only ever used as **plain state for comparison**, never passed as a JSX `key`:

```ts
const [prevOpen, setPrevOpen] = useState(open);
const [prevTargetKey, setPrevTargetKey] = useState(targetKey);
if (prevOpen !== open || prevTargetKey !== targetKey) {
  const shouldReset = open && (!prevOpen || targetKey !== prevTargetKey);
  setPrevOpen(open);
  setPrevTargetKey(targetKey);
  if (shouldReset) { /* setTitle/setDescription/…/setDeleteConfirming(false)/setError(null) */ }
}
```

This is React's own documented "adjust state while rendering" pattern (comparing against a snapshot of the previous render's props/state, kept in `useState` rather than a `useEffect`) — not a house invention. Chosen over `useEffect` specifically because it resets synchronously within the same render/commit: an effect-based reset would let React commit and paint one frame of *stale* field values first (since the effect runs after paint), then reset a frame later, which is exactly the "flash empty" problem the ticket warned resetting-on-*close* has, just shifted to open. Render-phase reset has no such frame.

The `shouldReset` condition covers every case the old remount did, without ever destroying `SidePanel`'s DOM node:

| Scenario | Old (remount) | New (render-phase reset) |
|---|---|---|
| Open "create" twice, same column | No remount (same key) → **stale fields leaked (#105 bug)** | `open` flips false→true both times → resets both times |
| Edit card A, then (without closing) click card B | Remount (key changes) → fresh fields, but `SidePanel` restarts already-open, no close-side animation | `open` stays true, `targetKey` changes → resets fields in place, `SidePanel`'s own DOM node is untouched |
| First-ever open of any never-before-seen target | Remount → **broken animation (#103 bug)**, see `SidePanel.md` | No remount, ever → animation always has a real prior frame |
| Typing in an open panel, unrelated parent re-render | N/A (key unchanged) | `open`/`targetKey` both unchanged → condition never true, no reset, typing is safe |

`deleteConfirming` and `error` are reset in the same block as the fields (the ticket's own explicit requirement — a half-confirmed delete or a stale error message must not leak into the next opening either).

**Verified in a real browser** (`card-detail-panel--interactive` Ladle story, Playwright MCP, `pnpm ladle`), not assumed from reading the code:
- Typed a draft title, closed without saving, reopened "create" on the *same* column (Ideeën) → title field empty.
- Typed in an open "create" panel, then clicked "edit" on the sample card *without closing* → title loaded the card's real value (`"HBO Wachtwoord updaten"`), not the abandoned create draft.
- Opened edit, clicked "Verwijderen" (entered delete-confirm), closed via X without confirming, reopened edit on the same card → back to the normal Verwijderen/Opslaan footer, not stuck on "Weet je het zeker?".
- The open/close animation itself: see `SidePanel.md`'s #103 entry for the frame-by-frame proof (`getBoundingClientRect().y` interpolating smoothly, DOM node identity (`===`) stable across the whole sequence above).

### Footer (#103)

Updated to the new full-width convention `SidePanel.md` documents: the delete-confirm text moved from an inline `<span className="flex-1">` (sharing a row with the buttons) to its own `<p>` on a full-width line, with the two buttons below it in a `<div className="flex gap-2">` row, each carrying `className="grow basis-0"`. The normal (non-confirm) footer's buttons are wrapped in the same kind of row. `BoardPanel.tsx`'s single-button footer follows the identical convention for consistency, even though a lone button would already stretch via `SidePanel`'s column-container default (`align-items: stretch`) without the wrapper.

## Optimistic update vs. `revalidatePath` — chose the latter

Every existing board action (#92) already calls `revalidatePath("/te-doen")` on success; this is the *first* ticket to call any of them from client code, so there was no existing optimistic-UI precedent to break. `BoardView` also already re-syncs its local drag state from the `columns` prop on every change except mid-drag (`design/notes/BoardView.md`), so a revalidated `board` prop flowing back down from `page.tsx` is picked up for free with zero new plumbing in `BoardView`. Rebuilding the same card-shape/position logic the server already owns (Supabase-generated `id`, `position` via `lib/boards/positioning.ts`) just to predict it optimistically would be real duplicated logic for a codebase with no other optimistic surface yet. `onMutated` (`() => router.refresh()`) is called in addition to the action's own `revalidatePath`, matching Next.js's own documented pattern for a directly-invoked (not `<form action>`-bound) Server Action.

## i18n

New keys under `components.cardDetailPanel.*` (`nl.json`/`en.json`, identical key sets — verified with a scripted diff, not by eye). Figma's sampled copy has known typos/trailing spaces this ticket does **not** reproduce literally (per `docs/guides/ticket-workflow.md`'s existing warning and the ticket's own callout): "Oplsaan" → `saveLabel: "Opslaan"`/`"Save"`; "Categorie " (the Status field's stale sampled button text, an AddBoard-style placeholder left over in the canvas, not a real label — same stale-content pattern as the Prioriteit Tag text above) is not used at all, since Status's real trigger text is the column name, not a fixed string.

## Ladle verification (this dev machine has no Docker/Supabase — `/te-doen` cannot render end-to-end here)

`CardDetailPanel.stories.tsx` (`CreateItem`, `EditItem`, `Interactive`) mocks all four action props + `onMutated`. `.ladle/config.mjs`'s `stories` glob was widened from `components/**` to `{components,app}/**` so this file (outside `components/`) is picked up; `.ladle/components.tsx` gained a `NextIntlClientProvider` (locale `nl`, the same catalog `i18n/request.ts` hardcodes) since this is the first Ladle-storied component to call `useTranslations`/`useFormatter` itself rather than receiving translated strings as props — every pre-existing story is unaffected (they never call a next-intl hook).

Verified in a real browser (Playwright against `pnpm ladle`), not just by reading the code:
- **EditItem**: all six fields prefilled correctly from the sample card (Naam/Omschrijving text, Status="Ideeën" selected + Klaar/Bezig/Afgerond listed, Prioriteit="Gemiddeld" + Laag/Urgent listed, Grootte="M" + S/L/XL listed, Datum="01-08-2026" from `due_at: "2026-08-01T00:00:00.000Z"`).
- **Two-step delete**: clicking "Verwijderen" swaps the footer to "Weet je het zeker?" + Annuleren/Ja, verwijderen; clicking Annuleren reverts to the normal Verwijderen/Opslaan footer.
- **Status → moveCard**: changing Status to "Klaar" and saving fired the mocked `updateCard` then `moveCard({columnId: "klaar", targetIndex: 9007199254740991})`, confirming the wiring above.
- **CreateItem**: no delete button; "Opslaan" starts `disabled` (empty title) and enables once a title is typed; saving with Grootte="M" fired `createCard` with `columnId: "ideeen"` (the default), `description: null` (left blank), `priority: "medium"` (default), `size: "m"`.
- A pre-existing, unrelated `next-intl` console warning (`ENVIRONMENT_FALLBACK: timeZone`) appears when a due-date is formatted — the same `format.dateTime` call `TeDoenBoard.tsx` already makes (#93), no `timeZone` configured anywhere in this codebase yet; not introduced by this ticket, not fixed here (a global i18n config gap, out of scope).

**Not verifiable on this machine**: an actual `createCard`/`updateCard`/`moveCard`/`deleteCard` round trip against Supabase, RLS behaviour, and the real `/te-doen` page rendering the panel end-to-end (needs a signed-in session + database). CI (or the server, both of which have Docker/Supabase) is what confirms those.

## TICKET #213 (2026-08-12) — option rows are Button/White instances, not a generic surface; hover corrected again

**Measured, not assumed, via the figma-console-mcp plugin bridge** (`figma.variables`/`boundVariables`, local WebSocket, no Starter-plan rate limit): the Dropdown node (`3705:4446`) that Prioriteit/Grootte's option-list slot renders was fetched for #213's tokens-drift audit (point 2) and settled this file's own open question as a side effect. The rows in that slot are **`Button/Default` instances with fill `color/surface/highlight/white/default`** — i.e. they are genuinely `Button variant="white"` instances, not a bespoke row style with its own surface. `CardDetailPanel.tsx` doesn't render an actual `<Button>` for these two rows (a plain `<button>` wrapping a `Tag`, per this file's own "non-selected options wrap a bare Tag" entry above) but Figma's own component tree says the row *should* read as one, so its hover state follows Button/White's hover directly rather than being reasoned about independently.

**Consequence for the token.** #213 also corrected `Atom/Button`'s own White binding (`design/notes/Button.md`'s #213 entry): White's Hover *state* reads the `surface-highlight-white-selected` token (stone-100), not `-hover` (stone-200) — #204's Button.tsx had this backwards. Since these rows are Button/White instances, they follow the same correction: `hover:bg-surface-highlight-white-hover` → `hover:bg-surface-highlight-white-selected`. This is **not** the `surface/primary/hover` binding #213's own point-2 gap-list flagged as a plausible fix for these rows before the Dropdown node was actually fetched — that guess is now known wrong (the rows aren't a `surface/primary` consumer at all) and `color/surface/primary/hover` stays on `design/tokens.json`'s `$notMirrored` list with zero current consumers, this file included.

**Net effect**: same token family as before (`surface-highlight-white-*`), different specific token (`-selected` instead of `-hover`) — same class of one-column correction as `Atom/Button` itself, for the same underlying reason (these rows *are* White buttons).

## TICKET #204 (2026-08-11) — `surface-hover` retired, option rows rebound

Prioriteit/Grootte's option-row hover (`hover:bg-surface-hover`, stone-50) had no Figma node of its own — as `design/notes/CardDetailPanel.md` already noted above, these rows are a plain `<button>` wrapping a bare `Tag`, "no new visual language invented," built to give an inert atom a click target, not a literal Figma component instance. `surface-hover` itself was flagged an orphan by #203 (no Figma variable backs it at all) with rebinding left to this ticket.

Per the ticket's fallback rule ("no Figma node for this row → use the ramp of the surrounding surface"): both rows render inside `Dropdown`'s labelled panel, whose bordered box is `bg-surface-highlight-white` (`components/atoms/Dropdown.tsx`). The surrounding surface is therefore the `surface-highlight-white` family, so the option-row hover now reads `surface-highlight-white-hover` (stone-200) — the same new token #204 added for `Atom/Button`'s White Hover state (`design/notes/Button.md`), keeping this file's borrowed colour inside a family that already has real Figma provenance rather than picking an arbitrary token. `surface-hover` is deleted from `design/tokens.json`; `pnpm check:tokens-drift` now reports zero exceptions.

## FIXED (2026-08-10, #106) — `create-item`/`edit-item` baselines were sliver crops, covered nothing

`CardDetailPanel.stories.tsx`'s `CreateItem`/`EditItem` never got the `min-h-screen` wrapper `SidePanel.stories.tsx` (and every other `SidePanel`-composing story file — `CategoryPanel`, `RecipePanel`, `IngredientSearchPanel`, `StepIngredientPanel`) already carries. `SidePanel`'s panel/overlay are `position: fixed`, contributing 0 to ancestor flow height; `tests/visual/screenshot-override.css` then collapses `#ladle-root > div`'s `min-height` to 0, and the baseline crops to whatever's left — in this file's case, nothing, since the two stories had no wrapper of their own to preserve height. Proven, not guessed: PRs #100 (Status field trailing chevron) and #103 (full-width footer buttons) both changed exactly these two stories' rendered output and both baselines stayed byte-identical across the whole 59/59-green suite. PNG header read `1280x64` for both — a 64px-tall crop of a panel whose real content is ~780px tall.

**Fix**: wrapped both stories' `CardDetailPanel` in `<div className="min-h-screen">`, identical to the established precedent. Regenerated via `pnpm exec playwright test --update-snapshots -g "card-detail-panel--create-item|card-detail-panel--edit-item$"`. Dimensions: `1280x64` → `1280x784` for both.

**Coverage proven, not assumed** — the ticket's own required experiment: temporarily removed `Dropdown.tsx`'s trailing chevron `Icon` (the same #112 chevron #100 added), reran the two tests (no `--update-snapshots`) against the freshly regenerated baselines. Both **failed**: `create-item` at 54 differing pixels, `edit-item` at 54 differing pixels (both well over the suite's `maxDiffPixels: 0`/`threshold: 0` gate — see `playwright.config.ts`). Reverted the chevron removal (`git diff` on `Dropdown.tsx` came back empty, confirming a clean revert) and reran — both **passed**. This is the same real 3-field click-tested proof the sliver crop had silently missed for #100.

**Delete-confirm footer state added** (previously zero baseline coverage): new `EditItemDeleteConfirm` story renders the real `EditItem` panel and clicks the "Verwijderen" button once in a mount effect (found via the `nl` message catalog's `deleteLabel` text, not a hardcoded string) to drive the component's own local `deleteConfirming` state true — there is no prop for this, so the story exercises the actual click path rather than adding a test-only prop. Baseline: `1280x784`, visually confirmed showing "Weet je het zeker?" on its own line + Annuleren/Ja-verwijderen at 50/50 (the 2026-07-25 decision, "Two-step delete" entry above).

**Audit of the rest of `tests/visual/ladle.visual.spec.ts-snapshots/` for the same pattern** (#106 item 4): checked every baseline's pixel dimensions (`sips -g pixelWidth -g pixelHeight`) against what its story should render. No other file showed the `1280x64`-style signature (viewport-width, near-zero height). Every other `SidePanel`-composing story file already carries the wrapper and baselines at the full `1280x784`. The other small baselines in the directory (`checkbox--*`, `step--*` at ~96px, `card-detail-panel--interactive`/`category-panel--interactive` at ~100px) are legitimately small — plain atoms, or an `Interactive` story whose default state is a *closed* panel (off-canvas by `position: fixed`, no wrapper needed since there's nothing fixed-positioned on-screen to crop out) — not the same failure mode. One related-but-separate gap noted for whoever picks it up: `BoardPanel.tsx` (`app/(app)/te-doen/BoardPanel.tsx`) also composes `SidePanel` (see this file's own "Footer (#103)" entry) but has no `.stories.tsx` at all — zero Ladle/visual coverage, not a sliver crop but a total absence. Out of scope for #106 (different failure mode, no ticket asked for it), flagged here since it's the same architecture family.

**Full-suite verification**: ran `pnpm test:visual` twice, serially, port freed between runs (per this repo's documented flake protocol). Both runs: 100 passed / 1 failed, the failure both times being `category-panel--create-category` (1–5px diff) — the pre-existing, already-documented flake, not a regression from this change. All three `card-detail-panel--*` baselines (`create-item`, `edit-item`, `edit-item-delete-confirm`) plus `card-detail-panel--interactive` passed in both runs.

## #219 — raw radius/spacing utilities in `app/`, measured via `figma-console`

`pnpm check:raw-spacing` gained `app/` as a scope root this ticket (#218 shipped it for `components/` only). Six raw utilities existed in this file; measured against `Te doen/Mobile/AddItem` (`3779:4846`) and `Te doen/Desktop/AddItem` (`3779:4938`) via the `figma-console` bridge (`boundVariables`, never the resolved px alone).

**Converted (2):** the footer button-row wrapper, both the delete-confirm state and the normal state (`gap-2` → `gap-inline-sm`). The footer node ("Bottom" under `Pull-up panel`, id `3779:4858` mobile / `3779:4950` desktop) is `layoutMode: HORIZONTAL`, `itemSpacing: 8`, `boundVariables.itemSpacing` → `spacing/inline/gap-sm` — identical on both breakpoints, so no `md:` split needed. Row axis is horizontal (the axis rule: inline for the row axis), matching the code's own `flex` (row) direction.

**Flagged, not converted (4):** the `rounded-lg` wrapping `<button>` around the Priority/Size Tag triggers (both the selected-item trigger and the non-selected option rows, ×2 fields). These buttons are a code-only click affordance — Tag itself has no interactive semantics (see the #100 entry above) — and have **no Figma node of their own**: the Dropdown organism's own expanded/open state (checked via `Te doen/Mobile/SortOnClick`, `3877:6683`, node `3878:13062`'s Slot) renders its option rows as `Button/Default` instances, not a bare `<button>` wrapping a `Tag`, so it isn't the same element. `Tag`'s own `rounded-lg` (8px) is separately measured and documented as `radius/control` (node `3626:4515`, `design/notes/Tag.md` #205) — the wrapper visually hugs that same Tag, but per this ticket's own rule ("if you did not measure it, you do not convert it"), matching-by-shape to a *different* component's binding isn't a measurement of *this* utility, so these four stay raw with a `spacing-flag` pointing here rather than being converted on the strength of that inference. Worth a second look if a future ticket adds a dedicated Figma node for this trigger pattern.

No design discrepancy found — both measurements are pixel-identical to what the utilities already produced (`gap-2` = 8px = `spacing/inline/gap-sm`).
