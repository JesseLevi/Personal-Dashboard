# Incident archive

Append-only archive of per-ticket incident write-ups: defects that shipped past every CI gate, the merge-conflict resolutions for specific PRs, and the reasoning behind non-obvious fixes. These are moved here verbatim, not summarised, because the detail is the evidence base for why this project doesn't fully trust its CI gates. Nothing here is current status — entries are never updated once written. Read on demand when investigating a specific ticket, a recurring failure mode, or a past merge — never as part of session start.

## 2026-08-16 — `cva`'s base class silently beats a caller's bare `hidden`, because `cva` never merges classes (#263)

`NotitiesBoard.tsx`'s mobile Sorteer button rendered twice on mobile — once
icon-only, once with its label — even though the labelled instance carried
`className="hidden md:inline-flex"`. The bug was never in the responsive
logic; it was in where the visibility class landed.

`components/atoms/Button.tsx`'s `cva()` base class hardcodes `inline-flex`
(line 25 of the variant definition). `cva` does not do any form of
class-conflict resolution (it is not `tailwind-merge` and was never meant to
be) — it concatenates its own generated classes with whatever `className` the
caller passes, in source order, and lets the compiled stylesheet's own rule
order break the tie. Measured directly in `.next/static/css/*.css`: `.flex`
at offset 13458, `.hidden` at 13496, `.inline-flex` at 13540 — `.inline-flex`
is declared *after* `.hidden` in the emitted sheet, so on any element
carrying both classes, `.inline-flex` wins regardless of source-order intent.
`md:hidden` was unaffected because Tailwind emits media-query variants in
their own later block, past the bare utilities entirely — which is exactly
why this bug was invisible on desktop and only ever showed on mobile.

**The general trap, not just this button:** any `Button` (or any other `cva`
component whose base class carries its own `display` utility) that receives
a bare `hidden`/`block`/`flex` in its caller-supplied `className` is silently
broken the same way, with no lint/build error — `cva`'s job stops at string
concatenation. **Fix pattern**: put the visibility utility on a wrapping
element instead of on the `cva` component itself (`<span className="md:hidden">
<Button .../></span>`), never on the same element as a `cva` base class's own
display utility. `NotitiesBoard.tsx` already had one working precedent one
component away (`<div className="hidden md:block md:w-60 md:shrink-0">`
wrapping `NotesSearchField`, not applied to a `cva` component's own
className) — the Sorteer button just hadn't followed it. See
`design/notes/NotitiesBoard.md`'s updated "Header: two real buttons" section.

## 2026-08-11/12 — #204 assumed a Figma ramp-step name always equals the CSS state it's used in; that assumption was itself wrong, and the resulting "fix" was the real regression (#204, corrected by #213)

**This entry originally described a bug that never existed.** It claimed an
earlier ticket had misread Figma's swatches left-to-right, dropped the
Selected column, and shifted Button/White and Button/Distructive's Hover/
Active one place off — and that #204 fixed it. #213 re-measured every
individual state node for both styles via the figma-console-mcp plugin
bridge (`figma.variables`/`boundVariables`, a local WebSocket bridge with no
Starter-plan rate limit, so the fetch is now repeatable rather than resting
on a single report) and found the opposite: `git show
565a43d:components/atoms/Button.tsx`, the code *before* #204, already had
White's Hover reading `surface-highlight-white-selected` (stone-100),
Distructive's Hover/Active reading `priority-urgent-bg-hover`/`-active`
(then red-100/red-200 — pre-#204 values, since #204 also legitimately moved
those two token's own values to red-200/red-300 to match Figma's real
`.../hover`/`.../active` paths, a separate and correct fix), and both
styles' Selected equal to Default — the right *shape*, even where the right
*pixel* was reached by a coincidental borrow rather than a dedicated token:
White's pre-#204 Active read `surface-secondary` (stone-200 in light mode,
matching Figma's `.../hover` step by accident, but wrong in dark mode —
stone-800 vs the `.../hover` step's real stone-500). There was no
Default→Selected→Hover→Active shift to fix; #204 solved a real problem
(giving White/Distructive dedicated, dark-mode-accurate Hover/Active/
Selected tokens instead of pixel-coincidental borrows) and an imagined one
(reassigning which CSS state reads which token) in the same ticket, and only
the second part was wrong.

