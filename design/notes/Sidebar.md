# Sidebar

- **Code:** `components/organisms/Sidebar.tsx`
- **Node ID:** `3674:5664`

## TICKET #108 (2026-07-27/28) — nav items get `align="left"`

**`align="left"` is now required on every nav item Button.** `#112` (Button ticket) changed `Button`'s default `align` from a (mis-derived) space-between to a genuine `justify-center`. Measured before adding the prop: the collapsed rail (73px) stretches each nav Button to 40px (parent `flex-col`'s default `items-stretch`), and with the new `center` default the oversized icon+label content was centred within that 40px box instead of packed left — the icon itself started clipping on its *left* edge (only ~7 of 24px visible), a regression the old (wrong) `justify-between` default never had, since a single flex child under space-between degenerates to flex-start. Added `align="left"` to all six `NAV_ITEMS` Buttons (this ticket's own call-site sweep, per its "nav + dropdown triggers become left" scope) to restore (and now correctly guarantee) left-packed content; re-measured post-fix, icon fully visible (flush at the 8px padding edge), label clipped at the box boundary (see the sliver arithmetic below).

**Collapsed-rail label-sliver arithmetic, resolved.** `#112`'s Button.tsx also widened the leading icon-to-label gap from `gap-1` (4px) to `gap-2` (8px), per Figma's `"Leading + Text"` frame. Combined with `align="left"`, measured live (Playwright, `sidebar--variants` story, collapsed): `8(padding) + 24(icon) + 8(gap) = 40` lands exactly on the 40px content box, so the label's own text-node bounding rect now starts exactly at the button's clipped right edge — **0px of the label visible**, confirmed via `Range.getBoundingClientRect()`, not inferred. This supersedes the "New, this ticket" entry below (2026-07-25, ticket #109) that accepted a ~4-8px letter sliver as an unavoidable trade-off pending a Figma-sourced fix — that fix arrived via `#112`'s gap change, not a new Sidebar-side hack; no padding was invented here.

## TICKET #113 (2026-07-27/28) — safe-area padding (mobile drawer, unverified on-device)

Added `pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]` alongside the existing `p-4`, so this atom's own edge padding grows to clear a notch/home-indicator when it fills `AppShellNav.tsx`'s full-height mobile drawer — `max()` only ever adds space over the existing 16px, so it's a verified no-op on desktop/non-notched devices (measured: `getComputedStyle(nav).paddingTop/Bottom` both still report `16px` in a normal browser with no safe-area context) and left/right padding (which the 73px/198px width constants depend on) is untouched. Whether this actually clears real iOS Safari's chrome cannot be verified without a physical device — see `design/notes/SidePanel.md`'s #113 entry for the full reasoning (measured in Chromium that `fixed inset-y-0` + `h-full` already computes to exactly `window.innerHeight` with zero gap, ruling out a plain CSS box-model bug; the reported "drawer doesn't reach the edges" is hypothesised to be `app/layout.tsx`'s previously-missing `viewport-fit=cover`, not a Sidebar-side sizing defect).

Built #25. Component SET's only variant axis is a single boolean, `Collapsed` (No/Yes) — verified via MCP componentPropertyDefinitions, no other axis exists. Modelled as a plain optional `collapsed` prop with conditional clsx classes (same treatment Atom/Checkbox gives its own Checked=No/Yes axis), not CVA. Six fixed 'Button/Default' nav items (Te doen/Notities/Recepten/Winkelmand/Kleren/Assistent, matching Vision.md's module list 1:1) are rendered from a closed internal list, not a children slot — Figma hardcodes exactly these six, never a variable set. Sizing measured against downloaded node PNGs, not assumed: Collapsed=No is Figma `fixed` 198px (confirmed 396px@2x -> 198px@1x), rendered `w-[198px]` (no spacing/sizing token layer exists yet in this codebase, colours only, so no semantic name to reuse); Collapsed=Yes is Figma `hug`, genuinely different from No's `fixed`, rendered `w-fit` (falls out to the measured 72px = 16 pad + Button's own 40px icon-only footprint + 16 pad, not stated directly). Both variants report Figma `fixed` height 689px, NOT modelled — 689 is far taller than the fetched content needs (~420px), reading as this mockup artboard's own canvas height with no documented viewport constant behind it; rendered `h-full` pending a future App Shell, flagged for re-verification once one exists. Border: the single right-edge 1px stroke is stone-300 -> the existing `border` token (not `surface-raised-hover`, despite sharing the stone-300 primitive — different role, border vs fill, no gap).

## Active item — corrected 2026-07-22 (replaces the earlier FLAGGED GAP/REGRESSION writeup, not appended to it)

The original build read the fetched node's active item (Recepten) as resolving to Button's `Style=Filled, State=Hover` component (stone-300/`surface-raised-hover`) rather than every sibling's own `Style=Filled, State=Default`, and — after cross-variant pixel-sampling seemed to rule out a stray-hover-capture artifact — concluded that was real, deliberate design and shipped a `bg-surface-raised-hover!`/`active:bg-surface-raised-active!` override as a stopgap, flagging `docs/open-questions.md#selected-needs-a-fill-token`.

That conclusion was wrong. It **was** a Figma authoring mistake — the active instance had been set to Button's Hover state instead of its Selected state — and the user has since corrected it in Figma. Re-fetching node `3674:5664` confirms the active item now resolves to `Type=Default, Style=Filled, State=Selected` (componentId `3822:6637`) in both `Collapsed=No` and `Collapsed=Yes`: fill is back to `surface-raised` (stone-200, identical to every sibling and to the toggle button), text darkens to `text` (stone-950, `#0C0A09`). That is exactly `Atom/Button`'s existing Selected state — no override, no new token. `Sidebar.tsx` now renders the active item with `variant="filled"` + `aria-pressed`, dropping the `!` overrides entirely. `docs/open-questions.md#selected-needs-a-fill-token` is resolved (Sidebar was its only evidence); see `docs/incidents.md` for the short correction entry. Icon `Icon/Astroid` (node 3726:2493, Assistant item) maps directly to lucide's own `Astroid` export — an earlier pass wrongly matched it to `Sparkle` by leading numeric coefficients alone (11.017/2.814/1.966) and, on the mistaken belief lucide had no `Astroid` export (a `/asteroid/i` name search missed it — lucide spells it without the middle "e"), briefly vendored the Figma vector as a custom SVG. Rendering both lucide icons side by side against the Figma vector showed lucide's `Astroid` is the real match (same symmetric four-point diamond); `Sparkle` is a visibly different asymmetric twinkle. Fixed to a direct `Astroid` import in Icon.tsx's IconName union. Accessibility: whole component is one `<nav>` landmark (composer-supplied `navLabel`), active item gets `aria-current="page"` (valid on any element, not link-only — these are Button instances, not links, per the fetched node; real href/Link integration is a future composer-level concern, not invented here); toggle is icon-only so its aria-label is a required composer prop (`toggleLabel`, picked per current state, e.g. "Expand sidebar" while collapsed). i18n: navLabel/toggleLabel/labels are all composer-supplied props (same leaf/composer split as CardContainer's addLabel/editLabel), catalog keys under `components.sidebar.*` in messages/{nl,en}.json. Server Component (no "use client"): `collapsed` stays a plain prop, not internal state, since where a real app persists the collapsed flag (cookie/localStorage/URL) genuinely varies by caller, unlike Dropdown's identical-for-every-caller disclosure state.

## Collapse slide transition (#86, 2026-07-22)

Filed as BLOCKED (see `docs/incidents.md`'s prior write-up, still accurate as history): no Figma prototype spec existed, and `w-fit` can't be animated. The user supplied a reference frame (node `3859:6647`, "SidebarAnimation") to unblock it — re-fetching it via MCP confirmed it contains only the same static `Collapsed=No` instance already fetched for this component, with **no** `reactions`/`transitionNodeID`/`transitionDuration`/easing fields anywhere in the payload. Figma still specifies no timing; only the requirement that it *should* slide is real and Figma-sourced (the frame's name and existence), not the how-fast/how-eased part.

- **The real blocker was `w-fit`, not missing polish.** CSS cannot transition `width` to/from an intrinsic-sizing keyword — only between two explicit lengths. Fixed by replacing `w-fit` with a measured, explicit-pixel `SIDEBAR_COLLAPSED_WIDTH` constant, keeping `SIDEBAR_EXPANDED_WIDTH` (the existing `198px`) alongside it for symmetry (both hoisted so the literal Tailwind arbitrary-value string exists in exactly one place each, per the ticket's "token/constant, not a magic number sprinkled around" requirement).
- **The collapsed width is 73px, not the 72px this file previously stated** (`16px pad + Button's 40px icon-only footprint + 16px pad`). That arithmetic was never wrong about the *content*, but it never accounted for Tailwind Preflight's project-wide `box-sizing: border-box`: a real browser's `fit-content` resolution for a border-box element folds the element's own border into the reported box. This `<nav>` carries a `border-r border-border` (1px), so the actual rendered `width`/`offsetWidth` is 73 — confirmed via Playwright against `pnpm ladle`'s dev server (`getBoundingClientRect()` + `getComputedStyle().width`, cross-checked with `clientWidth` = 72, i.e. content minus the 1px border, which matches the old estimate exactly and pinpoints the border as the missing pixel). **The measurement won over the arithmetic hypothesis** — this is the corrected number now, the same "measure the rendered DOM, don't trust the estimate" discipline the #24/#25 incident already established for this project (see `docs/incidents.md`).
- **Motion token layer added** (`design/tokens.json` `semantic.duration.base` / `semantic.easing.base`, synced to `app/theme.css` as `--duration-base: 200ms` / `--ease-base: cubic-bezier(0, 0, 0.2, 1)` via `pnpm sync:tokens`) — the gap this ticket was originally filed to flag. No Figma source exists for either value (confirmed above), so both are this codebase's own default: 200ms, standard ease-out. Flagged at `docs/open-questions.md#sidebar-motion-timing-unsourced` pending a design/product answer, same as any other un-sourced value in this project. `Dropdown.tsx`/`ButtonToggle.tsx` each already reach for Tailwind's raw `duration-200 ease-out` utilities directly (their own doc comments flag the exact same "no project motion token yet" gap) — **not migrated onto the new tokens by this ticket**, since #86 is scoped to Sidebar; a natural follow-up once the pattern is proven here.
- **Stays a Server Component.** The transition is a plain CSS class swap between two explicit-length Tailwind classes (`transition-[width] duration-[var(--duration-base)] ease-base motion-reduce:transition-none` — the duration must use the arbitrary-value form because `--duration-*`, unlike `--ease-*`, is not a Tailwind v4 theme namespace, so a bare `duration-base` compiles to nothing and falls back to the 150ms default) — no measuring, no `ResizeObserver`, so no client JS was needed for the animation itself. `collapsed` remains a composer-supplied prop exactly as before.
- **`prefers-reduced-motion` respected** via `motion-reduce:transition-none`, same precedent `Dropdown`/`Button-toggle` already set.
- **Ladle**: `Sidebar.stories.tsx`'s `Animated` story (unchanged otherwise) now demonstrates a real slide instead of a snap — its doc comment updated to say so; no new story added since this one already exercises the toggle end to end.

## App shell's default collapse state (#88, 2026-07-23)

The three page frames fetched for #88 (Recepten desktop `3672:1577`, Te-Doen
desktop `3680:1442`/`3680:1435`) are **inconsistent about `Collapsed`**: the
Te-Doen desktop frames instance Sidebar as `Collapsed=Yes` (componentId
`3632:460`, `hug`-width ~73px rail), while Recepten desktop and every EmptyState
frame instance it as `Collapsed=No` (`3674:5665`, fixed 198px). Nothing in
either design distinguishes "collapsed is the real Te-Doen default" from
"whoever last touched that frame happened to leave it collapsed" — there's no
prototype connection, annotation, or naming convention pointing either way.

Per the ticket: guessed at neither. `AppShellNav` (`app/(app)/_components/
AppShellNav.tsx`) hardcodes `useState(false)` — **expanded by default** —
and the collapse toggle is purely client-side from there, unpersisted. If a
future ticket needs the collapsed state to survive a reload (cookie/
localStorage/URL, the same three options `Sidebar.tsx`'s own doc comment
already names), that's a product decision to make explicitly, not something
to infer from which page frame happened to be collapsed when it was drawn.

## Desktop `fixed` sidebar + mobile drawer (issue 101, 2026-07-25)

Re-fetched via Figma MCP: `Desktop/Navigation/01`/`02` (3889:17167/17551,
expanded/collapsed), `Mobile/Navigation/01`/`02` (3889:15957/16101, drawer
closed/open). Confirmed against the payload: the mobile closed frame places
`Sidebar` at `x: -198` (off-canvas, `Collapsed=No`, i.e. full 198px width
even on mobile — there is no mobile "collapsed" variant), and the open frame
adds an `Overlay` rectangle (`rgba(12, 10, 9, 0.6)` — the exact same scrim
`SidePanel` already uses via `bg-text/60`) plus the same `Sidebar` instance
at `x: 0`, its own toggle showing `Icon/Panel-left-close`. The desktop frames
confirm `Sidebar` is a `vertical: fill` instance inside a `row`/`stretch`
root — i.e. Figma itself models it as filling the viewport height, which is
what `position: fixed` + `inset-y-0` gives it in code; Figma cannot express
`position: fixed` itself (same "structure yes, CSS mechanism no" gap #102
hit for `position: sticky`).

**Desktop — spacer + fixed, not a flex-row sidebar.** `Sidebar` now renders
`position: fixed; inset-y-0; left-0` (via a wrapping `hidden md:fixed
md:flex` div in `AppShellNav.tsx`) so it stays put while `main` scrolls
vertically. A `fixed` element takes no space in normal flow, so a second,
purely decorative `div` (`aria-hidden`, `shrink-0`) sits in the flex row in
its place, transitioning `width` between the same exported
`SIDEBAR_EXPANDED_WIDTH`/`SIDEBAR_COLLAPSED_WIDTH` constants (now `export`ed
from `Sidebar.tsx` instead of being redeclared) on the same
`--duration-base`/`--ease-base` as the real Sidebar's own collapse
transition, so the two never visibly desync. `main`'s pre-existing `md:pl-32`
is untouched — it is the separate Figma-sourced content inset from the
sidebar's *right edge*, orthogonal to the spacer, which reserves the sidebar's
own width. Fixed sidebar wrapper is `z-30`, below `SidePanel`'s `z-40`/`z-50`
and the mobile drawer below (also `z-40`/`z-50`) — never overlaps either,
confirmed by construction (desktop fixed sidebar only renders `md:` and up;
`SidePanel`/mobile drawer are unrelated subtrees).

**Mobile drawer.** Opened by a new icon-only `Button` (`PanelLeftOpen`)
rendered inside `main`, above `children`, `md:hidden` — the button #88
deliberately left out (its own code comment explained why: announcing a
control that does nothing is worse than no control) now has something to
open, so that comment is gone. Reuses the *same* `Sidebar` component
(`collapsed` left at its default `false`, matching the fetched node's own
always-198px mobile instance) inside a `fixed inset-y-0 left-0` wrapper that
translates in/out (`translate-x-0` / `-translate-x-full`), over an overlay
(`bg-text/60`, `z-40`) — pixel-for-pixel the fetched scrim, already a token
match. Panel wrapper is `z-50`, i.e. the exact same two-layer stack
`SidePanel.tsx` uses for its own overlay/panel.

**Closing.** Per the ticket's own field: overlay-click and Escape are
*"standaardgedrag, niet in Figma gemodelleerd"* — a codebase choice, not a
Figma requirement, flagged here as such. Reused `SidePanel`'s exact
overlay-click/Escape/Tab-trap/`inert`/focus-return shape, but
**reimplemented it locally in `AppShellNav.tsx`** rather than extracting a
shared hook: `SidePanel` is owned by a parallel ticket in this same round
(off-limits per this ticket's scope) and the two closing mechanisms
(`role="dialog"` bottom/side-sheet vs. a full-height nav drawer) don't share
a title contract, so lifting the ~25-line focusable/keydown helper pair into
its own file would be new shared surface for a single caller today — not
worth it yet. If a third consumer needs the same pattern, that's the trigger
to extract it, not this ticket. The in-sidebar toggle itself closes the
drawer (`onToggle` calls `setMobileOpen(false)`, so it renders
`Icon/Panel-left-close` per the fetched open-state node, matching Figma
exactly) in addition to overlay-click/Escape.

**Labels reused, no new i18n keys.** The open button's `aria-label` reuses
`components.sidebar.expandLabel` ("opens the currently-hidden/collapsed
sidebar" reads the same on mobile as on desktop); the drawer's own internal
close toggle reuses `collapseLabel` (closing the full-screen drawer is the
same "put the sidebar away" action `collapseLabel` already names for
desktop, and the ticket explicitly sanctioned reusing `expandLabel` rather
than minting a parallel key, and this follows the same reasoning
symmetrically for the close side). Both `nl.json`/`en.json` are unchanged by
this ticket, key sets already identical.

**Two `Sidebar` instances in the DOM simultaneously.** The desktop
fixed-position wrapper and the mobile-drawer wrapper both render `<Sidebar>`
(hence two `<nav aria-label>` landmarks in the DOM at once), gated
`hidden md:flex` vs. `md:hidden` respectively — exactly the same responsive
duplication `Sidebar`'s own `hidden md:flex` wrapper already used pre-#101
(the mobile side just used to render nothing). Only one is ever `display`ed
at a given viewport width, so only one is ever exposed to the accessibility
tree; verified in a real browser (Playwright MCP) at both 1440px and 402px
that exactly one `<nav>` is visible/focusable at a time, never both, never
neither.

**A repo-infra trap hit for the first time here:**
`scripts/check-server-only.sh`'s raw-hex grep is `(#|%23)[0-9a-fA-F]{3,8}\b`.
Every decimal digit (0-9) is also a valid hex digit, so *any* 3-digit ticket
number (100-999) — not just this one — false-positives as a 3-hex-digit
colour literal. Every prior ticket reference in `components/` was 1-2 digits
and coincidentally immune — `#99` is 2 digits and passes, `#100` onward does
not, so the repo crossed this threshold exactly here. That put two gates in
direct contradiction: `check:comment-budget` documents a bare `(#68)` pointer
as the correct way to cite a ticket, while `check:server-only` rejected it.

**Fixed at the source** during the #101/#102 merge review rather than worked
around: the guard now extracts candidate matches and keeps only those that
look like a real colour — containing an `a-f` letter, or exactly 6/8 digits
long. Verified to still catch `#fff`, `#0af`, `#123456`, `#0C0A09` and
`#00000000` while passing `#101`, `#999` and `#1234`. Accepted residual hole,
recorded in the script: an all-decimal 3- or 4-digit hex such as `#111` now
passes. Ticket references in `components/` use the ordinary `(#101)` form.

## Background fill + collapse text jump (issue 109, 2026-07-25)

Review-feedback round 2, both points scoped to `Sidebar.tsx` only. Re-fetched
node `3674:5664` via Figma MCP (fresh, not from this file) and its Dev Mode
annotations via the REST API (`GET .../nodes?ids=3674:5664`) — the raw
response contains zero `annotation` occurrences anywhere in the payload,
confirming #86's finding still holds: no Figma-sourced collapse-timing spec
exists for this node.

**1. Background fill — verified, not assumed, which of the two possible
cases holds.** Both `Collapsed=No` (`3674:5665`) and `Collapsed=Yes`
(`3632:460`) components resolve to `fills=fill_aa157800` = `#F5F5F4` —
exactly Tailwind stone-100, i.e. the existing `surface-muted` token. That is
**the same token** `AppShellNav`'s outer wrapper (`app/(app)/_components/
AppShellNav.tsx`, `<div className="flex min-h-screen items-stretch
bg-surface-muted">`, read-only here) already carries. So this is genuinely
the second of the two possible readings: **Figma's sidebar fill really does
equal the page background** — it is not that the nav was missing a
*different* colour Figma specifies. Desktop was not visibly broken; the
`<nav>` was already rendering `#F5F5F4` by inheritance from that wrapper
before this fix, coincidentally correct. The border (`border-r border-border`,
stone-300, unchanged by this ticket) wasn't the issue either — it already
matched the fetched node's stroke.

Given that, `bg-surface-muted` added directly to `<nav>` is a **no-op on
desktop** and real only for the **mobile drawer** (issue 101): that instance
sits in its own `fixed` wrapper with no background of its own and is not a
descendant of `AppShellNav`'s `bg-surface-muted` div, so inheritance does not
reach it — before this fix the drawer's `<nav>` was fully transparent over
the scrim. Checked in a real browser (Playwright, 402px viewport) post-fix:
the drawer now renders opaque `#F5F5F4`, matching the fetched
`Mobile/Navigation/02` frame; before the fix, page content bled through the
scrim underneath the nav's item list. Still correct to add explicitly on the
`<nav>` itself rather than continue relying on `AppShellNav`'s incidental
match — the component shouldn't depend on a parent's class for its own
Figma-specified fill. `AppShellNav.tsx` itself was only read, not edited, per
this ticket's scope.

**2. Collapse text jump.** Confirmed the stated cause: the old code rendered
two different `Button` elements depending on `collapsed` (icon-only with
`aria-label` vs. labelled with `{label}` children), so React swapped the
element on every toggle instead of animating it, and the label
appeared/disappeared in one frame. Fixed by rendering exactly one `Button`
per nav item in both states — always `icon` + `children={label}` — with
`className="overflow-hidden whitespace-nowrap"` at the Sidebar call site
(`Button.tsx` untouched, per scope).

**No `aria-label` on the nav items — `children` supplies the accessible name.**
This entry replaces an earlier, wrong conclusion, kept here because the
*measurement trap* behind it is the reusable lesson.

An intermediate pass restored `aria-label={label}` on every nav item, on the
finding that "any `Button` combining `icon` + `children` gets no accessible
name at all", attributed to a pre-existing `Button.tsx` defect. **That was
false.** The name computation works correctly through `Button.tsx`'s wrapping
`<span>` with an `aria-hidden` sibling `<svg>`. Verified against Chromium's
real accessibility tree via CDP (`Accessibility.getFullAXTree`) on the running
Ladle:

- `button--with-and-without-icon`: both instances, `aria-label=null`, one with
  an svg and one without → `name="Categorie"` for both.
- `sidebar--variants`, expanded items, `aria-label=null`, `hasSvg=true` →
  `name="To do"`, `"Notes"`, `"Recipes"`, `"Shopping basket"`, `"Clothes"`,
  `"Assistant"`.

**The trap: Playwright's ARIA snapshot is not the browser's accessibility
tree.** It is Playwright's own accname reimplementation, and in a
*quirks-mode* document — which is what a `data:text/html,…` page with no
doctype is, the natural shape for an "isolated synthetic-DOM test" — it
returns an empty name for exactly this markup. The same markup in a document
*with* a doctype names correctly, in both Playwright's implementation and
Chromium's. Ladle and the real app always have a doctype, so the empty result
never applied to them. Two tools disagreeing is a signal to find which one
models the browser, not to pick the alarming answer.

So: no `aria-label` here. `overflow-hidden` clips the label visually while
keeping it in the accessibility tree, which is exactly what the collapsed
state needs. A redundant `aria-label` duplicating visible text is worth
avoiding on its own terms — it silently wins over content, so if the two ever
drift the visible and spoken labels disagree. There is **no** `Button.tsx`
defect and nothing for another ticket to fix.

Why plain CSS suffices, no client JS: the item list div is `flex w-full
flex-col`, so each `Button` (no explicit width, default flex cross-axis
`stretch`) already fills the container's current width every frame as
`<nav>` animates between the two literal `SIDEBAR_EXPANDED_WIDTH`/
`SIDEBAR_COLLAPSED_WIDTH` values (#86's existing mechanism, unchanged).
`overflow-hidden` on the Button additionally sets its CSS automatic minimum
size to 0 instead of min-content (per the flexbox spec, any `overflow` value
other than `visible` does this), letting a Button actually shrink below its
label's natural width instead of overflowing the rail; `whitespace-nowrap`
(inherited from the Button root onto its text) stops the label from wrapping
instead of clipping as it's squeezed, which would be its own kind of jump.
At rest, collapsed: content box is nav's 73px width minus the 1px border and
two 16px paddings = 40px, exactly Figma's fixed 40×40 icon-only Button
footprint (`layout_983ba8a6` in the fetched node) — same number the #86
entry already derived, unchanged by this fix.

**Confirmed no text-jump, frame-by-frame** (Playwright MCP against
`pnpm ladle`'s `Sidebar--animated` story, real click on the toggle,
`requestAnimationFrame`-sampled `getBoundingClientRect()` on the active/
"Recepten" `Button` — not asserted, actually run): `left` stays pinned at a
constant value for every one of 24 sampled frames (the rail's own left edge
doesn't move, only its right edge recedes as it narrows), and `width` shrinks
strictly monotonically, one frame to the next, no jump or reset:
`165 → 126.7 → 105.9 → 90.5 → 76.8 → 67.2 → 58.6 → 52.1 → 47.3 → 43.8 → 41.5
→ 40.3 → 40` px, settling exactly at the 40px derived above and holding
there for the remaining sampled frames. A pre-#109 two-Button-swap
implementation would show a discrete width jump (one unmount/mount frame,
old width to new width with nothing in between); this is a continuous
curve — direct evidence the single-element/`overflow-hidden` fix produces
smooth clipping instead of a swap-induced jump.

**Pixel-parity.** `download_figma_images` on `3674:5665`/`3632:460` vs. the
Ladle `Variants` story: matches on fill, border, icon set, active-item
styling, spacing. One **pre-existing, not introduced by this ticket**
deviation confirmed: Figma's expanded nav-item Buttons are `hug`-sized per
label (explicit widths like 106/105/140/94px, one per item), not stretched
to the rail's full content width; this codebase's Buttons have stretched to
fill width since before #109 (necessary, see above — it's the mechanism that
lets the collapse transition run in pure CSS without measuring per-label
hug widths, which would need client JS and break the Server Component
precedent #86 set). Left as is; flagging here rather than fixing since it
predates this ticket and both points 1/2 above are silent on it. Also
observed, informational only: the fetched collapsed **active** item instance
(`3674:6766`, `Recepten`'s slot) carries an explicit `width: 68` and a
leftover `Text: "Categorie "` property, unlike its five siblings which are
`width: 40` with no stray text override — reads as an unfixed authoring
artifact on that one instance (same instance class the "Active item —
corrected 2026-07-22" entry above already caught once for its fill). Not
acted on: this codebase's CSS-stretch rendering makes every collapsed item
40×40 regardless, including the active one, so the artifact has no code
consequence either way.

**New, this ticket: a small honest deviation from Figma's collapsed
icon-only look, introduced by the overflow-clip fix itself.** Figma's
collapsed Button never has a text node at all (`"With text": false`
literally omits it). This fix keeps `children` mounted always and clips it
with `overflow-hidden`, so at rest a sliver of each label's first letter(s)
is visible past the icon — measured in a real browser (collapsed `nav`,
"Te doen" item): icon right edge at 24px + 8px left padding = 32px into the
button; the button's own border-box (where `overflow-hidden` actually
clips) is 40px, leaving an 8px gap that `gap-1` (4px) and the start of the
label's glyphs bleed into before the clip boundary — visible in the
regenerated `sidebar--variants` baseline. Not fixed further: the available
mitigations both cross a line — shrinking the collapsed width to hide it
would contradict the Figma-sourced 73px/40px measurement above, and forcing
tighter padding via a conflicting utility class (`pr-0` alongside `Button`'s
own `px-2`) is exactly the "mixing logical/physical padding utilities
doesn't override" trap `CLAUDE.md` warns about — same specificity, unreliable
win, not a safe fix from `className` alone. Judged an acceptable trade-off:
a ~4-8px letter sliver against a "no text jump" fix that needs no client JS
and touches no other file.

## TICKET #205 (2026-08-12): radius/spacing tokens

Measured via `figma_execute`/`boundVariables` on both `Collapsed=No`
(3674:5665) and `Collapsed=Yes` (3632:460) — identical bindings. Root
`gap-12`→`gap-stack-xxl` (`itemSpacing`→`spacing/stack/stack-xxl`), `p-4`→
`p-component-lg` (`padding*`→`spacing/component/padding-lg`). Nav-item list
`gap-3` ("Item container")→`gap-stack-md`. The `pt-[max(1rem,...)]`/
`pb-[max(1rem,...)]` safe-area overrides on top of `p-4` stay raw — same
reasoning as `AppShellNav.tsx`'s own `pt-`, out of this ticket's scope.

## TICKET #226 (2026-08-13): Kleding removed — five nav items

`SidebarItemId` and `NAV_ITEMS` lost `"clothes"` (the `Shirt` item), so the
rail renders five modules: Te doen, Notities, Recepten, Winkelmand,
Assistent. This follows the design rather than anticipating it — read off
the component set with the `figma-console` bridge on 2026-08-13: both
variants' "Item container" holds exactly five `Button/Default` instances,
with `Icon/Columns-3` / `Icon/Notebook` / `Icon/Folder-closed` /
`Icon/Shopping-basket` / `Icon/Astroid` and the labels above. The user
decision behind it is ADR-0016.

Two things measured in passing, neither acted on:

- `Collapsed=Yes`'s third item is still labelled **"Categorie"** where
  `Collapsed=No` says "Recepten". The label is clipped to zero width in the
  collapsed rail (see #112's sliver arithmetic above), so it renders
  identically either way and the code takes its labels from
  `messages/*.json` regardless — a Figma-side typo with no code consequence.
- `Icon/Shirt` is **still in the Figma "Icons" frame** (`3760:6187`, 47
  layers), which is why `IconName` keeps its `Shirt` entry — see
  `design/notes/Icon.md`.

Visual baselines regenerated for `sidebar--*` (one nav item fewer changes
the rail's content height), then the full suite re-run.

## TICKET #222 point 7 (2026-08-16): mobile drawer overlay was white in dark mode

`AppShellNav.tsx`'s mobile drawer scrim (this file's own #101 entry above
calls it out as "pixel-for-pixel the fetched scrim... `bg-text/60`") inverted
to a light wash in dark mode once #206 wired up the real theme switch:
`text-primary` (the renamed `text` token from #203 onward) flips from
stone-950 (light) to stone-50 (dark), which is correct for text but wrong for
a scrim meant to stay dark in both themes. The ticket asked to keep the
light-mode overlay colour in dark mode too.

Fixed at the token level, not the component: a new `overlay` semantic token
(`design/tokens.json`) pinned to `stone-950` in both `light`/`dark` — see
`design/notes/SidePanel.md`'s own #222 entry for the full token reasoning,
since `SidePanel.tsx`'s scrim had the exact same bug from the exact same
`bg-text-primary/60` class and both are fixed by the same token. This file's
only change is that one class, now `bg-overlay/60`; the "same scrim SidePanel
already uses" cross-reference in the #101 entry above still holds, just under
the new class/token name.

**Not independently screenshotted**: `AppShellNav.tsx` has no Ladle story
(it's wired to real routing/session, not story-able in isolation) — verified
instead by inspecting the generated `app/theme.css` (`--color-overlay` present
and identical in both the base `@theme` block and the `[data-theme="dark"]`
block) and by screenshotting `SidePanel`'s own scrim, which shares the
identical class and token, in both themes via a real browser.

## TICKET #265 (2026-08-16): account row + Settings/Logout dropdown

Re-fetched the Sidebar component set (`3674:5664`) via the `figma-console`
bridge — it now has a real `Account` frame at the bottom of both variants
(`4160:31007` expanded / `4160:32663` collapsed), and the root's own
`primaryAxisAlignItems` is now `SPACE_BETWEEN`, not the flat fixed gap #205
measured. So the root layout genuinely changed, not just gained a new child:
`Sidebar.tsx` now nests the toggle+nav-items block in its own wrapper div
(`gap-stack-xxl`, the same token the root itself used to bind — moved down
one level, same value) and lets the root's `justify-between` push `Account`
to the bottom, matching Figma's own two-child `space-between` reading
exactly rather than approximating it with a bigger fixed gap.

**Account row measurements** (`4160:31007`, `figma_execute`/`boundVariables`):
root `HORIZONTAL`, `itemSpacing` 8 → `gap-inline-sm` (`spacing/inline/gap-sm`),
`cornerRadius` 8 → `rounded-control` (`radius/control`) — bound despite the
static frame carrying no fill/stroke of its own (no Figma hover state
sampled either; the hover fill this ticket added is a codebase decision,
flagged in the component). Two children: `Thumbnail` (40×40 FRAME,
`cornerRadius` 6 → `rounded-control-inner`, unbound solid fill
`rgb(214,211,209)`/`#D6D3D1` — an **exact** match for the existing
`surface-secondary-hover` token, stone-300, reused for the initials-fallback
background) and `Name + icon` (89×16 FRAME, hug-sized, zero `itemSpacing`
— confirmed 73px text + 16px icon = 89 exactly, no gap between them —
containing a `TEXT` ("Youri Tukker", `text-xs/semibold`, fill `#0C0A09` =
stone-950 = `text-primary`) and `Icon/Ellipsis-vertical` INSTANCE at 16×16,
smaller than this atom's 24px default). **Collapsed variant confirmation**
(`4160:32663`): root is 40×40 with `clipsContent: true`; `Name + icon`
still reports its own natural 89px width at `x:48` — i.e. genuinely clipped
by the parent's overflow, not resized. `Sidebar.tsx` reproduces this with
the exact same mechanism `NAV_ITEMS` already uses (`overflow-hidden` on the
outer control, the label kept at its natural/`shrink-0` width rather than
allowed to flex-shrink) rather than inventing a second clipping idiom.

**The whole row is one plain `<button>`, not an `Atom/Button` instance** —
Figma's `Account` frame is not a `Button/Default` instance (unlike the
dropdown's own two menu items, which are), so wrapping it in the `Button`
atom would fight that atom's own height/padding assumptions (built for a
40px-tall pill, not a row containing a 40×40 avatar image). No `aria-label`:
same "children already supply the accessible name" reasoning as the
`NAV_ITEMS` lesson above (avatar `alt=""`, ellipsis icon already
`aria-hidden` inside the `Icon` atom) — the visible name text is the
button's accessible name, and `aria-haspopup="menu"`/`aria-expanded` supply
the rest.

**Initials fallback and avatar image are #265's own reading of the brief**,
not sourced from Figma (the fetched `Thumbnail` is a flat, unbound fill with
no text layer sampled at all — no initials treatment to copy). `initialsFor()`
is a plain, Figma-free helper (first letter of the first two words). No
upload UI exists (`avatar_url` stays `null` for every account until a future
ticket adds one) — `<img>` is used over `next/image` for the same reasoning
`Icon.md`'s flag entry gives: a fixed small size, no responsive `srcset`
need, and this codebase's own precedent (`RecipeDetailPage.tsx`,
`CardContentRecipe.tsx`).

**The dropdown opens upward (`bottom-full`), not downward.** Measured
directly, not guessed: the fetched frame places the `Dropdown` instance
(`4160:33132` mobile / `4160:33165` desktop) at `y:718` in an 874-tall
canvas, `height 92` — its own bottom edge (`718+92=810`) sits 8px above
where `Account`'s own top edge lands in that same frame (`874-16-40=818`),
an 8px gap matching `gap-inline-sm`. Positioning follows the exact
`relative` trigger + `absolute ... z-[999]` shape `TeDoenHeader.tsx`
already established for its own two header dropdowns (board switcher, sort)
— mirrored vertically (`bottom-full`/`mb-2` instead of `top-full`/`mt-2`)
since this trigger sits at the bottom of the rail instead of the top of a
header. Outside-click-to-close is NOT implemented inside this file (Sidebar
stays presentational/stateless) — it lives in `AppShellNav.tsx`, reusing the
exact `useCloseOnOutsidePointerDown` hook `TeDoenHeader.tsx` already defines,
keyed off the existing desktop-wrapper/mobile-drawer refs rather than a new
ref threaded into this atom (Sidebar isn't `forwardRef`, matching the old
`ButtonToggle` atom's own stated reason for walking the DOM by role instead
of a ref).

**The account `Dropdown` (`components/atoms/Dropdown.tsx`) is used
labelless** (Figma's `Name`/`Title` child is `visible: false` on both
`4160:33132`/`4160:33165`) — same mode `TeDoenHeader.tsx`'s board-switcher
and sort menus already use, so no new Dropdown behaviour was needed. Its two
`Slot` children are real `Button/Default` instances, verified via
`componentProperties`: `Settings` (`Style=Transparent`, icon `Icon/Settings`
node `4159:28770`, text "Settings") and `Logout` (`Style=Destructive`, icon
`Icon/Log-out` node `4159:28771`, text "Logout") — `Sidebar.tsx` renders
exactly those two `Button` variants/icons, composer-supplied Dutch/English
text via `settingsLabel`/`logoutLabel`.

**Not built: a visible hover/focus state on the dropdown's own trigger
button beyond the codebase-decision fill above** — Figma's Account frame
samples no interaction states at all (a single static frame, no Hover/Active
variant the way `Atom/Button` has), so nothing further was invented.
