# Note editor (`app/(app)/notities/[noteId]/`)

- **Code:** `page.tsx` (Server Component, `getNote(noteId)`), `NoteEditor.tsx`
  (`"use client"`, the whole page body), `loading.tsx` (Suspense fallback,
  `skeletons/NoteEditorSkeleton.tsx`), `lib/notes/extensions.ts`
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
itself the same shape `CategoryPanel.tsx` use for
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
| Placeholder text (`4067:20021`/`4067:20017`) | `fills`, `fontSize`, `fontWeight`, `lineHeight`, `fontFamily` | `color/text/base/placeholder`, `font/size/base`, `font/weight/semibold`, `font/leading/6`, `font/family/sans` | `text-base font-semibold` (Tailwind's built-in pairing, `font/leading/6` = `text-base`'s default line-height; the typed text is `font-medium` since #386) + `text-text-placeholder`; the CSS placeholder rule in `app/globals.css` reads `var(--color-text-placeholder)` directly since it's outside Tailwind's utility layer |

The editor's real (typed) text uses `text-base font-medium` (#386; was
`font-semibold`, headings and bold marks keep their own weights) with
the same size with `text-text-primary` instead of the placeholder token — no
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
   `CategoryPanel.tsx`).
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
padding, and this page's own editor root (`text-base font-medium
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
  root is a flat `font-medium`; headings carry their own bold/extrabold weight in `globals.css`.
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

## #235 — table CSS (on the same `.tiptap` block)

`TableKit` was already wired into `lib/notes/extensions.ts` and the
`EditingBar` table button already calls `insertTable({ rows: 3, cols: 3,
withHeaderRow: true })` (both pulled forward by #234). This ticket adds
only the rendering: table/`td`/`th`/wrapper/selection rules, appended
directly below the `.tiptap > * + *` rule #263 left this block ending on —
one `.tiptap` block, not a second, competing one. Per user decision, kept
**minimal and token-bound**, same instruction #263 already followed. Every
rule reads a real token from `app/theme.css` — no raw hex, no raw px
spacing, including in comments (`pnpm check:raw-spacing` only scans `.tsx`
under `components/`/`app/`, not this CSS file — the ticket's own warning,
not a loophole used here).

- **`.tiptap table`**: `border-collapse: collapse`, `width: 100%`. **No
  margin declared here**, a deliberate deviation from a literal reading of
  "vertical margin on `table`": TipTap's editor `TableView` (verified
  against the installed `@tiptap/extension-table@3.30`'s own
  `dist/index.js`, not the docs site — `this.dom.className =
  "tableWrapper"`, `addNodeView()` returns this view unconditionally) always
  wraps the rendered `<table>` in `div.tableWrapper`, which is the real
  direct child of `.tiptap`. That wrapper already inherits `margin-top` for
  free from `.tiptap > * + *`, the same way `h1`/`ul`/`blockquote`/`pre`/`hr`
  above it do — none of those declare their own margin either. Giving
  `table` its own margin on top of that would land inside a box that's
  about to get `overflow-x: auto` (below), and any non-`visible` overflow
  value creates a new block formatting context — which stops a child's
  margin from collapsing into its parent, so the declared margin would
  either double the visible gap (if it could still escape) or get trapped
  inside the scrollable wrapper and produce no spacing at all (it can't
  escape). Either way, wrong. Reasoned from the CSS box-model spec
  (parent/child margin collapsing + the overflow/BFC interaction), not
  guessed — this is standard, documented CSS behaviour, unlike the
  library-specific class names below, which *were* checked against the
  installed `dist` rather than reasoned.
- **`.tiptap .tableWrapper { overflow-x: auto; }`** — the mobile-overflow
  requirement: a table wider than the viewport scrolls horizontally instead
  of blowing out the page width. Targets the wrapper, not `table`, for the
  same reason as above.
- **`.tiptap td, .tiptap th`**: `border: 1px solid var(--color-stroke-lines)`,
  `padding: var(--spacing-stack-xs) var(--spacing-inline-sm)`,
  `vertical-align: top`. Padding is axis-correct on purpose:
  `--spacing-stack-*` (block/vertical) for the shorthand's top/bottom slot,
  `--spacing-inline-*` (inline/horizontal) for its left/right slot — both
  groups resolve to the same pixel values today, so a swapped axis would be
  pixel-identical and silently wrong, exactly the mistake #263 already
  found and fixed once on this same file (`docs/HANDOFF.md`) — not repeated
  here.
- **`.tiptap th { background-color: var(--color-surface-secondary); }`** —
  **one deliberate step past "minimal"**, flagged as such rather than
  silently added: without its own background a header row is visually
  identical to a body row, which makes `insertTable`'s
  `withHeaderRow: true` silently pointless — the exact "state is correct,
  nothing on screen shows it" bug class #263 point 3 fixed for
  heading/list/blockquote/code. One existing semantic token
  (`surface-secondary`), no new token invented, no new design.
