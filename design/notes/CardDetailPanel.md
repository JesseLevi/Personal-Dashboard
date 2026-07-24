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

## `InputField` gained `multiline` (textarea)

Figma's Omschrijving instance is the same `Input-field` component fixed at a 144px height (`Text:true`, no separate "textarea" component exists in Figma) — the atom itself only ever rendered a native `<input>`, which can't do real multi-line editing. Added a discriminated `multiline?: boolean` prop (`design/notes/InputField.md`'s own #94 entry has the full type-level writeup) rather than inventing a second component; every existing call site is unaffected (`multiline` defaults to `false`/absent). The Status/Prioriteit/Grootte "hide the input row, show only the button slot" gap `InputField.md` already flagged before this ticket is **not** resolved by this change — those three fields are built on `Dropdown` instead (above), so that gap stays open for whatever future field actually needs it.

## Datum is plain text, parsed server-side — `lib/boards/dates.ts` + a `lib/boards/schemas.ts` change

Figma's annotation is explicit ("For now date will be only text based") and the user confirmed no datepicker for this ticket. The field is a plain `InputField` (`type="text"`, no native `type="date"` — that would render browser calendar chrome Figma doesn't show). What the user types (dd-mm-yyyy or dd/mm/yyyy, matching the same shape `TeDoenBoard.tsx` already displays via `useFormatter`) is sent to the server **unparsed**; `lib/boards/schemas.ts`'s `dueAt` field now accepts either an already-ISO datetime (kept for backward compatibility — `createCardSchema`'s own test suite already exercised that shape) or free text, parsed via the new pure `lib/boards/dates.ts#parseDueAtText` inside a Zod `.transform()` — so the parse genuinely happens in the server action (Zod validation runs there, not in the browser), matching the ticket's explicit "parse server-side" requirement without adding a new server action. An empty text field is sent as an explicit `null` (never `""`) to clear the date — the schema rejects a bare `""` on purpose, so a caller can't accidentally "clear" a date by forgetting to trim.

## Status change writes `column_id` via `moveCard`, not `updateCard`

`updateCardSchema`/`updateCard` (#92) has no `columnId` field on purpose — changing a card's column also needs a new fractional `position` computed against the destination column's siblings (`lib/boards/positioning.ts`), which blindly overwriting `column_id` alongside title/description/etc. would skip, risking a colliding/out-of-order position. The ticket's own text ("opslaan schrijft column_id") undersells this: on save, if the Status field's selected column differs from the card's current `column_id`, this file calls the **existing** `moveCard` action (built for exactly this) with `targetIndex: Number.MAX_SAFE_INTEGER` — `moveCard`'s own server-side clamp (`Math.min(targetIndex, siblings.length)`) turns that into "append at the end of the destination column" without this file needing to know how many cards are already there. Verified against a mock `moveCard` in Ladle: changing Status from "Ideeën" to "Klaar" and saving calls `updateCard` (title/description/priority/size/dueAt) followed by `moveCard({cardId, columnId: "klaar", targetIndex: 9007199254740991})`, in that order.

## Two-step delete — footer swap, no dialog

Per the user's 2026-07-24 decision: clicking "Verwijderen" (destructive) swaps the *same* `SidePanel` footer to a confirm state (`t("deleteConfirmLabel")` text + `Button variant="outline"` Annuleren + `Button variant="destructive" icon="Trash"` Ja, verwijderen) — no `window.confirm`, no second dialog/chrome. "Annuleren" just flips a local `deleteConfirming` boolean back to `false`. No Figma node models this state (the ticket says so explicitly), so no new component was built for it — both buttons are existing `Button` variants already used elsewhere in this same footer.

## One component, create+edit — remount-on-target-change

`CardDetailPanel` (outer, thin) computes a `key` from `target` (`edit-${card.id}` / `create-${columnId}`) and renders `CardDetailPanelForm` (inner, owns all state) under that key — switching targets always starts from fresh field state instead of carrying over unsaved edits from a different card. Toggling `open` alone does **not** change the key, so `SidePanel`'s own open/close CSS transition still animates normally; `TeDoenBoard.tsx`'s panel state keeps `open`/`target` independent for the same reason (closing via X/overlay/Escape only flips `open`, leaving `target` in place so the close transition has real content to animate away from).

**Known, accepted trade-off**: if the panel is already open (e.g. editing card A) and a *different* card B is clicked without closing first, the `key` changes mid-visible-panel and React remounts `SidePanel` entirely — the open transition doesn't replay (the new instance mounts already-open) and focus/scroll reset to the panel's initial state. This reads as reasonable ("a fresh dialog for the new item") rather than jarring, and a non-remounting state-sync alternative was not built for a one-ticket edge case.

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