**What actually happened.** Figma's state ramps for White and Distructive run
`Default → Selected → Hover → Active`, and the ramp *step* names
(`default`/`selected`/`hover`/`active`) do not line up with the CSS *state*
each step renders in for these two styles specifically: the **Hover** state's
node is bound to the **`selected`** step, and the **Active** state's node is
bound to the **`hover`** step (Selected's own node is bound to `default` —
no fill change at all). Every other style (Filled, Outline, Transparent)
*does* have step-name-equals-state-name binding, and #204 generalised from
those to assume White/Distructive worked the same way. Under that
assumption, the pre-#204 code (Hover reading the `selected`-step token,
Active reading the `hover`-step token) looked like a one-column error, and
#204 "corrected" it to name-matches-state — which shifted both styles onto
the *wrong* pixels for real, and added a Selected fill neither style's node
actually has. That regression shipped to `main` and stayed there until
#213.

**Why it wasn't caught earlier.** Same blind-spot class as the screenshot-gate
and Card-content entries below: every CI gate — `check:server-only`'s hex
grep, `lint`, `typecheck`, and the visual-diff gate — compares rendered
output to a checked-in baseline, and #204 regenerated that baseline from its
own (wrong) reading, so the mistake was internally self-consistent and
passed every one of them. `pnpm check:tokens-drift`, also new in this
window, only checked that a token's *stored* value still matched its *named*
Figma path — it had no way to know the wrong *token* had been wired to a
given CSS *state* in `Button.tsx`, because that binding lives in component
code, not in `design/tokens.json`. A batch report ("fetched all 8 nodes,
here's the table") is exactly as capable of encoding this kind of
self-consistent wrong answer as a swatch read is — the fix needed a
repeatable, per-node measurement plus a name that could be checked against
prior art (`565a43d`), not a faster or larger one-shot fetch.

**What prevents it now.** `docs/design-tokens.md`'s "Ramp step name ≠ CSS
state name" rule states the White/Distructive offset explicitly, as the
documented exception to "step name equals state name" — so a future
re-binding has a named prior fact to check itself against instead of
re-deriving the assumption from scratch. `design/tokens.json`'s token
*names* were never touched by #213 (`surface-highlight-white-hover` etc.
still exist, still trace correctly to their own like-named Figma path) —
only `Button.tsx`'s class list, which now binds `hover:`/`active:` to the
token that the Hover/Active *node* actually uses rather than the
identically-named token. `pnpm check:tokens-drift` still cannot see a
consumer-side rebinding like this (it never inspects `.tsx` files); the
guard is the documented rule plus the bridge's per-node repeatability, not a
new automated gate. Full node-by-node measurement: `design/notes/Button.md`'s
#213 entry.

## 2026-08-10 — Hand-rolled EXIF stripping dropped the Orientation tag, shipping sideways phone photos (#174/#171)

`lib/recipes/thumbnail-validation.ts`'s original EXIF stripper (added for
#121, before this repo had any image-processing dependency) deleted the
JPEG APP1 segment wholesale to purge metadata before storing a recipe
thumbnail. That segment is also where the EXIF `Orientation` tag lives —
the flag a phone sets when a photo's raw pixel buffer is stored in one
rotation (e.g. landscape) but is meant to display in another (e.g.
portrait, because the phone was held sideways). Deleting the segment
outright discarded that instruction along with the metadata it was meant to
remove, so any photo relying on it rendered exactly as captured: sideways
or upside down. Nothing in CI or code review caught this because no test
exercised a rotated source image — every fixture used was already
upright.

