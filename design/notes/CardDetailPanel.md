# CardDetailPanel
Figma: `Te doen/Mobile/AddItem` nodes `3779:4846` / `3779:4847` · `Te doen/Desktop/AddItem` nodes `3779:4938` / `3779:4939` (the nodes `SidePanel.md` documents for the chrome; this file supplies `children` and `footer`). Dev Mode annotations: Status `3779:4853`, Prioriteit `3779:4856`, Grootte `3885:15830` / `3885:15855`, Datum `3779:4857`, card-click annotation on `I3680:1448;…;3624:4421` · Code: `app/(app)/te-doen/CardDetailPanel.tsx` (+ `.stories.tsx`)

## Anatomy
Page-level composition of `SidePanel` + `InputField` / `Dropdown` / `Tag` / `Button` as Figma nests them, one component for create and edit (`target.mode`). Not an atomic-design leaf, so not in `design/figma-map.json`. It lives in `app/(app)/te-doen/` because it renders one concrete card shape (`cards.title/description/priority/size/due_at/column_id`), same precedent as `TeDoenBoard.tsx`.

| Figma field | Code |
|---|---|
| Naam | `InputField` |
| Omschrijving (144px) | `InputField multiline` (textarea; `InputField.md`) |
| Status | `Dropdown` of column `Button`s (icon per column) |
| Prioriteit | `Dropdown` of `Tag`s |
| Grootte | `Dropdown` of neutral `Tag`s |
| Datum | `InputField leadingIcon="Calendar" trailingIcon="Pencil"`, plain text |
| Gepland op | Same `InputField` as Datum (`cards.planned_for`), directly under it; no Figma node |