- **`.tiptap .selectedCell`** — the selected-cell background. Class name
  verified against the installed `prosemirror-tables@1.8.5`'s own
  `dist/index.js` (`Decoration.node(pos, pos + node.nodeSize, { class:
  "selectedCell" })`, applied directly to the selected `td`/`th`), not
  assumed from a doc example. Reuses `--color-surface-highlight-white-
  selected` — the token already named for a persistent "selected" surface
  state elsewhere (`Button.tsx`'s toggled variant), not one of the
  colour-coded highlight tokens (blue/red/yellow), which already carry
  other product meaning (mark highlight, priority). `.selectedCell` (two
  classes) naturally outranks `.tiptap th` (one class, one type) on CSS
  specificity, so a selected header cell still shows the selection tint.
- **Superseded by #330 (below):** `resizable` is now on, and row/column
  editing has a menu and a size picker. No zebra striping (rejected here).

**No Figma source for any of this.** Same gap as the rest of this file's
prose-typography section, restated for tables specifically:
`Pages/Notities/Breakpoints` draws one toolbar button with a table icon and
no table anywhere.

## #329 — block types, task lists and prose typography (Claude-designed on request)

Replaces the #263 minimal block (`notes-prose-typography-not-designed`,
now resolved). User decision 2026-10-10 (ADR-0021 s1/s3): Claude designs it
directly in code from Tailwind's type scale + semantic tokens; no Figma step.

- **Extensions** (`lib/notes/extensions.ts`): StarterKit `heading.levels`
  `[1,2,3]`; `TaskList` + `TaskItem({ nested: true })` from
  `@tiptap/extension-list@3.30.0` (a direct dependency now, same version as
  core; not part of StarterKit). `a11y.checkboxLabel` returns the item's own
  text because the default label is an English literal and the whitelist is
  static (no next-intl); the checkbox is named after its task.
- **Type scale** (`.tiptap` in `app/globals.css`, `@apply` of Tailwind's own
  scale; body stays `text-base font-semibold`, the measured Figma value):
  H1 `text-3xl font-extrabold`, H2 `text-2xl font-bold`, H3 `text-xl
  font-bold`; headings `leading-tight`/`leading-snug`, body `leading-relaxed`
  (1.625). Sizes step 20/24/30px against 16px body; weight steps 600 -> 700
  -> 800 so they are distinct in both axes.
- **Rhythm**: blocks keep `--spacing-stack-md`; a heading adds space above
  (`stack-lg` H3, `stack-xl` H2, `stack-xxl` H1); list items `stack-xs`.
- **Reading width**: `.tiptap { max-width: 70ch }`; on mobile the viewport is
  the limit.
- **Task items**: the native checkbox (`appearance: none`) wears the Checkbox
  atom's tokens (`stroke-primary` border, `surface-highlight-white` fill,
  `text-secondary` check glyph, hover `stroke-primary-hover`, focus ring
  `stroke-primary-selected`) at 1.25rem (Tailwind `size-5`; the atom's 2rem box
  is too big for a text line). Checked items: `text-secondary` + line-through
  on the item's own paragraph only. Selector is `li[data-checked]`: TipTap's
  node view renders `li` without `data-type` (only `getHTML()` has it).
  Check glyph is a CSS mask of lucide's `check` path, so it follows the token
  colour in dark mode.
- **`toPlainText`**: `taskItem` is a line-ending type, **no `☐`/`☑` prefix**
  (decision): a prefix would leak into `deriveTitle` when a note starts with a
  checklist and add noise to trigram search. Covered in
  `tests/notes-document.test.ts`; input rules, nested lists, JSON round trip
  and legacy H1+bullet notes in `tests/notes-extensions.test.ts` (jsdom).
- **Token gaps**: no font-size/weight tokens exist (flagged:
  `docs/open-questions.md#notes-prose-font-scale-no-tokens`); the 1.25rem
  checkbox box, the 2px focus outline and `70ch` are raw CSS in `globals.css`
  (not gated, not a spacing/radius token concept).

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

## #330 — tables: stable columns, resizing, size picker, table menu (Claude-designed on request)

Resolves `notes-table-ui-not-designed` (user decision 2026-10-10, ADR-0021
s1/s3). Built from existing components and semantic tokens; no Figma step.

