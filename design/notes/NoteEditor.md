# Note editor (`app/(app)/notities/[noteId]/`)

- **Code:** `page.tsx` (Server Component, `getNote(noteId)`), `NoteEditor.tsx`
  (`"use client"`, the whole page body), `loading.tsx` (Suspense fallback,
  `PageSkeleton.tsx`'s new `NoteEditorSkeleton`), `lib/notes/extensions.ts`
  (the fixed TipTap extension whitelist, Architecture §133), a small
  `.tiptap p.is-editor-empty:first-child::before` rule in `app/globals.css`
  (Placeholder's own documented CSS mechanism — no Tailwind utility covers
  `content: attr(...)`).
- **Node IDs (measured 2026-08-13 via the `figma-console` bridge,
  `boundVariables`/`componentProperties` on every node — never inferred from
  a resolved value):** `Desktop/Notes/Edit` `3934:33463`, `Mobile/Notes/Edit`
  `3934:33422`, their shared `Main` content frames `3934:33465`/`3934:33423`,
  desktop `Header` `3978:14807` (back `3978:14820`, delete wrapper
  `3978:14808` → delete button `3978:14809`), mobile `Header` `3934:33425`
  (back `3934:33426`, delete wrapper `3978:14838` → delete button
  `3978:14839`), desktop `EditingBar` `3978:14138`, mobile `EditingBar`
  `3978:14870`, desktop `Content` `4067:20020` (placeholder text
  `4067:20021`), mobile `Content` `3978:14850` (placeholder text
  `4067:20017`). The mobile Main's own standalone `Button/Default`
  (`3934:33424`, at `x:16,y:16`) is **not** part of this page — position and
  size are identical to `AppShellNav.tsx`'s own mobile hamburger button,
  confirming it's the Figma frame's illustration of that shell-level control,
  not a second back button.

## Anatomy, confirmed structurally identical across breakpoints

Both headers are `SPACE_BETWEEN` rows with exactly two children: an
icon-only back button (`Button/Default`, `Style=Filled`, icon-swap key
`3648:405` — confirmed via `figma.getNodeByIdAsync` to be `Icon/Arrow-left`,
not inferred from the ticket table alone) and a "Verwijderen" button
(`Style=Destructive`, `With text=true`, icon-swap key `3693:3409` →
confirmed `Icon/Trash`). Both are plain `Button/Default` component instances
(padding/radius/fill all bound to `spacing/component/padding-sm`,
`radius/control`, `color/surface/secondary/default` for Filled and
`color/surface/highlight/red/default` for Destructive) — the same tokens
`components/atoms/Button.tsx` already reads via its `variant="filled"`
(default) / `variant="destructive"` classes, so no new binding, no new
component. `Button` icon="ArrowLeft"` / `<Button variant="destructive"
icon="Trash">` is a direct, literal translation.

The delete button's own wrapping "Knoppen" frame (`3978:14808` desktop,
`3978:14838` mobile) has exactly one child and `HUG` sizing — its own
`itemSpacing:20` has no visual effect with a single child, so it isn't
reproduced; the button renders as a direct child of the header row.

## Three derivations recorded per the ticket

1. **No title field → the title is the document's first line.** Not this
   page's concern — `deriveTitle` (`lib/notes/document.ts`, #228) already
   runs server-side inside `updateNoteContent` (`app/(app)/notities/
   actions.ts`), which this page calls unchanged. Nothing here parses or
   displays a title.
2. **No save button → autosave**, debounce **1000ms**
   (`AUTOSAVE_DEBOUNCE_MS`, `NoteEditor.tsx`). Chosen over the 300ms already
   used for `/notities` search (`lib/notes/search.ts`) deliberately — that
   number optimizes for perceived-instant *read* feedback on a cheap `ilike`
   query; a *write* to `notes` benefits more from coalescing a whole typing
   burst (keystrokes land 100–300ms apart) into one round trip than from
   shaving the write's own latency, and there's no save indicator to make a
   long window feel laggy either way (the ticket explicitly forbids
   building one). 1000ms is short enough that the exposure window — the
   time between a keystroke and a durable write, if the tab is killed
   *without* triggering `visibilitychange`, which is rare but not
   impossible — stays small. `content`, `content_text` and `title` are
   written together in the one existing `updateNoteContent` call (#228
   already enforces this — the action has no schema that accepts `title`
   alone). Flushed unconditionally (bypassing the timer) on this
   component's own unmount (in-app route navigation) **and** on
   `document.visibilitychange` turning `"hidden"` (tab switch, app
   backgrounding, browser close) — the two together cover every way the
   page can be left; neither alone does (an in-app navigation doesn't fire
   `visibilitychange`, and a hard tab close doesn't reliably run React's
   unmount cleanup).
   - **No optimistic "Opgeslagen" indicator, by design** — the ticket names
     `AnimatedAddToBasketButton` as the precedent to not repeat (an
     optimistic success animation masked a fully broken write path for a
     whole ticket, `docs/open-questions.md`'s winkelmand entry). Only the
     failure path renders anything (`saveError`, a `text-priority-urgent`
     line, same token/pattern `RecipeDetailPage.tsx`'s `deleteError` already
     uses) — silence is the happy path, exactly per the ticket's "bouw er
     ook geen 'Opgeslagen'-melding bij."
   - The fire-and-forget flush calls from unmount/`visibilitychange` cannot
     show an error (there's no mounted UI left to show it on) — accepted;
     the debounced in-session path is where "fail visibly" applies, and it
     does (`setSaveError(!result.success)` on every debounced write).
3. **No category picker → the category is fixed at creation.** A note is
   only ever created via `/notities`'s column `Plus` (`NotitiesBoard.tsx`,
   #230/#233 handoff), already inside a specific category; moving one
   happens by dragging the card back on the overview, never from this page.
   Nothing here reads or writes `category_id`.

## Two readings recorded per the ticket

- **The desktop frame's `Sidebar` instance draws `Collapsed=Yes`
  (`3632:460`)** — this is the state the frame happened to be drawn in, not
  a prescription to force-collapse on note open. `NoteEditor.tsx` renders no
  sidebar logic at all (that's `AppShellNav.tsx`'s own state, untouched by
  this ticket) — the frame's collapsed drawing has zero code consequence
  here, recorded only because the ticket asked it to be.
- **The back button's invisible text slot holds the placeholder string
  `"Categorie"`** (component property `Text#3632:5`, confirmed via
  `componentProperties` on both `3978:14820`/`3934:33426`) — copy-paste
  residue from wherever this `Button/Default` instance was duplicated from,
  not a label. The button renders icon-only (`With text=false`), so this
  string never reaches the DOM; `Button.tsx`'s icon-only branch requires
  `aria-label` instead, which the ticket separately asks for as a real
  next-intl string (`components.noteEditor.backLabel`, "Terug naar
  notities" / "Back to notes") — unrelated to the Figma placeholder text.

## Delete: reused, not invented — recorded as an open question

No confirmation state is drawn for either delete button anywhere in
`Pages/Notities/Breakpoints`. Per the ticket's own instruction, reused the
existing two-step confirm pattern verbatim — the same in-place button-row
swap `RecipeDetailPage.tsx`'s header already uses (the
`components.noteEditor.deleteConfirmLabel` question line + cancel +
destructive confirm replace the single delete button; `isPending` disables
both buttons and swaps the confirm button's label to `"Verwijderen..."`),
itself the same shape `NoteCategoryPanel.tsx`/`CategoryPanel.tsx` use for
their own delete step. **The question line is part of the pattern, not
decoration** — every one of the five existing confirm rows in this codebase
renders it, and it is the only thing that names *what* is about to be
deleted irreversibly; a first draft of this file shipped the button row
without it and left the (already translated) key unused in both catalogs.
Filed: `docs/open-questions.md#notes-delete-has-no-confirmation`.

## Token bindings measured (figma-console bridge, `boundVariables`)

| Element | Property | Bound variable | Tailwind |
| --- | --- | --- | --- |
| `Main` (`3934:33465`/`3934:33423`) | `itemSpacing` | `spacing/layout/page-stack` | `gap-page-stack` (already applied by the page's own root wrapper, same as `RecipeDetailPage.tsx`) |
| `Main` | `paddingLeft`/`Top`/`Right`/`Bottom` | `spacing/layout/page-padding-*` | Already supplied by `AppShellNav.tsx`'s `<main>` (left/top/bottom) + this page's own `pr-page-right-equal` (right) — same split every other page in this route group uses |
| Back/Delete buttons | padding, radius, fill | `spacing/component/padding-sm`, `radius/control`, `color/surface/{secondary,highlight/red}/default` | Already `Button.tsx`'s own `variant="filled"`/`"destructive"` classes — no new binding |
| Mobile `Content` (`3978:14850`) | `itemSpacing` | `spacing/stack/stack-md` (12px) | Not reproduced — the wrapper renders a single child (`<EditorContent>`), so a gap between siblings has no visual effect; recorded for completeness only |
| Placeholder text (`4067:20021`/`4067:20017`) | `fills`, `fontSize`, `fontWeight`, `lineHeight`, `fontFamily` | `color/text/base/placeholder`, `font/size/base`, `font/weight/semibold`, `font/leading/6`, `font/family/sans` | `text-base font-semibold` (Tailwind's built-in pairing, `font/leading/6` = `text-base`'s default line-height) + `text-text-placeholder`; the CSS placeholder rule in `app/globals.css` reads `var(--color-text-placeholder)` directly since it's outside Tailwind's utility layer |

The editor's real (typed) text reuses the same `text-base font-semibold`
pairing with `text-text-primary` instead of the placeholder token — no
separate Figma node draws "typed" text (the frame only ever shows the empty
placeholder state), so this is the direct, undesigned-but-obvious
continuation of the placeholder's own type scale, not a separate
measurement.

## `spacing-flag`s in `NoteEditor.tsx`

1. **Header row `gap-4`** — `itemSpacing:16` on both `Header` nodes has an
   empty `boundVariables` (unbound), and the layout is `SPACE_BETWEEN`
   regardless (Figma doesn't apply/bind `itemSpacing` under space-between,
   same finding `CardContentNote.md` already recorded) — same exact
   situation and same code-only fallback `RecipeDetailPage.tsx`'s own header
   already carries.
2. **Delete-confirm row `gap-4` (outer, question line ↔ buttons) and `gap-2`
   (inner, cancel ↔ confirm)** — transient interaction state, no Figma
   node anywhere draws it; both values copied from `RecipeDetailPage.tsx`'s
   own confirm row rather than re-picked (same precedent as
   `NoteCategoryPanel.tsx`).
3. **`pb-[calc(4rem+env(safe-area-inset-bottom))] md:py-2`** on the content
   wrapper — two distinct reasons on one line:
   - `pb-[calc(4rem+env(safe-area-inset-bottom))]` (mobile only) is a
     **code-only reservation**, not a Figma value: #234's `EditingBar` sits
     `onderaan het scherm` per the ticket, which this page reads as "fixed
     to the bottom of the viewport" (the mobile `EditingBar` node,
     `3978:14870`, measures a total 48px tall) — since #234 isn't built
     yet, there is nothing to measure a real clearance against. 4rem (64px)
     was chosen as a deliberately generous round number clearing the
     bar's own 48px with margin to spare, plus `env(safe-area-inset-bottom)`
     per the ticket's explicit ask (#172's safe-area idiom, `design/notes/
     AppShell.md`) — layered on top of, not instead of, the app-wide
     `pb-page-bottom` (80px, unconditional, `AppShellNav.tsx`) every page
     already carries. #234 owns the bar's real position/height and may
     adjust this reservation once it exists.
   - `md:py-2` mirrors the desktop `Content` frame's own real, *measured*
     `paddingTop`/`paddingBottom` (8px, node `4067:20020`) — a genuine
     Figma value, just unbound (`boundVariables: {}`) — 8px is
     `spacing-stack-sm`/`spacing-component-sm` value-identical (both equal
     8px in this token scale), exactly the "a resolved value never
     identifies a token" trap this repo's guide warns about twice already
     (#204/#213), so it stays a raw `py-2` (Tailwind's own `2 * 4px = 8px`
     step) rather than guessing which semantic name it would bind to.

