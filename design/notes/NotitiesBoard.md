# /notities page (`page.tsx` + `NotitiesBoard.tsx`)
Figma: `Pages/Notities/Breakpoints` section `3934:32790` · desktop `Main/Desktop` `4067:18615` · mobile `Mobile/Notes/Overview` `4067:18157` · header "Knoppen" `4067:19270` (desktop) / `4067:19271` (mobile) · mobile search `Input-field` `4067:18163` (Selected `4067:19525`) · results list `4067:19985` · no-results text `4067:19998` · Code: `app/(app)/notities/` (`page.tsx`, `notes-data.ts`, `NotitiesBoard.tsx`, `loading.tsx`) + `lib/notes/{timestamp,sort,search}.ts`

## Anatomy
Not a new organism: `BoardView` with `renderItem` returning `CardContentNote` (`design/notes/CardContentNote.md`), like `/recepten` and `/te-doen`. Header and board share one client file: the header "Categorie" button and every column pencil drive one `categoryPanel` state (`{ open, target }`) of the shared `CategoryPanel` (`design/notes/CategoryPanel.md`).

- `page.tsx` is a Server Component: `?sort=` and `?q=` are read outside the data `<Suspense>`; only the fetch streams (two stages: header-only skeleton until column counts are in, then the board; `design/notes/Skeletons.md`). Own Web App Manifest (#390, `design/notes/AppShell.md`).
- `NotitiesBoard` gets one `data` prop, `NotitiesPageData`, a discriminated union `{ mode: "board"; categories; sort } | { mode: "search"; query; results }` built by one loader. A `?q=` passing `effectiveNotesSearchQuery` wins; `sort` is unread in search.
- Header actions: Sorteer, Categorie, (desktop only) search field. Gap is `gap-inline-sm md:gap-inline-xl` (Figma itemSpacing 8 / 20, both bound). On mobile the search field is its own full-width row below the header (`pr-page-right-equal`, since `main` supplies only left padding). Vertical rhythm is `main`'s existing `gap-page-stack` (the NoResults frame's 24px gap is unbound; no new spacing added).
- Search results (`mode: "search"`): flat `gap-stack-sm` list of `Card` + `CardContentNote`, no columns or carousel (4067:19985). Empty result: centered "Geen resultaten gevonden" in `text-base font-semibold text-text-secondary`, no illustration or button. Header and search field stay mounted during search; only the body switches.
- Empty category reuses `CardContainer`'s `emptyState` (no Notities-specific Figma reference).
- Column icon: free text guarded by `isIconName`; fallback `Notebook` (the Sidebar's Notities icon).
- Category names are data, never translation keys; the title is the fixed label `nav.notes`.

## Deliberate decisions
- Sorteer is two real `Button`s (icon-only with `aria-label` on mobile, labelled on desktop), not one with CSS-hidden text: Figma draws two distinct instances (40x40 vs 120x40) and `Button`'s icon-only and labelled branches already model that. Only Sorteer goes icon-only on mobile; Categorie keeps its text. Visibility is a plain `md:hidden` / `hidden md:inline-flex` className, which works because `Button` merges with `cn()` (#289, history in `docs/incidents.md` 2026-08-16). (#230)
- Sort options are only `createdAt` and `alphabetical` (`NOTE_SORT_OPTIONS`); a note has no priority or size axis. Sorting reorders in memory and never touches `position`. `dragDisabled={sort !== null}` because a drop index is meaningless against a sorted view (same as `design/notes/TeDoenBoard.md`). `created_at` is on `NoteSummaryRow` for this. (#230)
- Drag persists through `moveNote` (`public.move_note`, ADR-0015) with `applyItemMove<NoteSummaryRow, "notes", CategoryWithNotes>`. `pendingMoves` is a count and `moveQueue` serializes calls; no `router.refresh()` on success. As `design/notes/ReceptenBoard.md`. (#230)
- Card click goes to `/notities/[noteId]`; Figma draws no prototype link. Column "+" creates an empty note in that category and navigates to its editor: the only place a note can originate, since the editor has no category picker. (#230)
- Timestamp helper `lib/notes/timestamp.ts` returns a discriminated result (`today` with time, `yesterday`, `older` with date) rather than taking a translated word: it stays framework-free like every other pure `lib/` helper, tests need no i18n setup, and "which tier" is separate from "which word" (`notes.timestamp.yesterday`). `NotitiesBoard.formatTimestamp` does the translation. (#230)
- Timestamp uses manual `padStart` (`HH:MM`, `dd-mm-yyyy`), not `Intl`; one locale exists, and `dd-mm-yyyy` is a Dutch convention, so a second locale needs a locale parameter. It runs client-side, so "today/yesterday" is the browser's local calendar day, not UTC. The card shows `updated_at` ("last edited"); `created_at` is only for the Aanmaakdatum sort. (#230)
- Search: query lives in `?q=` (shareable, server-rendered, `searchNotes` called directly from `notes-data.ts`, no extra server action). Minimum 2 characters (`NOTES_SEARCH_MIN_QUERY_LENGTH`, no design source: one character over `ilike` is near-random), 300 ms debounce (`NOTES_SEARCH_DEBOUNCE_MS`, same as `IngredientSearchPanel`). Textual only; semantic search is Phase 8 (#31). (#231)
- No loading state during search (the design shows none): `router.replace` runs inside `startTransition`, which keeps the previous tree mounted instead of flashing `BoardSkeleton`. `replace`, not `push`, so keystrokes do not fill history; `goWithSort` uses `push` and preserves `?q=` so picking a sort does not silently leave search. (#231)
- Search animation is derived state, not a timeline: `contentVisible = effectiveQuery === committedQuery`, where `committedQuery` is what the server last rendered and `effectiveQuery` is the thresholded input. One opacity crossfade wraps board, results and no-results (`duration-base ease-base motion-reduce:transition-none`). Deviation from the ticket storyboard: typing below the minimum length while the board shows fades nothing (both values are `""`), to avoid flicker on every attempt to start a search. (#231)
- `NotesSearchField` is a private component in `NotitiesBoard.tsx` built on `InputField` (no distinct Figma component), rendered twice (desktop and mobile) with no visible label (Figma `Title:false`). Two literal JSX branches (with/without trailing X) because `InputField`'s `onTrailingIconClick` / `trailingIconLabel` are a paired union. The desktop width lives on a wrapper `md:w-60 md:shrink-0`, because `InputField`'s root hardcodes `w-full` and two width utilities on one element have no guaranteed winner. (#231)
- Sort dropdown uses `usePopoverPosition` (`anchor: "right"`, `prefer: "below"`), `docs/incidents.md` 2026-08-18.

## Token gaps and flags
- Desktop search frame `4109:16063` is a hand-rebuilt frame, not an `Input-field` instance. Its Container tokens match the mobile instance exactly, so `InputField` needed no change. Only the 240px width (`w-60`, an exact Tailwind step) rests on this frame alone. Its hidden Slot holds a leftover "Categorie" button that is never rendered. (#231)
- The clear (X) button has no Figma hover or active state; it reuses Button's `rounded-control` and `transparent` tokens (`design/notes/InputField.md`). (#231)
- `Mobile/Notes/Overview/01` (`4067:19334`) duplicates `4067:18157`; not built.
- No `spacing-flag`: every gap is bound.

## Gotchas
- Hooks cannot branch on `data.mode` (it changes across navigations on the same instance), so `localCategories`, `pendingMoves` and `moveQueue` are always declared; `localCategories` only syncs from `data.categories` in board mode and when no move is pending.
- `CategoryPanel` sits outside the fade wrapper on purpose: it is an overlay with its own transition and must not inherit the search opacity.
- No Ladle story (needs Next router hooks); the assembled search page is not visually baselined, only `InputField`'s `ClearableSearch` and the `Card` / `CardContentNote` stories.
- `seed_default_note_categories()` is an `after insert on auth.users` trigger: accounts that predate it have no categories and show no columns until one is created.

## Open
- `docs/open-questions.md#notes-desktop-searchfield-detached`
- `docs/open-questions.md#notes-search-clear-button-states-undesigned`
- `docs/open-questions.md#notes-overview-duplicate-mobile-frame`
- `docs/open-questions.md#notes-category-panel-not-designed`