- **Stable layout**: `TableKit.configure({ table: { resizable: true,
  cellMinWidth: TABLE_CELL_MIN_WIDTH (96) } })` and `table-layout: fixed` on
  `.tiptap table`. Under `auto` layout the browser re-split the widths on every
  keystroke; with `fixed`, columns keep their width. Columns without a stored
  `colwidth` (every pre-#330 table) share the width equally; once a column is
  dragged, only that column gets a `colwidth` attr (prosemirror-tables
  behaviour) and the table gets an inline width/min-width, so a wide table
  scrolls inside `.tableWrapper` on mobile. `overflow-wrap: anywhere` on cells
  stops a long word from forcing a column wider. Playwright check:
  `tests/visual/table-columns.spec.ts` (widths before/after typing, on both a
  legacy and a sized table; verified to fail with `table-layout: auto`; plus a
  drag-resize check). `colwidth` round trip and legacy load:
  `tests/notes-table.test.ts`. Ladle has no save/reload, so persistence is
  proven at document level, not by reloading a page.
- **Resize handle**: prosemirror-tables' own `.column-resize-handle` (only
  present while hovering/dragging an edge), styled `stroke-primary-hover`,
  width/offset from `spacing-inline-xs`; `.resize-cursor` gives `col-resize`.
- **Header row**: `th` also gets `text-align: left` (browser default was
  centred while body cells were left). `note-editor-content--prose` baselines
  were regenerated for that and for the fixed layout.
- **Table menu** (`components/organisms/TableMenu.tsx`): TipTap `BubbleMenu`
  (`@tiptap/react/menus`, MIT) whose `shouldShow` is `isActive('table')` and
  `(pointer: fine)`, anchored to the table's `.tableWrapper` top-left through
  `getReferencedVirtualElement`. It holds one `Button variant="white"`
  "Table" trigger that opens a portalled `Dropdown role="menu"` with a
  `menuitem` row per `TABLE_COMMANDS` entry. Why a trigger plus panel and not
  ten inline icon buttons: the icon registry has no row/column glyphs (see the
  flag below), and labelled rows read unambiguously. Rows that do not apply
  (`editor.can().x()` false, e.g. merge without a multi-cell selection) are
  `aria-disabled` with `opacity-40`, still focusable. The destructive row is
  `text-priority-urgent` on a transparent row (the filled destructive Button
  is too loud inside a menu). Keyboard: Alt+F10 in a table focuses the
  trigger; Enter/Space/ArrowDown/ArrowUp open; arrows/Home/End move; Escape or
  Tab close; every command and Escape end with focus in the editor.
- **Mobile**: no bubble on touch (it would collide with the keyboard and the
  native callouts); #333 exposes `TABLE_COMMANDS` through the EditingBar.
- **Shared list**: `lib/notes/table-commands.ts` (`TABLE_COMMANDS`,
  `insertTable`, `MAX_TABLE_SIZE`); labels `components.noteTable.commands.*`.
- **Plain text** (`lib/notes/document.ts`): a table row is one line, cells
  tab-separated, a cell's paragraphs joined by spaces, rows without text
  dropped (`tests/notes-document.test.ts`). A note that starts with a table
  now derives its title from the whole first row ("A\tB"), not the first cell.
- **Flagged gaps**: icons are generic reuses (`Plus`, `Minus`, `Heading`,
  `Columns3`, `ArrowRightLeft`, `Trash`) because adding lucide glyphs
  (`BetweenHorizontalStart` etc.) changes the `icon--all-icons` baseline, which
  this ticket may not regenerate; the floating-ui `offset: 8` is a number
  handed to the library, not a class. Missing disabled-state token/style:
  `docs/open-questions.md#button-no-disabled-state`.

## #334 — writing comfort (Claude-designed on request)

- **Typography placement:** `Typography` is wired at the `NoteEditor.tsx` call
  site via `typographyForLocale(useLocale())` (`lib/notes/writing-comfort.ts`),
  like Placeholder. It only adds input rules and changes no stored structure,
  so `lib/notes/extensions.ts` stays the single content-structure source.
  nl: `„ ”` / `‚ ’`; every other locale: `“ ”` / `‘ ’`. Em dash, arrows, ½ etc.
  are the extension defaults; input rules never fire inside code.
  `@tiptap/extension-typography` is pinned to `3.30.0` (= `@tiptap/core`).
- **Word count:** `CharacterCount` (from `@tiptap/extensions`) with `countWords`
  (whitespace split; the default splits on spaces only). Reading time is
  `ceil(words / 200)`, at least 1 once there is text. Strings are ICU plurals
  in `components.noteWordCount`. Shown as a meta line under the editor
  (`NoteWordCount`), desktop and mobile.
- **Save status:** `lib/notes/save-controller.ts` (`SaveController`) owns the
  debounce, in-flight tracking and status; `useNoteSave.ts` binds it to
  `updateNoteContent`. Status becomes "saved" only from a resolved
  `{ success: true }`, a rejected call counts as failure, and a newer edit
  during a write keeps it at "saving". The error state is a destructive Button
  ("Niet opgeslagen — opnieuw proberen") that re-sends the failed snapshot.
  `beforeunload` warns while status is not "saved". `NoteSaveStatus` sits in the
  header row between back and delete (hidden during the delete confirm);
  `EditingBar` is untouched. Tests: `tests/notes-save-controller.test.ts`.