## TipTap setup

- **Version installed: 3.30.0** (`@tiptap/react`, `@tiptap/pm`,
  `@tiptap/starter-kit`, `@tiptap/extensions`, `@tiptap/extension-text-align`,
  `@tiptap/extension-highlight`, `@tiptap/extension-superscript`,
  `@tiptap/extension-subscript`) — checked against the installed
  `@tiptap/starter-kit`'s own `dist/index.d.ts` (`StarterKitOptions`), not a
  doc example: **v3's StarterKit already bundles `@tiptap/extension-link`
  and `@tiptap/extension-underline`** as first-class options (a real split
  from earlier majors, per the ticket's own warning to check the installed
  version). The only marks/nodes the ticket names that are genuinely absent
  from StarterKit are `TextAlign`, `Highlight`, `Superscript`, `Subscript` —
  the four actually installed as separate packages. `Placeholder` also moved
  in v3: it now lives in the consolidated `@tiptap/extensions` package
  (alongside `Dropcursor`/`Gapcursor`/`UndoRedo`, all three already bundled
  inside `StarterKit`) rather than its own `@tiptap/extension-placeholder`
  — installed explicitly as a direct dependency since `NoteEditor.tsx`
  imports from it directly (it was already present transitively via
  `StarterKit`, but an undeclared direct import on a transitive resolution
  is fragile).