Fixed in #174/#171 chunk 1 by replacing the hand-rolled stripper with
`sharp`, whose `.autoOrient()` (`lib/recipes/thumbnail-processing.ts`)
reads `Orientation`, physically rotates/flips the pixel buffer to match it,
*then* discards the tag — so the metadata is still fully stripped, but only
after it's been honoured rather than silently dropped. `tests/recipes-
thumbnails.test.ts`'s "honours EXIF orientation before discarding it,
unlike the old stripper" test is the regression guard: a 100×50 source
tagged `orientation: 6` (rotate 90° CW for display) must render as a
50×100 output.

## 2026-08-02 — The `db` CI gate shipped broken because it could never be run before merging (#121)

`20260801000001_recipe_thumbnails_storage.sql` (PR #147, ticket #121) added
`recipe-thumbnails` storage RLS plus `rls-recipe-thumbnails-storage.sql`'s
two-user object test, written and reviewed entirely without ever running it —
this dev machine has no Docker, so `pnpm test:rls` is CI/server-only
(`CLAUDE.md`, "This dev machine"). CI failed on every run of `main` since the
merge: `storage.protect_delete()`, a `BEFORE DELETE ... FOR EACH STATEMENT`
trigger Supabase's own storage migrations install on `storage.objects` to
force callers onto the Storage API, fires unconditionally on any direct SQL
`DELETE` — including the test's delete, which RLS correctly filters to zero
rows, except the trigger never gets to see that: it runs once per statement,
before RLS has a chance to matter. `is_empty(... delete ... returning id
...)` therefore aborted the whole transaction instead of returning an empty
set, and pgTAP's plan of 6 only ran 3 subtests. Fixed by setting
`storage.allow_delete_query to 'true'` for the one assertion that needs it —
the same session flag Supabase's own storage-api server sets on every
connection before it performs a delete on a caller's behalf, confirmed by
reading the storage repo's own migration source and connection code, not
guessed. **Lesson:** a gate that can only be verified by CI, never locally,
ships with exactly this kind of blind spot — this fix landed in its own PR,
after `main` had already been red for two PRs' worth of merges.

## Token changes — #97 (`design/tokens.json`)

Card `priority` scale collapses `urgent|medium|mid|low` to
`urgent|medium|low` (mid retired), with `medium` taking over `mid`'s blue
colour — see `design/notes/Tag.md` for the full Figma/annotation reasoning.

- `priority-medium` / `priority-medium-bg`: **orange-400/orange-50 → blue-400/blue-50**
  (now the same pixels the deleted `priority-mid` used to hold).
- `priority-mid` / `priority-mid-bg`: **deleted.** No consumer — `Tag.tsx`'s
  `mid` CVA variant is removed, and nothing outside `Tag.stories.tsx` ever
  passed `variant="mid"`.
- `tag-highlight` / `tag-highlight-bg`: **new**, orange-400/orange-50 (the
  pixels `priority-medium` used to hold). Backs `Tag`'s new `highlight`
  variant — Figma's Yellow `Color` axis value, kept for full Figma-axis
  coverage but deliberately named outside the `priority-*` family since it
  carries no priority meaning.

## Token changes — #56 and #68 (`design/tokens.json`)

### #56 — per-state colour scale

- `surface-hover`: stone-300 → **stone-50**. It had no consumer after #52; it now
  backs White's Hover.
- `surface-active` (stone-100): **new**. Shares its primitive with `surface-muted`
  but kept as a separate name — it is a state colour, a different role.
- `surface-raised-hover`: stone-400 → **stone-300** (that value is now Active).
- `surface-raised-active` (stone-400): **new**.
- `border-hover`: stone-500 → **stone-400** (Button/Outline's Hover). See the open
  question below for why Input-field no longer shares this token.
- `border-active` (stone-700): **new**, replacing `border-hover-strong`.
- `priority-urgent-bg-hover`: red-200 → **red-100**;
  `priority-urgent-bg-active` (red-200): **new**.
- **Removed** (no consumer left once Selected became text-only): `surface-selected`,
  `surface-raised-selected`, `border-selected`, `border-hover-strong`,
  `priority-urgent-bg-selected`.

### #68 — Button/Outline and Input-field border unification

The user re-authored `Atom/Button`'s Outline borders; re-fetching both nodes
(3623:4346, 3705:4402) confirmed three of the four states now match between
Button/Outline and Input-field, pixel-for-pixel:

- `border-hover`: stone-400 → **stone-500** (Button/Outline's Hover moved to
  meet Input-field's existing value). `border-input-hover` **deleted** —
  `InputField.tsx` now reads the shared `border-hover`.
- `border-selected`: **new**, stone-400. Outline's Selected gained a border
  for the first time since #56 (previously "border unchanged, text only") —
  and it lands on exactly the value Input-field's Selected already used.
  `border-input-selected` **deleted** — `InputField.tsx` now reads the shared
  `border-selected`. This is **not** the same removal #56 did to the old
  `border-selected` name (that one had no consumer once Selected went
  text-only everywhere); this is a fresh, independently-fetched Figma fact
  that happens to reuse the retired name because Outline's Selected border is
  back, for real, in the current node.
- `border-active`: stone-700 → **stone-800** (Button/Outline only). Its dark
  counterpart moves stone-300 → **stone-200** — this codebase's own pick (no
  Figma dark frames exist), shifted one stone step in the opposite direction
  from the light value's shift, consistent with how `border`/`border-hover`
  already pair light/dark shades in this file.
- `border-input-active` (stone-600): **unchanged, kept** — see `docs/open-questions.md#button-vs-input-active-border`.