- **TrailingNode:** on by default in StarterKit 3.30 (`trailingNode !== false`);
  covered by `tests/notes-writing-comfort.test.ts`.
- **No new tokens or Figma nodes:** text-secondary / priority-urgent and the
  existing `Button` only. No retry icon exists in `Icon`, so retry is text.

## #332 — slash command menu (Claude-designed on request)

Typing-first block insertion. Built from existing components and semantic
tokens; no Figma step, no new atom.

- **Engine**: official `@tiptap/suggestion` (pinned `3.30.0` = `@tiptap/core`).
  `lib/notes/slash-command.ts` is the `SlashCommand` extension (editor-only UI,
  added at the `useEditor()` call site in `NoteEditor.tsx` next to
  `Placeholder`, not in the content whitelist). It keeps a tiny external
  `SlashStore` in the extension storage; `SlashMenu` reads it with
  `useSyncExternalStore`, so no `ReactRenderer`/`tippy`.
- **Trigger**: `/` only at the start of a block or after a space
  (`allowedPrefixes: [" "]`; `a/b` and URLs never open it) and never inside a
  code block or inline code (`allow`). Items resolve one microtask after the
  keystroke; the menu opens with real items only, so it never flashes "no
  results". "Table" is not offered inside a table cell.
- **Item list**: `lib/notes/slash-items.ts` is the single source (`id`, `icon`,
  `aliases` nl+en, `run`; labels `components.slashMenu.items.<id>`), reused by
  #333; later tickets append items. `filterSlashItems` ignores case, accents,
  spaces and punctuation, matches id, aliases and the translated label, and
  ranks prefix matches first. Tests: `tests/notes-slash.test.ts` (nl/en
  aliases, trigger rules, `/kop2` + select gives an H2 with the typed text
  removed).
- **Menu**: portalled `Dropdown role="listbox"` of transparent `Button
  role="option"` rows; the editor keeps DOM focus (the panel `preventDefault`s
  mousedown, so the iOS keyboard stays open) and carries `aria-expanded`,
  `aria-controls`, `aria-activedescendant`. Arrows wrap, Enter/Tab pick (Enter
  with no results is swallowed), Escape closes, hover moves the highlight.