- **`lib/notes/extensions.ts`** is the Architecture §133 fixed whitelist —
  `StarterKit` + `TextAlign.configure({types:["paragraph","heading"]})` +
  `Highlight` + `Superscript` + `Subscript`. `Placeholder` is deliberately
  **not** in this shared array: it's editor-only UI (a translated string),
  not content structure, and a future read-only renderer has no empty state
  to show — it's added at the `useEditor()` call site in `NoteEditor.tsx`
  instead, configured with the next-intl `placeholder` string. #235 (tables)
  extends `TextAlign`'s own `types` array to include `tableCell`/
  `tableHeader` here, and adds the table extensions themselves here — one
  file, one array, never a second whitelist.
- **`immediatelyRender: false`** on `useEditor` — required in the App
  Router or the server render and the client's first paint disagree
  (confirmed via Context7 against TipTap's own Next.js install guide, not
  assumed from memory).
- **Performance isolation**: `useEditor` is called once, inside
  `NoteEditor.tsx`, which is the *only* client component on this page today
  — there's no derived UI yet to isolate it from. The isolation the ticket
  asks for is structural, for #234/#235 to build against: the `editor`
  instance this hook returns is exactly what a future `<EditingBar editor=
  {editor} />` would receive as a prop and subscribe to via `useEditorState`
  (not by re-deriving its own `useEditor` call, and not by lifting `editor`
  into broader page state that would force `NoteEditor.tsx` itself to
  re-render on every toolbar-relevant transaction beyond what `useEditor`
  already re-renders for). No code exists yet to prove this — recorded so
  #234 doesn't have to re-derive the shape.