Button.tsx's Outline variant also gains `aria-pressed:border-border-selected`
plus two compound-variant overrides (`aria-pressed:hover:border-border-hover`,
`aria-pressed:active:border-border-active`) so Selected's new border doesn't
silently suppress Hover/Active feedback — see "Selected must compose with Hover and Active" in `docs/design-tokens.md` for the full mechanism and the compiled-CSS evidence.

## 2026-07-22 — Sidebar's active-item fill was a Figma authoring mistake, not deliberate design (#25 follow-up)

The #25 write-up (below, "Carousel + Sidebar") concluded the active nav item's
stone-300 fill (Button's Hover component instead of every sibling's Default)
was real, deliberate design, because it read the same across both
independently-rendered `Collapsed=No`/`Collapsed=Yes` variants — and shipped a
`bg-surface-raised-hover!`/`active:bg-surface-raised-active!` stopgap plus
`docs/open-questions.md#selected-needs-a-fill-token`. The user reports it was
simply authored wrong in Figma (Hover picked instead of Selected) in both
places at once, and has now corrected it. Re-fetching node `3674:5664`
confirms the active item resolves to `Style=Filled, State=Selected`
(componentId `3822:6637`): fill back to `surface-raised`, text darkened to
`text` — Button's existing Selected state, no override needed.
`Sidebar.tsx`/`design/notes/Sidebar.md` updated to drop the `!` overrides in
favour of `aria-pressed`; the open question is resolved and removed.
**Lesson:** "two variants agree" rules out a stray pointer capture, but not a
copy/paste authoring mistake made consistently in both places — cross-variant
agreement is necessary evidence, not sufficient, for "deliberate design."

## 2026-07-22 — The screenshot gate shipped blind (#6)

The first implementation of the Playwright baseline gate passed its own
author's verification and would have been merged as working. It could not see
the defect class it was built for.

- **`maxDiffPixels: 0` does nothing on its own.** Playwright's `threshold`
  (per-pixel colour distance, YIQ, **default 0.2**) is applied first: any pixel
  closer than it is counted as identical, so the diff count never rises and the
  pixel budget is never reached. Both knobs must be zero.
- **How it was caught.** Re-injecting the real shipped defect #5 (Sidebar's
  active nav item, stone-300 -> stone-200) into the branch: all three sidebar
  tests passed. The built bundle contained the defect, the served page rendered
  `oklch(0.923)` instead of `oklch(0.869)`, and a baseline written from scratch
  showed RGB (231,229,228) against the committed (214,211,209) — so the capture
  was correct and only the *comparison* was blind. With `threshold: 0` the same
  defect reports 7248 differing pixels and fails.
- **Why the author's own probe gave false confidence.** It broke `Tag`'s
  "urgent" variant red -> green. That colour distance happens to exceed 0.2, so
  it failed as expected. Grey-on-grey token mistakes — this project's most
  common visual defect, and the reason #6 exists — sit well inside the default.
- **Lesson for any future gate: verify it with the defect you actually ship,
  not a dramatic one.** A verification probe that is easier to detect than the
  real failure mode proves nothing.

## 2026-07-22 — Carousel + Sidebar (#24, #25)

Last two Phase 2 organisms, one Sonnet agent each, reviewed by putting the fetched node next to the rendered code. **Both shipped a defect that every CI gate passed.** Both were caught only by measuring the rendered DOM in a browser against the node's own numbers — the fourth and fifth such catch. This is now the rule, not the exception: `lint`/`typecheck`/`test`/`check:server-only` cannot see a wrong colour or a wrong width.