- **Placement**: under the caret, flipped above when it does not fit, measured
  against `visualViewport` (clears the iOS keyboard, #263) and against the
  fixed mobile EditingBar (a `[role=toolbar]` below the caret is the bottom
  edge). `--menu-x/-y/-max` custom properties as in `EditingBarMenu`;
  `max-h` + scroll when short on room.
- **Table**: picking it deletes the `/table` text, then shows #330's size grid
  at the caret (`TableSizeGrid`, extracted from `TableSizePicker` and shared);
  Escape returns focus to the editor.
- **Placeholder**: "Typ '/' voor opties" / "Type '/' for options".
- **Flagged**: missing glyphs, see `docs/open-questions.md#notes-slash-menu-icon-glyphs-missing`.
## #331 — selection bubble menu and link popover (Claude-designed on request)

Resolves `notes-editingbar-link-no-url-input-designed` (user decision
2026-10-10, ADR-0021 s1/s6). Existing components and semantic tokens only.

- **Bubble menu** (`components/organisms/NoteBubbleMenu.tsx`): TipTap
  `BubbleMenu` above a non-empty `TextSelection` (not blank text), only for
  `(pointer: fine)`, never in a code block, never while the table menu shows
  (`isActive('table')`, so a text selection inside a table gets no bubble).
  Bold, italic, underline, strikethrough, highlight, inline code (icon
  `Button variant="transparent"`, `aria-pressed` = active), link, and "Turn
  into": `EditingBarMenu` fed by the exported `BLOCK_TYPE_MENU` of
  `EditingBar.tsx` (#329's option list, not copied). Button labels reuse
  `components.editingBar.*Label`. `role="toolbar"` with roving tabindex;
  Alt+F10 in the document focuses it, Escape returns to the editor. No bubble
  on touch: the EditingBar remains the mobile surface (#333).
- **Link popover** (`components/organisms/LinkPopover.tsx`), one instance per
  editor (`NoteEditor.tsx`). Bubble menu, EditingBar and Mod-K ask for it via
  `requestLinkPopover` (`lib/notes/link-popover.ts`, a DOM event on the editor
  element), so none needs to know where it is mounted. Cursor on a link: the
  URL plus Open (`window.open(..., "noopener,noreferrer")`), Edit, Remove;
  otherwise an `InputField` with Apply (and Remove when editing). With a
  collapsed cursor and no link, Apply inserts the URL as linked text. Invalid
  input shows `role="alert"` copy and keeps the field. Escape closes and
  returns focus to the editor; Tab cycles inside the panel; an outside press
  closes. Anchor: the EditingBar's link button on desktop, the whole bar on
  mobile (`min-width: 48rem` split; the link button may be scrolled out of
  view), the selection for Mod-K. The panel re-measures on `visualViewport`
  resize, so it follows the bar when the software keyboard lifts it.
- **Link rules** (`lib/notes/link-url.ts`, `tests/notes-link-url.test.ts`):
  one validator for the Link extension's `isAllowedUri` and the popover.
  http, https and mailto only; bare `example.com` gets `https://`, a bare
  address gets `mailto:`; `javascript:`, `data:`, `ftp:`, `//host`, whitespace
  and control characters are rejected. Because the extension uses it too,
  pasted, autolinked and already stored hrefs are filtered: a stored
  `javascript:` link loads as plain text. `autolink: true`, `openOnClick:
  false` (a click never navigates while editing; the popover opens the link).
- **EditingBar**: only the link button changed (it opens the popover; the old
  `window.prompt` and "click unlinks" toggle are gone, `linkPromptLabel`
  removed). `measure()` in `EditingBarMenu.tsx` now takes any rect source.
- **Flagged gaps**: no `ExternalLink`/`Unlink` glyph in the icon registry
  (adding one changes the `icon--all-icons` baseline), so Open reuses `Link`
  and Remove reuses `Trash`, both with visible labels. `updateDelay={150}` on
  the bubble is a number handed to TipTap, not a class.

## Code blocks and collapsible sections (#336, Claude-designed on request)

- **Code block** keeps the node name `codeBlock` and attribute `language`
  (`null` = plain), so stored blocks load unchanged (`tests/notes-code-details.test.ts`).
  StarterKit's is off (`codeBlock: false`); `CodeBlockLowlight` is extended
  with a React node view, `components/organisms/CodeBlockView.tsx`: a labelled
  `Dropdown` (language, collapses on choice, focus back to the editor) and an
  outline `Button` (copy raw `node.textContent`; label "Gekopieerd" plus the
  `Check` glyph for 2s, mirrored in a `role="status"` region). Read-only
  editors show the language as text. The chrome sits above the code inside
  `.code-block` (the surface moved from `<pre>` to the wrapper).
- **Languages** (`lib/notes/code-languages.ts`): plain, javascript, typescript,
  json, css, html (highlight.js `xml`), bash, sql, python, markdown. Each
  grammar is a dynamic `import()`, registered on first use; the node view loads
  its block's grammar, then `rehighlightCodeBlocks` dispatches a
  content-neutral, history-less, update-less transaction (the lowlight plugin
  only recomputes on a doc change). No auto-detection. Bundle evidence: PR #336.
- **Colours**: highlight.js classes in `app/globals.css` mapped to existing
  text tokens only; the palette gap is `code-syntax-colour-tokens`.
- **Details**: `Details` (attr `open`, `persist: true`) > `detailsSummary`
  (text) + `detailsContent` (block+). The toggle is the extension's own
  `<button>` (Enter/Space, aria-expanded, translated label via
  `lib/notes/details-labels.ts`, set by `NoteEditor.tsx`); a text glyph
  rotated in CSS. Collapsed content is only `hidden`, so `toPlainText` and
  search include it. Slash item `details` ("Inklapbare sectie").

## Markdown paste, copy and export (#337)

Claude-designed on request; ADR-0021 s3/s4. Storage stays TipTap JSON, markdown
is only a paste/copy/export format.

- **Lazy by construction**: `lib/notes/markdown.ts` is the only module that
  imports `@tiptap/markdown` (marked + manager, about 60 kB in its own chunk).
  Everything else reaches it through `await import(...)` (paste handler, note
  menu); `tests/notes-markdown.test.ts` fails on any static import.
  `lib/notes/markdown-detect.ts` (sync "looks like markdown?") and
  `markdown-export.ts` (filename, download) are tiny and stay eager.
- **Paste** (`lib/notes/markdown-paste.ts`, registered at the `useEditor` call
  site, not in the content whitelist): only for plain text with a block marker
  (heading, list, task, quote, fence, table separator) and no `text/html`
  flavour; HTML pastes keep ProseMirror's default path. Not inside a code
  block. `handlePaste` is synchronous, so it claims the paste and inserts once
  the chunk has loaded; if loading or validation fails the raw text is
  inserted.
- **Safety**: parsed JSON goes through `sanitizeToSchema` (unknown nodes and
  marks dropped, text kept; link hrefs through `isAllowedLinkUri`; result must
  pass `Node.check()`). Raw HTML in markdown is never interpreted.
- **Serializer entries**: nodes/marks whose extension ships no
  `renderMarkdown` get ONE entry in `MARKDOWN_ENTRIES` (`markdown.ts`), plus a
  fixture in `FIXTURES` (test). Superscript/subscript export as `<sup>`/`<sub>`
  (one-way: read back as plain text). Text alignment, table column widths and
  cell spans have no markdown form and are lost on export.
- **Menu** (`NoteMarkdownMenu`): Ellipsis button in the header, same
  panel mechanics as `TableMenu` (`usePopoverPanel`, `role="menu"`, arrows /
  Home / End, Escape and Tab close, focus returns to the trigger). Copy shows a
  3 s `role="status"` line under the header. Export filename: derived title,
  sanitised by `markdownFilename` (separators and reserved characters
  removed, no leading dots, 100 chars, `Naamloze notitie` when empty).
- **Icons and delete (#386)**: Copy as Markdown = `Copy`, Export = `Download`
  (registered in `Icon.tsx`). "Verwijderen" is the last row after a separator,
  `text-priority-urgent` + `Trash`, and starts the unchanged inline
  `DeleteConfirm` flow (the header no longer has a separate delete button).

## #335 — block drag handle and block menu (Claude-designed on request)

Existing components and semantic tokens only; no Figma source.

- **Handle** (`components/organisms/NoteBlockHandle.tsx`): `DragHandle` from
  `@tiptap/extension-drag-handle-react` (pinned to `@tiptap/core`'s 3.30.0,
  with its `-drag-handle` and `-node-range` peers). It is a UI component that
  registers its own ProseMirror plugin, like `BubbleMenu`, so it is mounted in
  `NoteEditor.tsx` and not listed in `lib/notes/extensions.ts` (that list is the
  content schema). The handle is absolutely positioned left of the hovered
  top-level block (`nested` off), so it takes no layout space and the reading
  column never moves; `noteExtensions` also configures the Dropcursor
  (`.note-dropcursor`, `stroke-secondary-active`). Rendered only for
  `(pointer: fine)`; touch gets nothing (EditingBar is the mobile surface).
  The drag is one ProseMirror transaction, so undo restores it. Dropping inside
  a list nests the block as a list item: that is the editor's own drop rule.
- **Menu**: portalled `Dropdown role="menu"` (the `EditingBarMenu` panel and
  `measure()`). Rows: "Turn into" group (`menuitemradio`, active type checked;
  picking the active one does nothing), then Duplicate, Move up, Move down
  (`menuitem`, disabled at the edges) and Delete. Arrows wrap, Home/End, Escape
  and Tab close and return focus to the editor. The handle is held visible while
  the menu is open by dispatching the plugin's `lockDragHandle` meta.
- **Reuse**: "Turn into" runs the options of `BLOCK_TYPE_MENU` and `LIST_MENU`
  (`EditingBar.tsx`, #329) plus quote and code block from `SLASH_ITEMS`; labels
  are `components.slashMenu.items.*`. Turn into is hidden for tables and other
  non-textblock, non-list/quote blocks (`isConvertibleBlock`).
- **Commands** (`lib/notes/block-commands.ts`, `tests/notes-block-commands.test.ts`):
  `moveBlock`, `duplicateBlock`, `deleteBlock` work on any document child
  without naming node types. `BlockShortcuts` binds `Mod-Shift-ArrowUp/Down`.
  The last remaining block is replaced by an empty paragraph, never removed.
- **Code blocks and details (#336)**: handled generically (the whole block moves, copies, deletes; undo restores). Code blocks keep Turn into (`codeBlock` is a textblock); `details` is not convertible, so its Turn into group is hidden.
- **Keyboard gap**: the handle only shows on hover, so the keyboard route is
  Mod-Shift-Up/Down; there is no key that opens the menu for the current block.
- **Flagged**: no `GripVertical`, `Copy` or `ArrowUp`/`ArrowDown` glyph in the
  icon registry, see `docs/open-questions.md#notes-block-menu-icon-glyphs-missing`.
- **Tests**: `tests/visual/block-handle.spec.ts` (menu actions, drag + undo,
  shortcuts, unmoved column, no handle on touch); stories `NoteBlockHandle`
  (hover, menu open; the menu in dark too).

## #339 — images in the editor (Claude-designed on request)

Components reused: `Button` (`destructive` + `Trash`, `transparent` bar button),
`InputField` (alt text), `Icon` (`Image`). Tokens: `surface-secondary`,
`text-secondary`, `stroke-primary-selected`, `radius-card-inner`, `spacing-component-*`.
No new component beyond the node view `components/organisms/NoteImageView.tsx`
(nothing existing renders a TipTap node).

- **Node**: block `image` with `src` and `alt` only (`NoteImage` in
  `lib/notes/extensions.ts`, `@tiptap/extension-image` 3.30.0 = `@tiptap/core`).
  `src` is only ever `/api/note-image/<note>/<image>` (#338): `parseHTML` accepts
  just that prefix, the markdown input rule is off and `parseMarkdown` turns an
  external `![](https://...)` into a plain paragraph, so no route can introduce
  an external picture (privacy, ADR-0022). Width options are left out.
  Markdown export is the extension's own `![alt](src)` (round-trip fixture).
- **Insert paths** all end in `requestImageUpload` (`lib/notes/image-upload.ts`):
  paste and drop through `@tiptap/extension-file-handler` (allowed types jpeg,
  png, webp, gif), the slash item `image` (appended to `SLASH_ITEMS`) and the
  EditingBar (mobile button, desktop overflow row), the last two via
  `openImagePicker` (a hidden `<input type=file>` appended to `body` while the
  dialog is open). Several files upload in parallel, each with its own placeholder.
- **Upload flow**: the extension `NoteImageUpload` (editor-only, added in
  `NoteEditor.tsx` with the #338 action `uploadNoteImage(noteId, file)`) validates
  type and the 10 MB cap (`validateImageFile`, same limits as the server), shows
  a placeholder, runs `downscaleImageFile` (Vercel's 4.5 MB body limit) and the
  action. The placeholder is a ProseMirror **widget decoration**, never a node: on
  failure it is simply removed and the error code is shown (`role="alert"`, the
  `notes.errors.*` strings, auto-dismissed after 8 s), so a failed upload can not
  leave a broken node or reach autosave. Success replaces the widget (and the empty
  paragraph the cursor was in) with the `image` node in one transaction; the
  trailing empty paragraph comes from StarterKit's trailing node.
  The insert position is a block boundary after the cursor's block (an empty
  paragraph is replaced); it is mapped through edits made during the upload.
- **Selected**: `NoteImageView` shows an outline in `stroke-primary-selected` and,
  in an editable document, an alt-text `InputField` plus a destructive delete
  `Button`. Enter or blur commits (empty becomes `null`), Escape discards; both
  return focus to the document. **Enter on a selected image focuses the field**
  (keyboard route in, `NoteImage.addKeyboardShortcuts`); Backspace/Delete on the
  selection removes the image natively. A pointer or arrow-key selection both work.
- **Broken**: `onError` swaps the picture for a `surface-secondary` block with
  `Icon/Image` and "Afbeelding niet beschikbaar" (`role="img"`, named with the alt
  text). Reset when `src` changes. Missing object = the route's 404.
- **Search**: `toPlainText` writes the alt text as a line of its own
  (`tests/notes-document.test.ts`), so it lands in `content_text`; a note that
  opens with an image takes its alt as title.
- **Tests**: `tests/notes-image-upload.test.ts` (validation, placeholder
  lifecycle, failure, src guard), `tests/visual/note-image.spec.ts` (states,
  alt edit, Escape, delete, keyboard, mobile/desktop entry points); stories
  `NoteImageView` (`Uploading`, `WithImage`, `Broken`, `Selected`).
- **Flagged**: there is no `ImageOff` glyph in `Icon` (the broken state reuses
  `Image`), and no spinner for the placeholder (a pulsing block with text; the
  pulse stops under `prefers-reduced-motion`). `docs/open-questions.md#notes-image-states-glyph-and-spinner`.
  Not verified: a real phone's file picker and camera roll, and R2 itself (nothing
  has run against real R2, see `docs/HANDOFF.md`).

## #341 — note links: `[[` menu, link chip, "Gelinkt vanuit" (Claude-designed on request)

ADR-0023. All from existing components and bound semantic tokens.

- **Node**: `noteLink` (`NoteLink` in `lib/notes/extensions.ts`), an inline atom on
  the official `Mention` with attributes `noteId` (uuid) and `label` (the target's
  title when inserted). These are exactly what `extractNoteLinkIds` hands to
  `save_note_content` (#340; `tests/notes-note-link.test.ts` pins it). Mention's own
  suggestion plugin and keyboard shortcut are switched off: the `[[` trigger is the
  editor-only `NoteLinkSuggestion` (`lib/notes/note-link-suggestion.ts`, official
  `@tiptap/suggestion`, 200 ms debounce, `allowSpaces`, query capped at 80 characters,
  never inside code), so a read-only renderer carries no menu. Markdown export
  writes `[[label]]`; it is one-way (import leaves the text).
- **Resolution** (`lib/notes/note-link.ts`): `page.tsx` calls `resolveNoteTitles` for
  the ids in the document and `getBacklinks` once; `NoteEditor` builds the
  resolution (`noteExtensionsWith`) once per mount. A renamed target shows its new
  title on the next open. An id the server could not resolve is **deleted**: muted
  chip "Verwijderde notitie", a `span`, not clickable. A link inserted in the
  session is never "deleted" and shows its stored label.
- **Chip** (`NoteLinkView`, `.tiptap .note-link*` in `app/globals.css`): inline text
  size and weight, `surface-secondary` fill (hover/active steps), `radius-control-inner`,
  `component-xs` padding. It is a real `<a href="/notities/<id>">`: focusable with
  Tab, Enter or click opens it (client-side via `router.push`; a modified click keeps
  the browser's new-tab behaviour). Selected/focus ring is `stroke-primary-selected`
  (flagged 2px, same as the image ring). `Tag` was not reused: it is a 40px block pill.
- **Menu** (`NoteLinkMenu`): a labelless `Dropdown` `role="listbox"` of transparent
  `Button` `role="option"` rows (icon `Notebook`, title, category muted), placed by
  the slash menu's `usePlacement`/`panelClasses` (caret, visual viewport). Focus
  stays in the editor, which carries `aria-haspopup/expanded/controls/activedescendant`.
  Arrows move, Enter/Tab insert the link plus a space, Escape closes (the suggestion
  plugin). While a search runs the previous rows stay and Enter waits; no rows shows
  "Geen notities gevonden"; an empty query lists the most recently updated notes
  (`findNoteLinkTargets`: title match, current note excluded, eight rows). Slash item
  `noteLink` ("Link naar notitie", last in `SLASH_ITEMS`) types `[[`.
- **Backlinks** (`NoteBacklinks`): a `section` labelled "Gelinkt vanuit" below the
  word count, a list of links (title, category muted), hidden when empty.
- **Server**: action `searchNoteLinkTargets` (zod-parsed, auth checked) over
  `findNoteLinkTargets` in `lib/notes/queries.ts`; no schema change.
- **Tests**: `tests/notes-note-link.test.ts` (attrs, HTML round-trip, resolution,
  trigger, select, slash item, markdown), `tests/notes-document.test.ts` (label in
  plain text and title); stories `NoteLinkMenu` (`Open`, `Filtered`, `NoResults`,
  `Searching`), `NoteLinkView` (`Links`, `DeletedLink`), `NoteBacklinks`.
- **Flagged**: no inline chip in Figma (`docs/open-questions.md#notes-link-chip-undesigned`).
  Not verified: a real phone's keyboard with the menu, and a note-to-note click
  against hosted data (nothing has run signed in).


## #342 — table of contents rail (Claude-designed on request)

ADR-0021 s3. From existing tokens; no new component (`NoteTableOfContents` is a list of links).

- **Packages**: `@tiptap/extension-table-of-contents` and `@tiptap/extension-unique-id`, both 3.30.0
  (same as `@tiptap/core`), both MIT on npm (the table-of-contents `license` field reads
  "SEE LICENSE IN LICENSE.md"; that file is the MIT text). `UniqueID` is limited to `heading`.
- **Attributes**: a heading gains `id` and `data-toc-id`, both additive. A note without them loads
  unchanged (`tests/notes-toc.test.ts`); the ids are assigned in the editor's deferred `create`
  handler. `NoteEditor` ignores updates until `settled`, so opening an old note does not save it or
  bump its updated time; the ids reach the database with the first real edit. `toPlainText`,
  `deriveTitle`, `extractNoteLinkIds` (#340) and the markdown export (#337) ignore them (tested), and
  the server's `tiptapDocumentSchema` passes unknown attrs through. `scrollParent: undefined`
  switches off the extension's own window scroll listener; the extension's `offsetTop` based
  active flag is not used.
- **Rail** (`NoteTableOfContents`, `lib/notes/use-note-toc.ts`): `nav` labelled "Inhoud", H1-H3 as
  links (`href="#id"`; plain click scrolls, a modified click keeps the browser's behaviour). Level
  indent via `component-md`/`component-lg`; active item `surface-secondary` + `text-primary` +
  `aria-current="location"`, others `text-secondary` with the hover/active surface steps; a
  `stroke-lines` rule on the left. Empty headings are skipped. Shown from `MIN_TOC_HEADINGS` (3).
- **No layout shift**: the `aside` is `absolute` (out of flow) in the free space right of the 70ch
  column, `w-44`, desktop `xl:` only, `sticky` inside. The editor column is never pushed or
  narrowed whether the rail exists or not. Hidden below `xl`; mobile has no menu (left out).
- **Behaviour**: active = last heading within the top quarter of the viewport (the last one at the
  page bottom); a click selects its item at once until the next scroll. Activating moves the caret
  into the heading (`focus(pos + 1)`, no jump) and scrolls it into view, `smooth` unless
  `prefers-reduced-motion`. `.tiptap` headings carry `scroll-margin-top: stack-xl`.
- **Tests**: `tests/notes-toc.test.ts`; stories `NoteTableOfContents` (`Default`, `FirstActive`), plus a
  dark baseline. Flagged: `docs/open-questions.md#notes-toc-rail-undesigned`. Not verified: scrolling
  against a real long note signed in (nothing has run signed in).