- **No renderer built** — `lib/notes/extensions.ts` is written to be reused
  by one, but nothing in this codebase reads `notes.content` for display
  yet (the overview card only ever reads `content_text`, #228/#229). Noted
  so the "used by the editor and any future renderer" framing in the file's
  own header isn't mistaken for something already wired up twice.

## #263 — `.tiptap` content CSS (heading/list/blockquote/code-block "did nothing")

Feedback: toggling heading, list, block-quote or code-block from `EditingBar`
appeared to do nothing, while bold/italic/highlight visibly worked.

**Confirmed before building anything** (per the ticket's own instruction):
`lib/notes/extensions.ts` loads `StarterKit`, which registers heading,
bulletList/orderedList/listItem, blockquote and codeBlock/code out of the
box, and `EditingBar.tsx`'s command table calls the right TipTap commands
(`toggleHeading`, `toggleBulletList`, `toggleBlockquote`, `toggleCodeBlock`)
against them. Toggling each and reading `editor.isActive(...)` confirms the
document model genuinely changes — the marks/nodes apply correctly. **No
extension was broken, missing, or mis-wired.** The actual gap: `app/
globals.css` had exactly one rule for editor content (the `#233`
placeholder pseudo-element) and nothing else — Tailwind's preflight resets
every heading to `inherit` font-size and strips `ul`/`ol`'s `list-style` and
padding, and this page's own editor root (`text-base font-semibold
text-text-primary`, above) applies one flat size/weight to the whole
document regardless of node type. A toggled `<h1>`, `<li>`, `<blockquote>`
and `<pre>` all rendered pixel-identical to a plain `<p>` — the state was
right, nothing on screen showed it. Bold/italic/underline/highlight are
unaffected because those are inline marks TipTap renders as `<strong>`/
`<em>`/`<u>`/`<mark>`, which either carry their own native default styling
(`<strong>`/`<em>`) or get one explicit rule already (`<mark>` — see below) —
they were never silent.

**Fix: one `.tiptap` block added to `app/globals.css`**, directly below the
`#233` placeholder rule — kept there rather than a separate file/`@layer`
because that's already this codebase's one home for editor-content CSS that
can't be expressed as a utility class on generated TipTap HTML (the
placeholder rule couldn't be either, for the same reason: `content:
attr(...)` has no Tailwind utility). Per explicit user decision, kept
**minimal and token-bound** — not the richer alternative considered (e.g. a
tinted `<code>` background) — so every ruling below states the token used
and, where none exists, why:

- **`h1`/`h2`/`h3` — distinguished by size only**, not weight: the editor
  root is already `font-semibold`, so re-bolding headings would add nothing.
  `h1: 1.25rem` deliberately matches `PageHeader.tsx`'s own `<h1
  className="text-xl ...">` — the one heading size already established
  elsewhere in this app. `h2`/`h3` step down (`1.125rem`/`1rem`, Tailwind's
  own `text-lg`/`text-base` values). **`app/theme.css` has no font-size
  token at all** (only colour/spacing/radius are generated) — these three
  values are Tailwind's own scale steps, not invented numbers, flagged
  inline with `spacing-flag` + this file, per `docs/guides/ui-components.md`'s
  escape-hatch convention (this marker isn't mechanically gated here —
  `check:raw-spacing` only scans `.tsx` under `components/`/`app/`, not CSS,
  per the ticket's own warning not to be lulled by that — but the same
  documented-exception shape was used anyway for consistency).
- **`ul`/`ol`**: `list-style: disc`/`decimal` restores what preflight
  strips; `padding-inline-start: var(--spacing-stack-lg)` (16px) gives the
  markers room without reproducing the browser's much wider 40px UA default.
  The toolbar's list button stays `toggleBulletList` — per the ticket's own
  confirmation, no separate ordered-list button was added; `ol` styling
  exists only for pasted/loaded content that already contains one.
- **`blockquote`**: `border-inline-start: 2px solid
  var(--color-stroke-primary)` + `padding-inline-start:
  var(--spacing-stack-md)` (12px). The `2px` border-width is **not** treated
  as a spacing-scale value needing a token — no border-width token exists
  anywhere in this codebase (`Button.tsx`/`InputField.tsx` both just use
  Tailwind's bare `border` utility, an untokenized 1px default); 2px is the
  same class of native/structural choice, flagged the same way as the
  heading sizes above.
- **`pre` (codeBlock)**: `background-color: var(--color-surface-secondary)`,
  `border-radius: var(--radius-card-inner)`, `padding:
  var(--spacing-component-sm) var(--spacing-component-md)`, monospace via
  `var(--font-mono, ui-monospace, monospace)` (Tailwind v4's own built-in
  `--font-mono`, emitted by `@import "tailwindcss"` itself — not a project
  token from `app/theme.css`, but a `var()` reference to the same value the
  `font-mono` utility class would apply, not a hardcoded stack), `white-space:
  pre-wrap` + `overflow-x: auto` so a long unwrapped line scrolls instead of
  blowing out the page width.
- **inline `code`**: monospace only, **no background** — the richer option
  considered (and rejected, per user decision) would have given it its own
  tinted background the way `pre` has; inline code stays visually quiet.
- **`a`**: `text-decoration: underline`, no colour — Link is already
  installed (StarterKit, v3) but no link colour is invented here (would need
  a design source this file doesn't have).
- **`mark` (Highlight)**: bound to `var(--color-surface-highlight-yellow)` /
  `var(--color-text-highlight-yellow)` — the browser's unstyled `<mark>`
  default is a raw, non-token yellow, so this rule is *removing* a raw value
  already present by default, not adding new styling.
- **`hr`**: `border-top: 1px solid var(--color-stroke-lines)`, no fill.
- **Inter-block spacing**: `.tiptap > * + * { margin-top:
  var(--spacing-stack-md); }` — top-level siblings only (deliberately not a
  descendant selector), so nested content (e.g. a `<p>` inside a
  `<blockquote>`) doesn't pick up extra spacing it wasn't asked for.

**Explicitly out of scope**: no `table`/`th`/`td`/`.tableWrapper` rules —
`TableKit` is already wired (`#234`, pulled forward from `#235`), but the
CSS for rendering a table is `#235`'s own ticket, landing in a follow-up PR
on this exact same `.tiptap` block.

**No Figma source for any of this.** `Pages/Notities/Breakpoints`
(`3934:32790`) draws the toolbar and an empty/placeholder editor body only —
no frame shows a heading, list, quote or code block actually rendered
inside a note. Filed: `docs/open-questions.md#notes-prose-typography-not-
designed`.

## Verification — what was and wasn't run

`pnpm lint`/`typecheck`/`test`/`check:server-only`/`check:raw-spacing`/
`check:comment-budget`/`build` all run and green; `pnpm test:visual` run in
full (110 passed, zero baselines regenerated — this ticket touches no
`components/` file and adds no Ladle story). **Not run: a real authenticated
`/notities/[noteId]` visit** — typing, the debounce, the `visibilitychange`/
unmount flush paths, and the delete flow are all reasoned/typechecked
against `updateNoteContent`/`deleteNote` (#228, already exercised by
`tests/notes-document.test.ts`) but never exercised against live Supabase or
a real browser tab-close. Same standing gap `NotitiesBoard.md`'s own
verification section already carries for this phase (`docs/HANDOFF.md`'s
#185) — this ticket adds the same caveat for its own new surface rather than
claiming a stronger guarantee.
