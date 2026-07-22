# Incident archive

Append-only archive of per-ticket incident write-ups: defects that shipped past every CI gate, the merge-conflict resolutions for specific PRs, and the reasoning behind non-obvious fixes. These are moved here verbatim, not summarised, because the detail is the evidence base for why this project doesn't fully trust its CI gates. Nothing here is current status — entries are never updated once written. Read on demand when investigating a specific ticket, a recurring failure mode, or a past merge — never as part of session start.

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

**Review note:** a half-applied fix passed `lint`, `typecheck`, `test` *and* `check:server-only` — the Delete pill got its radius and padding but no `bg-surface-raised`, so it rendered invisible. No gate in this project can see a missing colour. That is the third such catch found only by putting the fetched node next to the code by hand. See #6 under Next actions in `docs/HANDOFF.md`.

## 2026-07-21 — #66 and #67 merge (tickets #19, #20)

Both branches were rebased onto `6d2be6e` before `#68`/`#69` landed. `#66` merged clean. `#67` then conflicted on `design/figma-map.json` exactly as predicted (adjacent lines 19/20) — resolved by keeping the `"nodeId"`-populated line from each side and discarding both `"nodeId": null` stubs. `docs/design-tokens.md` auto-merged correctly (open question 5 appended, question 1 kept `main`'s newer wording). `messages/en.json`/`nl.json` key sets verified identical post-merge.