## Deliberate decisions
- Mutations (`onCreateCard` / `onUpdateCard` / `onMoveCard` / `onDeleteCard`) and `onMutated` are props. Only `TeDoenBoard.tsx` imports the `"use server"` actions and `useRouter()` (`onMutated={() => router.refresh()}`); this file imports neither `next/navigation` nor the actions module. A direct `useRouter()` threw "expected app router to be mounted" under Ladle's plain Vite runtime, and this is what lets the stories mock every action. (#94)
- Status/Prioriteit/Grootte use `Dropdown` directly, not `InputField`'s `button` slot: nesting two atoms that each draw `rounded-xl border` doubled the chrome, while Figma has one bordered container per field. `Dropdown`'s own `label` already reproduces the field title and its click-to-toggle is the annotated behaviour. (#94)
- Selected-item-first: the current value is the Dropdown's first child and this file reorders on every render. A `key` on each Dropdown (column id / priority / `size ?? "none"`) remounts it on selection, which is the only way to collapse it (`Dropdown` has no external open control). (#94)
- Prioriteit/Grootte options are a plain `<button>` around a bare `Tag` (Tag is an inert `<span>`); the selected one is a bare `Tag` inside `Dropdown`'s own trigger button, which spans label, Tag and chevron. Option hover is `hover:bg-surface-highlight-white-selected`: Figma's Dropdown option rows (node `3705:4446`) are `Button/Default` instances on the white ramp, and White's Hover state reads the `-selected` token. It was `surface-hover`, retired as an orphan (#204), then `-hover` (#204), corrected here. (#213)
- Grootte is nullable (`cards.size`, "a card need not have a size"). Unset renders a neutral Tag with `fields.sizePlaceholder` ("Geen grootte" / "No size") rather than a fifth enum value; Figma's sampled "XS" is stale placeholder text, the real values are `s/m/l/xl` per the DB CHECK. The option list is `[null, ...SIZES]` minus the current value so a set size can be cleared again; React keys use `value ?? "none"`. (#94, fixed 2026-08-04)
- Datum is plain text per Figma's annotation ("For now date will be only text based"; no datepicker, no `type="date"`). The raw text (dd-mm-yyyy or dd/mm/yyyy) goes to the server unparsed: `lib/boards/schemas.ts`'s `dueAt` accepts ISO or free text and parses via `lib/boards/dates.ts#parseDueAtText` in a Zod `.transform()`, so parsing happens in the server action. Empty text is sent as explicit `null` to clear; the schema rejects `""` on purpose. (#94)
- A Status change on save goes through the existing `moveCard` with `targetIndex: Number.MAX_SAFE_INTEGER` after `updateCard`, not through `updateCard`: `updateCardSchema` has no `columnId` because a column change needs a new fractional `position` (`lib/boards/positioning.ts`). `moveCard` clamps the index server-side to "append at end". (#94)
- Two-step delete: "Verwijderen" swaps the same SidePanel footer to a confirm state (full-width prompt line, then Annuleren + destructive Ja/verwijderen); no `window.confirm`, no dialog. Uses the shared `DeleteConfirm layout="stacked"` + `useDeleteConfirm`. User decision 2026-07-24; no Figma node models it.
- Reset during render, never remount. A `targetKey` (`edit-${id}` / `create-${columnId}`) is compared against `prevTargetKey` / `prevOpen` held in state, and fields, `deleteConfirming` and `error` are reset synchronously when `open && (!prevOpen || targetKey changed)`. Rejected: a JSX `key` on the panel. Remounting `SidePanel` created a fresh dialog node already in the open position (no closed frame to transition from, so no animation on every never-before-mounted target), while a non-varying key leaked the previous draft when "create" was opened twice in the same column. Rejected: a `useEffect` reset, which paints one stale frame first. Keying on `open` would have made the animation bug worse. (#103, #105)
- Footer: normal state is a `flex gap-inline-sm` row whose buttons carry `grow basis-0` (never `flex-1`, see `SidePanel.md`); `BoardPanel` follows the same convention. (#103)

- **Gepland op** (#488) is the day the user intends to do the card (`cards.planned_for`, a date), distinct from the deadline `due_at` (a moment). It has the deadline's input style and text format (dd-mm-yyyy), is sent as `plannedFor` (empty text is `null`, which clears it) and shows in the Agenda as a planned item. It is displayed in UTC because a date has no zone. Invalid text is refused by `plannedFor` in `lib/boards/schemas.ts`.

## Token gaps and flags
- Footer row `gap-2` -> `gap-inline-sm`: the "Bottom" node (`3779:4858` mobile / `3779:4950` desktop) is HORIZONTAL with `itemSpacing` 8 bound to `spacing/inline/gap-sm`, identical on both breakpoints. (#219)
- Two `rounded-lg` click wrappers per field around the Priority/Size option Tags (option rows only; the selected Tag needs none) stay raw with `spacing-flag:`. They are a code-only click affordance with no Figma node; the Dropdown's expanded state in Figma (`Te doen/Mobile/SortOnClick` `3877:6683`, Slot `3878:13062`) draws `Button/Default` instances instead. `Tag`'s own `rounded-lg` is `radius/control` (node `3626:4515`, `Tag.md`), but that is Tag's binding, not this wrapper's, so it is not converted by inference. Revisit if Figma gains a node for this trigger. (#219)
- `InputField`'s "hide the input row, show only the button slot" gap (`InputField.md`) is not solved here: these three fields are built on `Dropdown` instead.

## Gotchas
- Stories (`CreateItem`, `EditItem`, `EditItemDeleteConfirm`, `Interactive`) must wrap the panel in `<div className="min-h-screen">`: `SidePanel` is `position: fixed` and the visual runner collapses `#ladle-root > div`, so without it baselines were 1280x64 slivers that covered nothing (a chevron removal passed the old baselines; with the fix it fails at 54px). (#106)
- `EditItemDeleteConfirm` clicks the real "Verwijderen" button on mount (found via the `nl` catalog's `deleteLabel`) because the confirm state is local and has no prop; do not add a test-only prop. (#106)
- Real `createCard` / `updateCard` / `moveCard` / `deleteCard` round trips, RLS and the full `/te-doen` render cannot run on the dev machine (no Docker/Supabase); CI covers them.
