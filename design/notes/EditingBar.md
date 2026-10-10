# EditingBar

- **Code:** `components/organisms/EditingBar.tsx` (+ `.stories.tsx`)
- **Node IDs:** desktop `3978:14138`, mobile `3978:14870` (file "Notion -
  V2", `QwWEkv3z4DKsipNQVrMIyQ`). Both measured live via the `figma-console`
  bridge, `boundVariables` on every relevant node — never inferred from a
  resolved value (`docs/incidents.md` #204/#213).

## Structural trap, confirmed before anything else was measured

Every one of the twenty toolbar buttons is a **detached** `FRAME` named
`Button/Default`, not a `Button` component instance, and every icon inside
is a loose frame, not an `Icon/*` instance
(`docs/open-questions.md#notes-editingbar-detached-from-components`, #227).
Each button's structure:

```
FRAME "Button/Default"
  FRAME "Leading + Text"
    FRAME "Icon"                <- visible=true, the real glyph lives here
      FRAME "<lucide-kebab-name>"
        VECTOR ...
    FRAME "Text"                <- visible=false, placeholder residue "Categorie "
  FRAME "Icon"                  <- visible=false, leftover Icon/Plus instance
```

Reading `node.name` or `getMainComponentAsync().name` on the leftover icon
instance returns `Icon/Plus` for all twenty — the real glyph is the visible
child frame under `Leading + Text > Icon`, read directly per button rather
than trusted from the leftover instance. Built on real `components/atoms/
Button.tsx` + `components/atoms/Icon.tsx` regardless, per this repo's normal
Figma→code convention (`docs/guides/ui-components.md`) — the detached state
is a Figma-file fact, not a reason to freelance the code.

## The command mapping — full 20 rows, one source note per row

Ticket #234's own text states the TipTap command order left-to-right:
undo, redo, heading, list, block quote, table, code block, code, bold,
italic, strikethrough, underline, highlight, link, superscript, subscript,
align left, align center, align right, align justify. **Per explicit user
instruction, that stated order IS the mapping** — the two icon/position
ambiguities the ticket asks to "choose and motivate" (`text-quote` vs. list
position, `square-code`/`code-xml` ordering) are resolved by POSITION, not
by a judgement call on the icon name. The Figma separator split (2/6/6/2/4)
matches the command list's own natural grouping exactly, which is the
evidence for pairing them 1:1, not the icon names themselves.

| # | Figma glyph | Desktop buttonId | Mobile buttonId | TipTap command | Source |
|---|---|---|---|---|---|
| 1 | `undo-2` | 3978:14139 | 3978:14871 | `undo` | Ticket order (position 1 of 20) |
| 2 | `redo-2` | 3978:14149 | 3978:14881 | `redo` | Ticket order (position 2) |
| 3 | `heading` | 3978:14160 | 3978:14892 | `toggleHeading({level:1})` | Ticket order (position 3); single-level assumption below |
| 4 | `list` | 3978:14171 | 3978:14903 | `toggleBulletList` | Ticket order (position 4); bullet vs. ordered assumption below |
| 5 | `text-quote` | 3978:14185 | 3978:14917 | `toggleBlockquote` | **Ticket order, position resolves the ambiguity** — icon name suggests a quote glyph, position (between list and table) matches "block quote" in the command list exactly |
| 6 | `table` | 3978:14197 | 4067:20046 | `insertTable({rows:3,cols:3,withHeaderRow:true})` | Ticket order (position 6); wired per user's scope-pull-forward decision, see below |
| 7 | `square-code` | 4067:20029 | 3978:14929 | `toggleCodeBlock` | **Ticket order, position resolves the ambiguity** — square-code = code BLOCK (position 7 = "code block" in the list) |
| 8 | `code-xml` | 3978:14208 | 3978:14940 | `toggleCode` | **Ticket order** — code-xml = INLINE code (position 8 = "code" in the list) |
| 9 | `bold` | 3978:14220 | 3978:14952 | `toggleBold` | Ticket order (position 9) |
| 10 | `italic` | 3978:14229 | 3978:14961 | `toggleItalic` | Ticket order (position 10) |
| 11 | `strikethrough` | 3978:14240 | 3978:14972 | `toggleStrike` | Ticket order (position 11) |
| 12 | `underline` | 3978:14251 | 3978:14983 | `toggleUnderline` | Ticket order (position 12) |
| 13 | `highlighter` | 3978:14261 | 3978:14993 | `toggleHighlight` | Ticket order (position 13) |
| 14 | `link` | 3978:14271 | 3978:15003 | opens the LinkPopover (#331; was window.prompt) | Ticket order (position 14); design/notes/NoteEditor.md (#331) |
| 15 | `superscript` | 3978:14282 | 3978:15014 | `toggleSuperscript` | Ticket order (position 15) |
| 16 | `subscript` | 3978:14293 | 3978:15025 | `toggleSubscript` | Ticket order (position 16) |
| 17 | `text-align-start` | 3978:14305 | 3978:15037 | `setTextAlign("left")` | Ticket order (position 17) — lucide's `TextAlign*` names, not `Align*` (#227) |
| 18 | `text-align-center` | 3978:14316 | 3978:15048 | `setTextAlign("center")` | Ticket order (position 18) |
| 19 | `text-align-end` | 3978:14327 | 3978:15059 | `setTextAlign("right")` | Ticket order (position 19) |
| 20 | `text-align-justify` | 3978:14338 | 3978:15070 | `setTextAlign("justify")` | Ticket order (position 20) |

Positions 1–20 are identical on both breakpoints (measured buttonId pairs
above) — one `GROUPS` config in `EditingBar.tsx` renders both.

## Three deviations from the ticket text (orchestrator's measurement, reproduced)

1. **The two "choose and motivate" pairs are resolved by ordering, not
   judgement** — see rows 5, 7, 8 above. No open question filed for either;
   the user's instruction settles both.
2. **The ticket says "vier groepen" (four groups). There are five** — the
   Figma separator lines split the bar 2 | 6 | 6 | 2 | 4 (`Line 2`–`Line 5`
   on desktop, plus a 6th, `Line 6`, on mobile only — see point 3).
3. **Mobile has a 21st element the ticket never mentions**, after `Line 6`:
   `3978:15082`, a real `Button/Default` **instance** (not detached, unlike
   the other twenty), 133px wide, with a visible text label "Afbeelding" and
   `Icon/Image`. No image-insertion TipTap extension exists in
   `lib/notes/extensions.ts`. **Out of scope for #234** — not built, not
   counted among the 20 rows above.
   `docs/open-questions.md#notes-editingbar-mobile-image-button-out-of-scope`.

## Assumptions made where the ticket is silent (not flagged as ambiguous by the ticket itself)

- **Heading is a single level (1), not a level picker or cycle.** Figma
  draws one generic `Icon/Heading` button, no H1/H2/H3 indicator and no
  second frame showing a level-selection UI. `toggleHeading({level:1})` is
  the simplest reading of "one button, one heading affordance" — a future
  ticket could add level-cycling or a dropdown if that's wanted, but nothing
  in this file's own scope asks for it.
- **List is `toggleBulletList`, not `toggleOrderedList`.** lucide's `List`
  glyph (bullet rows, no digits) matches the bulleted, not numbered, list
  export — verified by rendering the icon, same class of check
  `design/notes/Icon.md` already uses for every other lucide mapping in this
  file.
- **Table inserts a fixed 3×3 grid with a header row**
  (`insertTable({rows:3,cols:3,withHeaderRow:true})`), TipTap's own
  documented default shape. No resize handles, no add/remove row/column UI —
  cell/column controls are #235's own scope (`lib/notes/extensions.ts`'s
  `TableKit` import defaults to `resizable:false`, unchanged).

## Table wiring — pulled forward from #235 on direct user instruction

The table button is wired to a real command (`insertTable`), not left
disabled, per the user's explicit decision to pull this one slice of #235
forward. `lib/notes/extensions.ts` gained `TableKit` (`@tiptap/extension-
table@^3.30.0`) — **one package** in TipTap v3 (checked against the
installed package's own `dist/package.json` `exports` map before adding it,
same discipline `design/notes/NoteEditor.md`'s #233 entry used for
StarterKit): v2 needed four separate `@tiptap/extension-table`/`-row`/
`-cell`/`-header` packages, v3's single `@tiptap/extension-table` ships all
four plus a `TableKit` convenience bundle from one entry point. Added to
`noteExtensions` in `lib/notes/extensions.ts` — that file's own header
comment says table extensions belong in THAT array, never a second one — not
to a second whitelist. Everything else #235 owns (cell selection, merge/
split, add/remove row/column UI, resize handles) is explicitly **out of
scope** here: no such buttons exist in `EditingBar.tsx`, and `TableKit`'s
`resizable` option is left at its own default (`false`).

## Bar-level tokens measured (figma-console bridge, `boundVariables`)

| Element | Property | Bound variable | Tailwind | Notes |
| --- | --- | --- | --- | --- |
| Bar (both breakpoints) | `topLeftRadius` etc. | `radius/card` | `rounded-card` | 12px measured, matches |
| Bar | `paddingLeft`/`Right` | `spacing/component/padding-xs` | `px-component-xs` | 4px measured, matches |
| Bar | `fills[0]` | `color/surface/highlight/white/default` | `bg-surface-highlight-white` | Same token `Button`'s own `white` variant reads |
| Bar | `paddingTop`/`Bottom` | **unbound**, literal 4 | `py-1` | `spacing-flag` in `EditingBar.tsx` |
| Bar | `itemSpacing` | **unbound**, literal 8 | `gap-2` | Same `spacing-flag` (applies to both/one comment block, per the gate's own contiguous-block rule) |
| Separator `Line 2`–`Line 5` | `strokes[0]` | `color/Stroke/lines` | `bg-stroke-lines` | Already a real semantic token (`stroke-lines`, #204) — same idiom `CardContentIngredient.tsx`'s own `h-px w-full bg-stroke-lines` divider uses. Rendered `rotation:-90`, 1px stroke × 24px, i.e. `h-6 w-px` |
| Button (every one of 20) | width/height | — (structural) | `Button`'s own `iconOnlyDefault` (`size-10 justify-center`) | Measured 40×40 exactly — no new sizing needed |
| Button | `paddingLeft`/`Right` | `spacing/component/padding-sm` | Already `Button.tsx`'s own icon-only class | No new binding |
| Button | `topLeftRadius` etc. | `radius/control` | Already `Button.tsx`'s own `rounded-control` | No new binding |
| Button | `fills`/`strokes` | **empty on every measured node** | `variant="transparent"` | The only Button variant whose Default has no fill/stroke of its own — confirms the pick, not assumed |

Mobile-only positioning: the bar's own measured width (370px) against its
402px mobile frame leaves exactly 16px on each side — the same value as
`spacing/layout/page-padding-left`/`-right-equal`'s own mobile figure (both
16px on mobile). Bound to `left-page-left`/`right-page-right-equal` rather
than a raw `mx-4`, since the coincidence is exact and the token already
exists for this exact page-inset role elsewhere in this route
(`NoteEditor.tsx`'s own `pr-page-right-equal`).

## Active state — Button's existing `State=Selected`, exactly as it is, not reinvented

Per the ticket's own instruction, reused `Button`'s existing
`aria-pressed:` Selected semantics (`design/notes/Button.md`) rather than
inventing a new visual treatment. Because every button here is
`variant="transparent"`, and Transparent's own Selected state has **no
fill** (`design/notes/Button.md`'s #213 table: `Transparent | Selected |
3822:6652 | no fill (unchanged) | color/text/base/primary`), the honest
result of "reuse Selected as-is" is a text/icon colour shift only
(`text-text-secondary` → `text-text-primary`, inherited by the icon via
`currentColor` since `Icon` renders with no explicit colour className) — not
a filled pill. This is what Transparent's Selected really is on this
component set; switching to a different variant (e.g. `white`) to get a
visible background would have been inventing a treatment Figma's own Default
buttons don't draw, which the ticket explicitly forbids.

`aria-pressed` is only set on the 17 commands with a real "is this mark/node
active at the cursor" concept (`isActive` in `EditingBarCommand`) — `undo`,
`redo` and `table` never carry it, since they're actions, not toggles.
Subscribed via `useEditorState` with a selector keyed by command id, per the
ticket's explicit "not a re-render of the whole editor per keystroke"
instruction (`design/notes/NoteEditor.md`'s own "Performance isolation"
section, written for #234 to build against).

## a11y — `role="toolbar"` with roving tabindex, chosen and motivated

Two options per the ticket: a `toolbar` role with arrow-key roving tabindex,
or a plain button row (20 independent `Tab` stops). Chose **`role="toolbar"`
+ roving tabindex** (ARIA APG's Toolbar pattern):

- **Tab-stop cost.** A plain row puts all 20 buttons in the page's own Tab
  order — a keyboard user has to Tab through the entire bar (or past it,
  20 times) to reach the editor content below/around it. A toolbar with
  roving tabindex is exactly one Tab stop; Left/Right/Home/End move focus
  *within* the bar once it has focus. For a formatting toolbar that sits
  directly next to the content it edits (and, on mobile, is horizontally
  scrollable), that difference is real, not cosmetic.
- **Established pattern, not invented UI.** This is the standard ARIA
  pattern for exactly this shape of control (a row of same-purpose buttons),
  documented in the WAI-ARIA Authoring Practices Guide — adopting it is
  applying prior art, not designing something Figma doesn't show (Figma has
  no opinion on ARIA roles; this is a code-layer accessibility decision the
  ticket explicitly asks to be made and motivated, same category as
  `NoteEditor.tsx`'s own reused delete-confirm pattern).
- **Implementation**: a container `ref` (not per-button refs — `Button` is a
  plain function component, not `forwardRef`-wrapped, so keyboard nav reads
  the ordered `<button>` list via `querySelectorAll` inside the toolbar's
  own root instead of touching `Button.tsx`) plus one `activeIndex` state;
  `tabIndex={0}` only on the currently-active index, `-1` on the rest,
  updated on `ArrowLeft`/`ArrowRight`/`Home`/`End` and on native `focus`
  (so Tab-away-and-back resumes at the last-focused button, not always the
  first).

## Mobile — fixed bottom, horizontally scrollable, hidden scrollbar

Same three techniques `Carousel.tsx` already established (`design/notes/
Carousel.md`, #24/#110):

- **Hidden scrollbar**, unconditional: `[scrollbar-width:none]
  [&::-webkit-scrollbar]:hidden`. Same open design question Carousel's own
  file already carries and doesn't resolve — no arrow/dot/fade affordance is
  drawn anywhere in Figma for either component's overflow, so
  `overflow-x-auto` (native scroll, no visible chrome) is the same
  least-invention stand-in, not a new gap this ticket introduces.
- **Fixed to the viewport bottom**: `fixed bottom-[env(safe-area-inset-
  bottom)] left-page-left right-page-right-equal`, switched back to
  `md:static md:inset-auto` for desktop's in-flow position "direct onder de
  header". `bottom-[env(safe-area-inset-bottom)]` (not a flat `bottom-0`)
  lifts the bar clear of the iOS home-indicator strip per #172's idiom
  (`pb-[max(1rem,env(safe-area-inset-bottom))]` elsewhere in this codebase
  uses padding for the same purpose; this bar uses position instead of
  padding, since padding would grow the 48px bar's own height and
  off-centre its buttons vertically).
- **Reconciled with `NoteEditor.tsx`'s existing reservation, not
  double-added.** #233 already reserved `pb-[calc(4rem+env(safe-area-inset-
  bottom))]` on the content wrapper below the bar's slot, sized to clear the
  bar's own 48px with margin. Since `EditingBar.tsx` itself now applies
  `env(safe-area-inset-bottom)` via `bottom-*` (not via extra padding on top
  of what `NoteEditor.tsx` reserves), the total space the reservation needs
  to clear is still just the bar's own height — nothing here changes the
  `4rem` figure in `NoteEditor.tsx`, only its own comment was corrected to
  say EditingBar now positions itself with the inset rather than being a
  not-yet-built placeholder.

## #263 — keyboard inset (mobile bar disappearing behind the software keyboard)

Feedback: on mobile, `EditingBar` (positioned `fixed bottom-[env(safe-area-
inset-bottom)]`, see "Mobile" above) stayed visually anchored to the bottom
of the *screen* while typing, but the iOS software keyboard covers that same
region — the bar was rendering underneath it, invisible during exactly the
moment it's needed.

**Root cause.** `position: fixed` anchors to the browser's *layout* viewport
(the full document area, unaffected by an on-screen keyboard). iOS Safari's
software keyboard shrinks only the *visual* viewport — `window.innerHeight`
and the layout viewport stay the same size throughout, so nothing about
`fixed`'s own positioning model reacts to the keyboard at all. This is a
well-known iOS Safari gap, not a bug in this component's original
positioning logic (`bottom-[env(safe-area-inset-bottom)]` is still correct
for the no-keyboard case, unchanged).

**Fix — `useKeyboardInset()`, a small hook local to `EditingBar.tsx`** (no
new dependency, no new file — this is pure UI behaviour with nothing else to
share it with). Reads `window.visualViewport`'s own geometry and derives how
far the bar must lift to clear the keyboard:

```
inset = max(0, window.innerHeight - (visualViewport.height + visualViewport.offsetTop))
```

`innerHeight` stays fixed (layout viewport); `visualViewport.height` shrinks
and `.offsetTop` can shift as the keyboard opens and the visible viewport
scrolls — subtracting both from `innerHeight` gives exactly the gap the
keyboard (plus any scroll offset) has opened up. SSR-safe: state initializes
to `0`, all reads happen inside a `useEffect`, and `window.visualViewport`
can be `undefined` (older browsers, non-browser environments) — guarded with
an early return that leaves the inset at 0. Listens on both `resize` **and**
`scroll` on `visualViewport` — iOS moves `offsetTop` on scroll independently
of a `resize` event, so `resize`-only would miss inset changes mid-scroll.
Both listeners are removed in the effect's cleanup.

**Applied without touching the desktop layout.** The bar is `md:static`; a
`transform` on a statically-positioned element would move it there too if
applied unconditionally. The breakpoint split stays in Tailwind, not JS: the
measured inset is written as a CSS custom property via an inline `style`
(`style={{ "--keyboard-inset": \`${keyboardInset}px\` }}`), and the
className reads it back with `translate-y-[calc(var(--keyboard-inset,0px)*-1)]
md:translate-y-0` — `md:translate-y-0` unconditionally zeroes the transform
at the desktop breakpoint regardless of what the custom property holds, so
the JS-measured value can never leak into the desktop layout. This inline
`style` is runtime geometry, not styling (colour/spacing) — the same
exception `CardContentIngredient.tsx:162`'s swipe-offset `style={{ transform:
... }}` already uses, and `CLAUDE.md`'s "no inline styles" rule is about
styling values, not measured positions. On desktop (and in every
`test:visual` Playwright run, Chromium desktop-viewport) `visualViewport`
either matches the layout viewport exactly or the effect never observes a
keyboard, so `keyboardInset` stays `0` and `translate-y-[calc(0px*-1)]`
resolves to no visible movement — no baseline needed regenerating for this
change, confirmed by running the full suite, not assumed.

**Not verified on this machine** — same standing gap as the rest of this
file's "What could not be verified" section below: no physical iOS device,
so the actual on-keyboard-open animation feel (timing, whether `scroll`
firing mid-transition ever produces a visible jitter) is reasoned from the
documented `visualViewport` API, not observed.

## What could not be verified on this machine

Per the standing #185–#187 verification gap (`docs/HANDOFF.md`): real iOS
Safari/PWA keyboard-appearance behaviour (does the software keyboard cover
the fixed-bottom bar, does `env(safe-area-inset-bottom)` actually resolve
non-zero in standalone mode) and real-device horizontal swipe/scroll-snap
feel are **not exercised here** — this dev machine has no physical iOS
device and no Docker/local Supabase for a live authenticated `/notities/
[noteId]` session. Reasoned/typechecked against TipTap's own command
signatures (`dist/index.d.ts` per sub-package, not doc examples) and
verified in Ladle/Playwright (desktop-viewport, Chromium) only. `useEditorState`'s
null-editor handling was checked against Context7's own TipTap React
install guide (`if (!editor) return null` inside the selector, mirrored by
this component's own top-level `if (!editor) return null` before rendering
anything).

## #329 — block-type and list menus (Claude-designed on request)

Rows 3 (`heading`) and 4 (`list`) of the command table are no longer toggles:
they are two menu buttons (`components/organisms/EditingBarMenu.tsx`), still
at positions 3 and 4 so the roving-tabindex count (20) and the Figma group
split (2/6/6/2/4) are unchanged. No Figma node exists for them.

- **Block type**: Text / Heading 1 / Heading 2 / Heading 3 (`setParagraph`,
  `setHeading`). **List**: bulleted / numbered / checklist (`toggle*List`;
  choosing the active one toggles it off; a different one converts). The
  trigger is `Button variant="transparent"` + the current label + trailing
  `ChevronDown`; the list trigger reads "Lijst" when no list is active. Icons
  reused (`Heading`, `List`, `Check`); no new `Icon` entries.
- **Why a small `EditingBarMenu` and not `Dropdown` alone**: `Dropdown` is a
  disclosure (inline expanding field), not a menu button, and the bar is
  `overflow-x-auto`, which would clip any in-bar panel. The menu portals to
  `body`, positions from the trigger rect (open upward in the lower half of
  the viewport, right-aligned in the right half; runtime geometry passed as
  `--menu-x`/`--menu-y` custom properties, same exception as the keyboard
  inset) and reuses the labelless `Dropdown` as its panel (`role="menu"`) and
  `Button variant="transparent" align="left"` as its rows
  (`role="menuitemradio"`, `Check` trailing icon on the active one). It is a
  private part of EditingBar, not a catalogue atom; promote it only if #331/#332
  need the same shape.
- **Keyboard / ARIA**: trigger `aria-haspopup="menu"`, `aria-expanded`,
  `aria-controls`; Enter/Space/click or ArrowUp/Down open; focus lands on the
  active row; ArrowUp/Down/Home/End move, Enter/Space select; Escape, Tab and
  outside click close; **focus returns to the editor** (selection commands call
  `focus()`, dismissal calls `editor.commands.focus()`). The toolbar's roving
  tabindex now addresses `[data-toolbar-item]` buttons only, so menu rows
  never become toolbar stops. Verified in Chromium with a throwaway
  Playwright run (open, navigate, select, Escape, checkbox click and Space).
- **Strings**: `components.editingBar.blockTypeLabel`, `listLabel`,
  `options.*` in nl and en (`headingLabel` removed).
- **Dark mode**: panel and rows use semantic tokens only; baselines
  `editing-bar--block-type-menu-open`, `--list-menu-open` and `note-editor-content--prose` (now incl. a nested checklist)
  (light + dark), `--at-rest`/`--with-active-button` regenerated because the
  two triggers now carry text.

## #330 — table size picker (Claude-designed on request)

The `table` button (position 6, count and group split unchanged) no longer
inserts a fixed 3x3: it opens `components/organisms/TableSizePicker.tsx`, a
`Button variant="transparent" icon="Table"` trigger plus a portalled, labelless
`Dropdown` panel (placement and dismissal shared with `EditingBarMenu` through
`usePopoverPanel`). The panel is a `role="grid"` of 8x8 `gridcell` buttons
(`aria-label` "3 x 4", `aria-selected` for the highlighted range) and a
`role="status"` line with the live size. Highlight: `surface-secondary` fill +
`stroke-primary-hover` border, focused cell `stroke-secondary-active`.

- **Keyboard**: trigger opens on Enter/Space/click/ArrowDown/ArrowUp; roving
  tabindex on the grid, arrows move (no wrap), Home/End jump to column 1/8,
  Enter/Space insert the highlighted size, Escape/Tab close; focus returns to
  the editor in every case. Default size 3 x 3 (what the button inserted
  before). Header row on.
- **Mouse / touch**: hover (mouse only) moves the highlight and focus; a click
  or tap inserts at once. Touch has no hover, so the highlight is only a
  preview there; no stepper variant was built.
- **Why not a new atom**: the grid is specific to this one control; promote it
  only if another picker needs it. Cell size `size-6` has no spacing token
  (a raw size utility, not covered by `check:raw-spacing`).
- Strings: `components.noteTable.insertLabel`, `sizeLabel`, `size`
  (`{rows} x {cols}`); `editingBar.tableLabel` was removed. Table actions on
  mobile arrive with #333 from `lib/notes/table-commands.ts`.

## Verification — what was and wasn't run

`pnpm lint`/`typecheck`/`test`/`check:server-only`/`check:raw-spacing`/
`check:comment-budget` and the full `pnpm test:visual` results are reported
in the PR, not restated here.