- **`Carousel`'s columns are fixed 280px and are *meant* to overflow.** The node puts `sizing: fixed, width: 280` on all three `Card-container` instances against a root `designedWidth: 644px` — 3×280 + 2×16 = **872px in a 644px frame**. That 228px overflow is the whole reason it is a Carousel and not a row. The first implementation rendered `w-full` equal-fill columns (measured 368px), which can never overflow and so can never scroll; the agent measured 368 itself and rationalised it away as "emergent from `CardContainer`'s `w-full`". Now structural: each child is wrapped in `w-70 shrink-0 [&>*]:h-full`. Verified 280×296 per column, 16px gaps, 644/872/228.
- **`Sidebar`'s active nav item is stone-300, one shade darker than a resting Filled button (stone-200).** The agent read this as a "hover captured mid-snapshot" artifact and shipped stone-200. Pixel-sampling the component set disproves it: the active pill is `#D6D3D1` and the toggle `#E7E5E4` **identically in both the `Collapsed=No` and `Collapsed=Yes` variants** — one stray pointer cannot tint the same item across two independently-rendered variants. Deliberate design.
- **That fix then caused a second defect: `!important` silently killed pointer feedback.** `bg-surface-raised-hover!` outranks `Atom/Button`'s own non-important `active:bg-surface-raised-active`, so the active item went dead on press (measured flat `0.869` across resting/hovered/pressed, while a plain-Filled control ramped `0.923 → 0.869 → 0.709`). Fixed with a compound `bg-surface-raised-hover! active:bg-surface-raised-active!`. **If you ever override a Button fill from a composer, override the state variants too** — `docs/design-tokens.md` calls a selected item still reacting to the pointer a product requirement.
- **Use a control when probing CSS states.** The first probe used an idle sibling as control — but those are `variant="transparent"`, which has no fill in any state by design, so it proved nothing. The sidebar's own collapse toggle (plain `filled`) is the correct control.
- **`Icon/Astroid` is lucide `Sparkle`** — fifth false-friend name. Verified by rendering: `Sparkle` is one four-point path, `Sparkles` adds three elements, `Asterisk` is three lines.

## 2026-07-21 — Card-content molecules + a CI gate hole (#19, #20)

First two `Card-content/*` molecules, each built by its own Sonnet agent from a live MCP fetch, then reviewed.

- **`Card-content/Ingredient`'s `State` axis is `Default | Active | Delete` — there is no Hover.** `Active` is mapped to CSS `:active` per `docs/design-tokens.md`, consistent with #56/#58 under the same state name. The consequence is deliberate and **needs a design answer**: an ingredient row has *no pointer affordance at all* — hovering does nothing, only pressing does. Recorded as `docs/open-questions.md#no-pointer-affordance`, together with the same gap in `Atom/Button`'s Transparent style, which **`Atom/Button-toggle`'s segments inherit**, since they render as `Button variant="transparent"`. One design decision, three components.
- **`State=Delete` is structural, not a pointer state.** Its pill (fill/radius/padding) is unconditional and the Trash button is a *sibling outside* it. The first implementation painted the pill only on `hover:`/`focus-within:` — which also meant focusing the delete button never triggered it. Don't collapse the delete and non-delete branches back into one wrapper: their fill semantics genuinely differ.
- **`check:server-only`'s hex gate had a hole: percent-encoded hex.** A story's placeholder data-URI carried `fill='%23A8A29E'` and passed CI, because the gate grepped `#[0-9a-fA-F]{3,8}` only. Now `(#|%23)[0-9a-fA-F]{3,8}` — fixed in #66 and verified by probe (clean → fails on an inserted `%23AABBCC` → clean again). Any future encoded colour is caught.
- **Icons: `Timer`, verified by path-diff, not by name.** The node's time glyph was an *unnamed* IMAGE-SVG. Candidate lucide exports were rendered and their paths compared against the Figma vector (`AlarmClockCheck` ruled out: six elements vs three). This is the fourth time shape-verification mattered — keep doing it.
- **Both molecules pass `<img>` straight through, not `next/image`**, because no image host is registered in `next.config.ts`. ESLint warns; the choice is documented in the component. Revisit when the host exists.

**Process note:** three Sonnet agents hit the account session limit mid-run this round. Their partial work was recoverable in every case because it sat committed or staged in their worktrees — check `git -C <worktree> status` and `log` before assuming a dead agent produced nothing, and tell the resuming agent explicitly what is already done so it doesn't redo it.

**Review note:** a half-applied fix passed `lint`, `typecheck`, `test` *and* `check:server-only` — the Delete pill got its radius and padding but no `bg-surface-raised`, so it rendered invisible. No gate in this project can see a missing colour. That is the third such catch found only by putting the fetched node next to the code by hand. The screenshot gate meant to close this class is #6 — see its own entry below, and the visual-gate bullet in `docs/HANDOFF.md` for what is still unarmed.

## 2026-07-21 — #66 and #67 merge (tickets #19, #20)

Both branches were rebased onto `6d2be6e` before `#68`/`#69` landed. `#66` merged clean. `#67` then conflicted on `design/figma-map.json` exactly as predicted (adjacent lines 19/20) — resolved by keeping the `"nodeId"`-populated line from each side and discarding both `"nodeId": null` stubs. `docs/design-tokens.md` auto-merged correctly (open question 5 appended, question 1 kept `main`'s newer wording). `messages/en.json`/`nl.json` key sets verified identical post-merge.
