# Atom/Button

- **Code:** `components/atoms/Button.tsx`
- **Node ID:** `3623:4346`

CVA variant=filled|outline|white|transparent|destructive (Figma 'Distructive'); Hover/Selected are CSS states. 'Selected' was renamed from 'Active' in Figma 2026-07-20 (ticket #42, mis-naming corrected upstream) — re-fetched node confirms every style's State enum is now Default/Hover/Selected, same fills/text as before the rename, no pixel change. Modelled via `aria-pressed:` (not `active:` — CSS :active means 'being pressed', a different, non-persistent thing), same idiom as Atom/Button-Toggle; caller sets the standard `aria-pressed` attribute, not a new prop. 'With icon'/'With text' modelled as presence of the `icon`/`children` props; icon-only requires aria-label (type-enforced). Figma's Filled/Selected instance has drifted padding (uniform 8px vs 4px/8px elsewhere) — treated as auto-layout drift, not modelled. Hover fill/stroke use the dedicated surface-hover / border-hover semantic tokens (added 2026-07-20; same stone-300/stone-500 primitives, named for their role). Dark mode (ticket #42): surface-raised/surface-hover/surface/border/border-hover/text/text-muted/priority-urgent-bg now carry a dark override in design/tokens.json → emitted as a `[data-theme="dark"]` block in app/theme.css by `pnpm sync:tokens` (that attribute is what @ladle/react's Light/Dark toggle sets on <html>). No Figma dark-mode frames exist for this node, so the dark shades (stone-700/800/900/400, red-950 — all newly added stock-Tailwind primitives, no one-off hex) are this fix's own pick, not a Figma-sourced value; component classes needed zero changes (no `dark:` utilities) since they were already semantic-token-only — the bug was entirely in the token pipeline, which previously emitted no dark values and no dark selector at all.

## TICKET #238 (2026-08-13) — Transparent's Hover/Active fill rebound in Figma, onto the Filled ramp

**Ticket premise, verified not assumed.** "Button component updated transparent hover and active color" — re-measured all 5 styles × 4 states (Alignment=Center, `3623:4346`) via the figma-console-mcp bridge (`figma_get_status probe:true` confirmed "Notion - V2" connected), reading `boundVariables.fills[0]`/`.strokes[0]` off each state node plus the fill on its TEXT child, resolved through `figma.variables.getVariableByIdAsync()` — never inferred from a resolved hex, per the standing #204/#213 lesson.

| Style | State | Node | Bound fill/stroke variable | Bound text variable |
|---|---|---|---|---|
| Filled | Default | `3623:4344` | `color/surface/secondary/default` | `color/text/base/secondary` |
| Filled | Hover | `3674:6522` | `color/surface/secondary/hover` | `color/text/base/secondary` |
| Filled | Active | `3782:4800` | `color/surface/secondary/active` | `color/text/base/secondary` |
| Filled | Selected | `3822:6637` | `color/surface/secondary/default` (unchanged) | `color/text/base/primary` |
| White | Default | `3674:6515` | `color/surface/highlight/white/default` | `color/text/base/secondary` |
| White | Hover | `3784:4076` | `color/surface/highlight/white/**selected**` | `color/text/base/secondary` |
| White | Active | `3782:4908` | `color/surface/highlight/white/**hover**` | `color/text/base/secondary` |
| White | Selected | `3822:6642` | `color/surface/highlight/white/default` (unchanged) | `color/text/base/primary` |
| **Transparent** | Default | `3782:4793` | no fill | `color/text/base/secondary` |
| **Transparent** | **Hover** | `3784:4081` | **`color/surface/secondary/hover`** (was `color/surface/highlight/white/hover`, #204) | `color/text/base/secondary` |
| **Transparent** | **Active** | `3782:4913` | **`color/surface/secondary/active`** (was `color/surface/highlight/white/active`, #204) | `color/text/base/secondary` |
| Transparent | Selected | `3822:6652` | no fill (unchanged) | `color/text/base/primary` |
| Outline | Default | `3782:4154` | stroke `color/Stroke/primary/default` | `color/text/base/secondary` |
| Outline | Hover | `3784:4086` | stroke `color/Stroke/primary/hover` | `color/text/base/secondary` |
| Outline | Active | `3782:4918` | stroke `color/Stroke/secondary/active` | `color/text/base/secondary` |
| Outline | Selected | `3822:6647` | stroke `color/Stroke/primary/selected` | `color/text/base/primary` |
| Destructive | Default | `3693:3386` | `color/surface/highlight/red/default` | `color/text/highlight/red` |
| Destructive | Hover | `3784:4091` | `color/surface/highlight/red/**selected**` | `color/text/highlight/red` |
| Destructive | Active | `3782:4923` | `color/surface/highlight/red/**hover**` | `color/text/highlight/red` |
| Destructive | Selected | `3822:6657` | `color/surface/highlight/red/default` (unchanged) | `color/text/highlight/red` |

Transparent's Hover/Active nodes were spot-checked on `Alignment=Left` too (`3917:24944`/`3917:24936`) — same `surface/secondary/hover`/`surface/secondary/active` bind, confirming this is a Style-level rebind, not per-alignment drift.

**Result: only Transparent's Hover/Active fill changed.** Every other style/state binding is byte-identical to #213's table above — White/Distructive's Hover←`selected`-step/Active←`hover`-step offset is unaffected and still holds; Filled and Outline are unaffected, as they have been since #204/#107. Transparent's fill moved off the White ramp (`surface/highlight/white/hover|active`, bound since #204) onto the same ramp Filled's Hover/Active already use (`surface/secondary/hover|active`) — same variable IDs (`VariableID:3815:6611`/`VariableID:3815:6612`) as Filled's own Hover/Active, confirmed by comparing the two styles' `boundVariables` side by side, not by name alone.

**Variable *values* did not change — this is a pure rebind.** Resolved `valuesByMode` for every touched variable, cross-checked against `design/tokens.json`:

| Variable | Light | Dark | Matches `design/tokens.json`? |
|---|---|---|---|
| `surface/secondary/hover` | stone-300 | stone-700 | yes — `surface-secondary-hover`, no drift |
| `surface/secondary/active` | stone-400 | stone-600 | yes — `surface-secondary-active`, no drift |
| `surface/highlight/white/hover` | stone-200 | stone-500 | yes — `surface-highlight-white-hover`, no drift |
| `surface/highlight/white/active` | stone-300 | stone-400 | yes — `surface-highlight-white-active`, no drift |
| `surface/highlight/white/selected` | stone-100 | stone-600 | yes — `surface-highlight-white-selected`, no drift |

No token value in `design/tokens.json` needed a change and `pnpm sync:tokens` was not run — this is purely a consumer-side rebind in `Button.tsx`, exactly the class of fix #213 made for White/Distructive, just triggered by a real Figma rebind this time rather than a mismeasurement. `surface-secondary-hover`/`-active` already existed (Filled's own tokens) so no new token was added; `surface-highlight-white-hover`/`-active` are unchanged and stay in `design/tokens.json` (still real, Figma-sourced, `text.test.ts`-covered) — `surface-highlight-white-active` now has no component consumer (White's Active reads `-hover` per the ramp-step offset, and Transparent no longer reads `-active`), which is not a reason to delete a token that still traces to a live Figma variable.

**The fix.** `buttonVariants`' `transparent` entry: `hover:bg-surface-highlight-white-hover active:bg-surface-highlight-white-active` → `hover:bg-surface-secondary-hover active:bg-surface-secondary-active`. `docs/design-tokens.md`'s state matrix row for Transparent updated to match.

**Ladle stories affected (pixel change).** `Button.stories.tsx` currently exports `StateMatrix`, `WithAndWithoutText`, `WithAndWithoutIcon`, `TrailingIcon`, `Alignment` — only `StateMatrix` iterates all 5 variants (including `transparent`) via its `VARIANTS` array; every other story renders the default (`filled`) variant. So exactly one story moves: **`button--state-matrix`**, specifically the Transparent row's "Hover / Active (hover and hold)" and "Selected (+ hover / hold)" columns (the Selected column also composes with hover/active on this row). No other Button story, and no `ButtonToggle`/`Dropdown`/`CardDetailPanel` story, is affected — none of those use `variant="transparent"` (`ButtonToggle.tsx`'s segments do, but its local `hover:bg-transparent! active:bg-transparent!` override makes it variant-value-independent, re-verified live at #112).

## TICKET #213 (2026-08-12) — #204's state-binding "fix" was itself the bug; reverted at the consumer, not the token names

**Measurement method, repeatable a third time.** Figma MCP is still rate-limited (Starter plan). The figma-console-mcp plugin bridge — a local WebSocket connection into a running Figma plugin session, no Starter-plan limit — was used instead to run `figma.variables.getVariableByIdAsync`/`node.boundVariables` directly against each of the 8 individual `Style=X, State=Y` variant nodes under `3623:4346` (same 8 nodes #204 fetched, same technique in spirit — `get_metadata`-then-`get_variable_defs` — just over a different transport). This is the same class of measurement #204 already did; #213 is not a new method, it's a repeat of #204's own method that reached a different, correct conclusion.

**The result disagrees with #204's table.** Per-node `boundVariables.fills[0].color` resolution:

| Style | State | Node | Bound variable | Resolved hex |
|---|---|---|---|---|
| White | Default | `3674:6515` | `color/surface/highlight/white/default` | `#FFFFFF` |
| White | Hover | `3784:4076` | `color/surface/highlight/white/**selected**` | `#F5F5F4` (stone-100) |
| White | Active | `3782:4908` | `color/surface/highlight/white/**hover**` | `#E7E5E4` (stone-200) |
| White | Selected | `3822:6642` | `color/surface/highlight/white/**default**` (+ text→`text/base/primary`) | `#FFFFFF` (unchanged) |
| Distructive | Default | `3693:3386` | `color/surface/highlight/red/default` | `#FEF2F2` (red-50) |
| Distructive | Hover | `3784:4091` | `color/surface/highlight/red/**selected**` | `#FFE2E2` (red-100) |
| Distructive | Active | `3782:4923` | `color/surface/highlight/red/**hover**` | `#FFC9C9` (red-200) |
| Distructive | Selected | `3822:6657` | `color/surface/highlight/red/**default**` (unchanged, no text variable) | `#FEF2F2` |

This is byte-identical to #204's own node-by-node table (reproduced above in that ticket's entry) — **#204 measured this correctly and then bound it backwards anyway**. #204's write-up reads the table as "every state instance is bound one column early on the ramp" and "fixes" each CSS state to read its own like-named variable (Hover state → `hover` variable). That's the error: the table already shows Hover's *node* is bound to the `selected` *variable*, which is simply what "Hover reads a differently-named step" means, not a mis-authored/shifted node. Cross-checked against `git show 565a43d:components/atoms/Button.tsx` (the code before #204): White's Hover already read `surface-highlight-white-selected`; Distructive's Hover/Active already read `priority-urgent-bg-hover`/`-active` at their *pre-#204 values* (red-100/red-200, which #204 separately and correctly moved those two token names to red-200/red-300 as real Figma-value drift fixes — see `design/tokens.json`'s own #204 history comment). Both styles' pre-#204 Selected already resolved to Default (no override). The only place pre-#204 code was actually wrong: White's Active read `surface-secondary` (stone-200 light — a coincidental pixel match to the `hover`-step value, not a real binding to it; wrong in dark mode, stone-800 vs the `hover` step's real stone-500).

**The fix.** Per `docs/design-tokens.md`'s new "Ramp step name ≠ CSS state name" rule: token *names* are untouched (`surface-highlight-white-hover/-active/-selected`, `priority-urgent-bg-hover/-active/-selected` all keep their #204 names and #204 values, all still trace correctly to their own like-named Figma path — `pnpm check:tokens-drift` never flagged anything here, because nothing about the *tokens* was ever wrong). Only `buttonVariants`' `white`/`destructive` entries changed, to bind each CSS state to the token holding the pixel that state's *node* actually uses:

```
white: "... hover:bg-surface-highlight-white-selected active:bg-surface-highlight-white-hover aria-pressed:text-text-primary"
destructive: "... hover:bg-priority-urgent-bg-selected active:bg-priority-urgent-bg-hover"
```

No `aria-pressed:bg-*` on either — Selected has no fill on these two styles, full stop, so the `aria-pressed:hover:`/`aria-pressed:active:` compound variants #204 added (to guard a same-property conflict between a Selected fill and Hover/Active) are removed too: there is no Selected fill left to conflict with anything. Verified against the compiled `pnpm ladle:build` stylesheet: no `aria-pressed\:bg-surface-highlight-white-selected[aria-pressed=true]` or `aria-pressed\:bg-priority-urgent-bg-selected[aria-pressed=true]` rule exists in the output; `hover:`/`active:` apply unconditionally regardless of `aria-pressed`, which is correct since a selected White/Distructive button still needs pointer feedback and there is no longer a background-color it could compete with.

**`CardDetailPanel.tsx`'s two option-row hovers, measured in the same pass.** The Dropdown node (`3705:4446`) the rows live in was fetched to answer a different question (#213 point 2, the token-drift audit) and turned out to answer this one too: the option rows render as `Button/Default` instances with fill `color/surface/highlight/white/default` — i.e. they *are* `Button variant="white"` instances, not a generic surface. Their hover therefore follows this ticket's White fix directly: `hover:bg-surface-highlight-white-selected`, not `surface-highlight-white-hover` (what #204 had them on) or `surface/primary/hover` (what a first read of #204's own gap-list suggested before this node was actually fetched — see `design/notes/CardDetailPanel.md`'s #213 entry).

**Filled/Outline/Transparent reconfirmed unaffected**, same as #204 found: their state-node bindings already match their state names 1:1. This is *why* the White/Distructive offset is easy to miss — it's the exception among five styles, not the rule.

## TICKET #204 (2026-08-11) — state-binding fix (White/Distructive column shift) + dark values

**The bug, measured per-state, not assumed.** #203 renamed every token onto its Figma variable path but kept every *value* byte-identical (by design — a rename-only ticket). This ticket re-fetched the 8 individual White/Distructive state nodes under `3623:4346` (`get_metadata` first to resolve each `Style=X, State=Y, Alignment=Center` symbol to its own node-id, then `get_variable_defs` per node) and found the color variable each node's fill is *actually bound to* disagrees with its own `State` label:

| Style | State (label) | Node | Bound variable | Resolved hex |
|---|---|---|---|---|
| White | Default | `3674:6515` | `color/surface/highlight/white/default` | `#FFFFFF` |
| White | Hover | `3784:4076` | `color/surface/highlight/white/**selected**` | `#F5F5F4` (stone-100) |
| White | Active | `3782:4908` | `color/surface/highlight/white/**hover**` | `#E7E5E4` (stone-200) |
| White | Selected | `3822:6642` | `color/surface/highlight/white/**default**` (+ text→`text/base/primary`) | `#FFFFFF` (unchanged) |
| Distructive | Default | `3693:3386` | `color/surface/highlight/red/default` | `#FEF2F2` (red-50) |
| Distructive | Hover | `3784:4091` | `color/surface/highlight/red/**selected**` | `#FFE2E2` (red-100) |
| Distructive | Active | `3782:4923` | `color/surface/highlight/red/**hover**` | `#FFC9C9` (red-200) |
| Distructive | Selected | `3822:6657` | `color/surface/highlight/red/**default**` (unchanged, no text variable) | `#FEF2F2` |

Every state instance is bound one column early on the `default -> selected -> hover -> active` ramp — exactly the mis-authoring the ticket hypothesized (the swatches were once read `default -> hover -> active`, skipping `selected`, so each later state picked up the fill meant for the state before it). Cross-checked against `design/figma-variables/Semantics _ Style_Light.tokens.json` directly (not just the two mis-bound nodes) to get the CORRECT same-named-variable value for each state: `white/hover` = `#E7E5E4` (stone-200), `white/active` = `#D6D3D1` (stone-300), `red/hover` = `#FFC9C9` (red-200), `red/active` = `#FFA2A2` (red-300, new primitive — Tailwind's stock red-300, not previously in this file's primitive scale). The fix binds each CSS state hook to its *like-named* Figma variable (Hover state → `hover` variable, Active state → `active` variable, Selected → `selected` variable) rather than perpetuating what's literally painted on the mis-authored node — this is the correct read per the ticket's own expected table, which this measurement independently reproduces.

**New tokens**: `surface-highlight-white-hover` (stone-200), `surface-highlight-white-active` (stone-300) — White didn't have dedicated Hover/Active tokens before (it borrowed `surface-highlight-white-selected`/`surface-secondary` pixel-for-pixel, which is *why* the bug was invisible: the borrowed light-mode pixels happened to be correct even though the token was semantically wrong). `surface-highlight-white-selected` (already existed, stone-100) now genuinely backs Selected instead of Hover. Distructive gets `surface-highlight-red-selected`/`priority-urgent-bg-selected` (new, red-100) for its first-ever Selected fill; `surface-highlight-red-hover`/`-active` move to red-200/red-300 (from red-100/red-200).

**Transparent — measured, not assumed to be a naming coincidence.** Transparent's own Hover/Active nodes (`3784:4081`, `3782:4913`) are bound to `color/surface/highlight/white/hover` and `color/surface/highlight/white/active` respectively — the SAME white-ramp variables Button/White reads, not `surface-secondary`/`surface-secondary-hover` (a different variable that happened to resolve to the same light-mode hex, stone-200/stone-300). `buttonVariants`' `transparent` key now reads `hover:bg-surface-highlight-white-hover active:bg-surface-highlight-white-active`. This is a real rebind, confirmed by the dark values genuinely differing: `surface-secondary-hover` dark is stone-700, `surface-highlight-white-hover` dark is stone-500 — a visible dark-mode change, not a no-op.

**Selected now shares `background-color` with Hover/Active on White and Distructive** — previously Selected touched only `text` on these two styles (disjoint from Hover/Active's `background-color`), same class of conflict #68 fixed for Outline's `border-color`. Verified against the compiled `pnpm ladle:build` stylesheet, not assumed: emission order is `hover:` / `active:` / plain `aria-pressed:bg-*` / then the two compound `aria-pressed:hover:` / `aria-pressed:active:` rules — the plain rule would win over hover/active at equal specificity (2 class-level terms each) since it's emitted last, exactly the failure mode #68 documented; the compound rules (3 class-level terms: class + `[aria-pressed=true]` + `:hover`/`:active`) win unconditionally by specificity, matching pattern. Grepped selectors:

```
.hover\:bg-surface-highlight-white-hover:hover{background-color:var(--color-surface-highlight-white-hover)}
.active\:bg-surface-highlight-white-active:active{background-color:var(--color-surface-highlight-white-active)}
.aria-pressed\:bg-surface-highlight-white-selected[aria-pressed=true]{background-color:var(--color-surface-highlight-white-selected)}
.aria-pressed\:hover\:bg-surface-highlight-white-hover[aria-pressed=true]:hover{background-color:var(--color-surface-highlight-white-hover)}
.aria-pressed\:active\:bg-surface-highlight-white-active[aria-pressed=true]:active{background-color:var(--color-surface-highlight-white-active)}
```

Same pattern verified for `priority-urgent-bg-selected`/`-hover`/`-active` on Distructive. Distructive's Selected text stays `priority-urgent` (no text change — Figma's Selected node carries no text variable, consistent with the pre-existing "Distructive text never changes" rule); only the fill is new.

**Dark mode.** All 13 tokens #203 marked `$pendingFigmaValue` resolved to exactly the value it had already provisionally recorded (cross-checked against `Semantics _ Style_Dark.tokens.json`, not re-guessed). Two accepted-not-fixed quirks, both genuine Figma facts confirmed via the dark export rather than codebase artifacts: (1) every red-highlight state (`default/selected/hover/active`) resolves to the same red-50 in dark mode, so Distructive has no visible hover/press/selected feedback there; (2) `surface-highlight-white-active`'s dark value (stone-400) is lighter than `-hover`'s (stone-500) — backwards from the light-mode escalation direction, same shape as the gap #112 flagged for the old borrowed tokens, now reproduced on the new dedicated ones because it's Figma's own dark data, not this codebase's pick. Per the ticket's explicit instruction, neither is flagged for a fix.

**Filled and Outline confirmed unaffected** — re-fetched Outline's 4 state nodes (`3782:4154`/`3784:4086`/`3782:4918`/`3822:6647`) and all four are bound to their like-named variable already (`Stroke/primary/default|hover|selected`, `Stroke/secondary/active`), no column shift. This also closes `docs/open-questions.md#button-vs-input-active-border`: Button/Outline's Active is `Stroke/secondary/active` (stone-800), Input-field's Active is `Stroke/primary/active` (stone-600) — two distinct, correctly-bound Figma variables, never a stale/divergent read of one ramp.

## TICKET #112 (2026-07-27/28) — Align mapping corrected, gap 4→8px, colour re-check #2

**#107's `justify-between`/`justify-start` mapping was wrong — corrected here.** Re-reading the same raw Figma payload #107 fetched (nothing re-fetched this round for Button's structure; the caller-supplied prompt carried verbatim findings from a fresh `3623:4346` pull): `justifyContent`/`primaryAxisAlignItems` does **not** appear on the root frame of any of the 40 variant components, on Center or Left. The `justifyContent: center` values #107 read as the root's actually belong to the *Icon* and *Text* sub-frames one level down (`"Leading + Text"` → `Icon`/`Text` children) — a genuine misread, not a Figma change between #107 and now. Because every sampled variant is `horizontal: hug`, Center and Left render pixel-identical in Figma; Figma is silent on what either should do once a caller stretches the button. That case is the user's call, not Figma's: "Alle buttons standaard center. Alleen dropdown + nav buttons standaard left."

Fixed: `center` → `justify-center` (true centering — verified in a browser, a `w-40` stretched button's content block sits with equal free space on both sides, keeping its internal 4px gap intact). `left` → `justify-between` (packs the leading group at the start; with a `trailingIcon` present, pushes it to the far right edge; with none, degenerates to flex-start — same single-child-collapse behaviour #99 already established for the old space-between reading, still true here since the mechanism is identical, only the *default* branch changed). Root `gap-1` (4px, Figma's stated root gap) moved from being `align=left`-only to unconditional on the base `cva` string, so center/left never differ in spacing, only in `justify-*` — the previous code had no gap between the leading group and trailing icon at all in the `center` (space-between, no explicit gap) case when hugging; now it is always exactly 4px, matching every sampled Figma variant.

Every current call site was swept and given an explicit `align` (grep, not guessed): `Sidebar.tsx`'s 6 nav items and the `TeDoenHeader.tsx`/`CardDetailPanel.tsx` dropdown-trigger and dropdown-option Buttons → `align="left"`; `CardDetailPanel.tsx`/`BoardPanel.tsx`'s footer (`grow basis-0`) and every other labelled Button (add-category, add-column, add-board) → left at the new default (`center`), no prop needed. Icon-only Buttons (`align?: never`) were never in scope.

**Leading-group gap 4px → 8px.** Figma's `"Leading + Text"` frame is `gap: 8px`; the code's `<span className="flex items-center gap-1">` was 4px. Changed to `gap-2`. Measured in a browser (`button--trailing-icon` story): leading icon's right edge to the text node's left edge is exactly 8px now (`DOM Range` against the text node, not the span box).

**Collapsed-sidebar-rail arithmetic (user's point 3 — "tekst hopelijk niet zichtbaar... zoals nu").** Measured live (Playwright, `sidebar--variants` story, collapsed rail): nav `<nav>` is 73px wide, `p-4` (16px) each side, `border-r` 1px → 40px inner width for the nav-item column, which stretches the Button to 40px (parent `flex-col`'s default `items-stretch`). Button's own `px-2` (8px each side) leaves a 24px content box — exactly the icon's own width (24px), **with the fix in place (`align="left"`, `gap-2`)**: icon renders flush at the left padding edge (fully visible, unclipped), the 8px gap consumes the box's remaining width exactly to its right edge, and the label text's own bounding rect starts at `x = 318`, which is *exactly* the button's clipped right edge (`btnRight = 318`) — **0px of the label is visible**, confirmed via `Range.getBoundingClientRect()` on the text node, not inferred. This is not a coincidence of rounding: `8(padding) + 24(icon) + 8(gap) = 40` lands exactly on the 40px box. Recomputing the *old* numbers (align bug + 4px gap) for comparison: `8 + 24 + 4 = 36`, leaving a 4px sliver of the label's first glyph visible inside the 40px box — this is the sliver the user reported ("zoals nu"). No new padding was invented; the fix was the two sourced changes above (align default, 8px gap), and the arithmetic happens to resolve exactly, not approximately.

**Colours, second re-check.** Diffed the user-supplied hex table (fresh `3623:4346` fetch, not re-pulled by this agent) against `buttonVariants`. Filled/Outline/Destructive/text-fill tokens are pixel-identical to #107's matrix — no change. **White and Transparent both moved one step darker** on Hover/Active since #107:

| Variant | State | Figma hex | Old token (value) | New token (value) |
|---|---|---|---|---|
| White | Hover | `#F5F5F4` | `surface-hover` (stone-50) | `surface-active` (stone-100) |
| White | Active | `#E7E5E4` | `surface-active` (stone-100) | `surface-raised` (stone-200) |
| Transparent | Hover | `#E7E5E4` | `surface-active` (stone-100) | `surface-raised` (stone-200) |
| Transparent | Active | `#D6D3D1` | `surface-raised` (stone-200) | `surface-raised-hover` (stone-300) |

All four resolved hexes verified against `design/tokens.json`'s primitive scale (stone-100 `#F5F5F4`, stone-200 `#E7E5E4`, stone-300 `#D6D3D1`) and the compiled Ladle stylesheet's `--color-*` custom properties. Per the token-gap rule (`docs/guides/ui-components.md`): reused existing tokens pixel-for-pixel rather than editing `surface-hover`/`surface-active`'s own values, because `surface-hover` also backs `CardDetailPanel.tsx`'s unrelated Prioriteit/Grootte option-row hover (`hover:bg-surface-hover`) and changing it would have silently recoloured that unowned call site; token names now describe *a* role, not *the* role their name implies. **New dark-mode inconsistency flagged, not fixed**: `surface-active`'s dark value (stone-700) is lighter than `surface-raised`'s (stone-800), so White's dark-mode Hover (700) now reads lighter than its Active (800) — backwards from the light-mode direction (Active is the more-shifted state) and from White's pre-#112 dark ordering. No Figma dark frames exist for this node (`docs/open-questions.md#dark-mode-is-placeholder-only`), so this is this codebase's own token-reuse side effect, not a Figma fact — recorded there as a new gap rather than invented away.

`ButtonToggle.tsx`'s segments render `variant="transparent"` with a local `hover:bg-transparent! active:bg-transparent!` override (added when Transparent first gained fills in #107) to keep the white sliding indicator from being painted over. Re-verified live after this round's darker Transparent fills: selected segment's computed `backgroundColor` stays `rgba(0, 0, 0, 0)` at rest, on `:hover` (real pointer hover), and on `:active` (real `mouse.down`) — the `!important` override is variant-value-independent, so it still holds. No change needed there.

## TICKET #107 (2026-07-26) — Colour re-check + Alignment (left/center)

Re-fetched `3623:4346` (all 40 components: 5 styles × 4 states × 2 alignments) plus the REST `nodes` endpoint for Dev Mode annotations (none exist on this node — nothing missed). Verified per-variant against `buttonVariants`, not assumed.

**Colours — one real discrepancy.** Filled/White/Outline/Destructive: every fill and stroke in every state matches the current tokens exactly (`surface-raised(-hover/-active)`, `surface(-hover/-active)`, `border(-hover/-active/-selected)`, `priority-urgent-bg(-hover/-active)`), Selected unchanged except text → `text`, confirmed pixel-for-pixel including Outline's stroke ramp (Default `#D6D3D1`=stone-300=`border`, Hover `#79716B`=stone-500=`border-hover`, Active `#292524`=stone-800=`border-active`, Selected `#A6A09B`=stone-400=`border-selected` — no change from #68). **Transparent gained real Hover/Active fills** (`#F5F5F4`/stone-100 Hover, `#E7E5E4`/stone-200 Active; Default/Selected still no fill) — previously Figma defined none at all (`docs/open-questions.md#no-pointer-affordance`). Those two exact pixels are already named tokens for *other* roles' states — `surface-active` (White's Active, stone-100) and `surface-raised` (Filled's Default, stone-200) — so per `docs/guides/ui-components.md`'s token-gap rule ("reuse the existing token for the correct pixels **and** record the gap"), `transparent` now reads `hover:bg-surface-active active:bg-surface-raised` rather than inventing new names; a first pass here added dedicated `surface-transparent-hover/-active` tokens, reverted (`git diff` on `design/tokens.json`/`app/theme.css` confirms zero drift from `main`) once cross-checked against the same tokens' existing values and found to be exact duplicates in both light and dark. Verified against the compiled `pnpm ladle:build` stylesheet: `.hover\:bg-surface-active:hover{background-color:var(--color-surface-active)}` and `.active\:bg-surface-raised:active{background-color:var(--color-surface-raised)}`, resolving to stone-100/stone-700 and stone-200/stone-800 respectively. **Flagged, not resolved**: whether Transparent should eventually get its own named token pair is a token-scale question for the user, not a call this ticket makes (`docs/guides/ui-components.md`: "the token scale is closed").

**Alignment (left/center), a genuine new variant axis.** Every one of the 40 components is named `Style=…, State=…, Alignment=Center|Left` — not invented, not read from this ticket's text. Modelled as `align`, default `center`, resolved in JS (`resolvedAlign` in `Button.tsx`) rather than a plain always-on cva key, specifically so it never coexists with the icon-only branches' own structural `justify-center` — two conflicting `justify-*` utilities in one class string would leave the winner to Tailwind's compiled stylesheet order, not something this codebase controls (same landmine `docs/design-tokens.md` already documents for `aria-pressed:border-*`). `align` is excluded from the icon-only branch's type (`align?: never`), same idiom as `trailingIcon?: never`: with no separate label/trailing-icon split to distribute, Figma's Alignment axis has no visual target there.

Read directly from the raw Figma REST response (`primaryAxisAlignItems`, not the MCP's translated summary), on both Center and Left, across Filled/Outline/Destructive × Default/Selected (8 nodes spot-checked, all 40 consistent in the MCP dump): **`Alignment=Center` is `primaryAxisAlignItems: "SPACE_BETWEEN"`** (e.g. `3623:4344`, `3822:6637`, `3782:4154`, `3693:3386`); **`Alignment=Left` has no `primaryAxisAlignItems` at all** (Figma's default, i.e. packed/flex-start) **with `itemSpacing: 4.0`** on the root (e.g. `3917:24864`, `3917:24872`, `3917:24952`, `3917:24984`). So "Center" is Figma's own misnomer for space-between — same pattern as "Trekking icon" meaning trailing (#99) — not a naming mistake made here: it describes the two child groups (`"Leading + Text"` and the trailing `"Icon"` frame) sitting at opposite edges, book-ended, rather than the label text being centred. Modelled as `justify-between` (center) / `justify-start gap-1` (left, `gap-1` = the stated 4px `itemSpacing`). Confirmed in the running Ladle build (`button--alignment` story, screenshotted): with no `trailingIcon` the two look identical, because space-between with a single flex child degenerates to flex-start (already established by #99's own measurement, before Alignment existed as a distinct property) — the difference only becomes visible once a `trailingIcon` is present, where Center pushes it to the far edge and Left keeps it 4px after the label.

**Flag for the Dropdown ticket.** This ticket's own text assumed "de trailing chevron bij `align=\"left\"` [hoort] nog steeds uiterst rechts te staan" — the fetch contradicts that: Left is packed (`justify-start`, 4px gap), not distributed, so a stretched `align="left"` Dropdown row would show its chevron 4px after the label with the remaining width trailing empty *after* the icon, not flush against the right edge. Built exactly what Figma specifies rather than the assumed behaviour; the Dropdown ticket (owns the call-site default) needs to know Left does not reproduce the old space-between/flush-right look before wiring `align="left"` in.

Pixel-parity: `download_figma_images` on `3623:4344`/`3917:24864` (Filled/Default, Center/Left) and `3782:4154`/`3782:4793`/`3784:4081`/`3782:4913` (Outline/Transparent Default/Hover/Active) against the Ladle `state-matrix` and new `alignment` stories — radius, padding, fills and the Center/Left layout distinction all match; Transparent's new hover/active fill confirmed via the compiled stylesheet above rather than a live `:hover`, since the Playwright MCP session is shared with other concurrently running agents.

## TICKET #99 (2026-07-25) — Figma component set re-authored: trailing icon + symmetric padding

The user re-authored `Button/Default` in Figma (section frame `3760:6184`) to support a trailing icon; the code had drifted behind. Re-fetched `3623:4346` confirms a new property set — `Text` (text), `With text` (bool), **`Leading icon`** (bool, the renamed `With icon`) and **`Trekking icon`** (bool, new; Figma's same misnomer for *trailing* that `Input-field` already uses) — and a new internal structure, identical across all 20 variant components: root is `row, padding 0px 8px, justifyContent space-between, alignItems center, h 40, radius 8`, holding a `"Leading + Text"` frame (`row, alignItems center, gap 4px, hug/hug`) and an `"Icon"` frame (`hug/h40`, `componentPropertyReferences: { visible: "Trekking icon" }`). Per-variant fills/strokes are **unchanged** from #68's matrix — this is a layout-only re-author, so no token touched and `pnpm sync:tokens` shows no drift.

Three deltas from the previous code (`h-10 justify-start pl-2 pr-1`, leading icon wrapper `pr-1`, label `pl-1 pr-2`): root padding becomes symmetric `px-2`; root becomes `justify-between`; and the leading-icon-to-label gap becomes a single 4px `gap-1` on the new `"Leading + Text"` span instead of the old emergent 4+4=8px from two adjoining wrapper paddings. The old right padding was likewise emergent (root `pr-1` 4px + label `pr-2` 8px = 12px) and is now the stated 8px. Same class of fix as #69/#75: state the footprint directly rather than letting it total up.

Measured in a real browser (Playwright against `pnpm ladle`) rather than reasoned from classes: labelled leading+label+trailing renders h=40, radius 8px, `padding-left`/`padding-right` both 8px, `justify-content: space-between`, group `gap: 4px`, and a **measured 4px** between the leading icon's right edge and the text's start (DOM Range against the text node, not the span box).

Two prior fixes were explicitly re-verified as surviving, because both could plausibly have regressed:

- **#75's icon-only 40x40.** `iconOnlyDefault` (`size-10 justify-center`) still wins for the no-`children` case — measured 40x40 with `justify-content: center`, so the new `justify-between`/`px-2` on the labelled branch never reaches it.
- **#43's packed-left stretched option.** `Atom/Dropdown` overrides its nested Button instances to `sizing.horizontal: fill` (see the Dropdown-node section below), which is what made `justify-center` visibly wrong back then. `justify-between` is safe here only because a Button with no trailing icon has exactly **one** flex child, and `space-between` on a single child resolves to `flex-start`: measured a stretched option at 328px wide with its content starting 8px from the left edge. Consequence worth knowing before #100 lands a chevron: the instant a stretched option *does* get a `trailingIcon`, `space-between` will push that chevron to the far right edge — which is the wanted behaviour for a full-width dropdown row, but it is emergent from the stretch, not stated per-variant in Figma.

`trailingIcon` is deliberately **not** representable on the icon-only branch (type-enforced `trailingIcon?: never`): Figma never samples `Trekking icon` together with an icon-only instance, so that combination has no defined layout. Flagged here rather than invented.

Baselines: the 8px→4px gap change narrows every labelled Button, so it moved 17 snapshots across `button--*`, `dropdown--*`, `page-header--*`, `side-panel--*`, `sidebar--*`, `card-detail-panel--*`, `card-container--empty` and `board-view--*` — plus one new `button--trailing-icon`. Full suite 59/59 green.

## FIXED 2026-07-20 (#43)

Fixed for ticket #43 (2026-07-20): root class was `justify-center`, but every sampled Button/Default variant is a hug-sized row with no `justifyContent` override (Figma default packed/left) — invisible on hug-sized standalone buttons, but wrong once a caller stretches the button full-width (Atom/Dropdown's option-list slot does exactly that) Changed to `justify-start`; no visual change to any existing Button story.

## UPDATED for ticket #52 (2026-07-20)

Figma reworked every colour role to carry a per-state Default/Hover/Selected variation instead of Default + one ad-hoc hover — re-fetched node confirms the ticket's own state matrix verbatim, no discrepancy. Filled hover bg stone-200->stone-400 (new `surface-raised-hover` token, was wrongly stone-300/`surface-hover`); Filled selected bg -> stone-300 (new `surface-raised-selected`, was previously unchanged from default). White selected bg -> stone-50 (new `surface-selected`, was previously unchanged). Outline hover border -> stone-700 (new `border-hover-strong`; `border-hover` itself stays stone-500, since Atom/Input-field's Hover stroke did NOT move — the two roles that used to share `border-hover` have diverged, open question recorded in docs/design-tokens.md); Outline selected border -> stone-400 (new `border-selected`, was wrongly reverting to plain `border`). Distructive gained real Hover (red-200, new `priority-urgent-bg-hover`) and Selected (red-100, new `priority-urgent-bg-selected`) backgrounds — previously this style had no state override at all; its text stays `priority-urgent` in every state. `surface-hover` (stone-300) loses its only consumer here but is kept, unconsumed, per the ticket (may still be wanted elsewhere). See docs/design-tokens.md for the full table and the state-token naming convention future components should follow.

## TICKET #56 (2026-07-20, supersedes #52's matrix)

Figma added a FOURTH state (Active) and redistributed the values - what #52 recorded as Hover is now Active (pressed), Hover took a milder new value, and Selected no longer changes fill/stroke at all, only the text (-> text/stone-950). Re-fetched node 3623:4346 confirms: Filled stone-200/stone-300/stone-400, White white/stone-50/stone-100, Outline stroke stone-300/stone-400/stone-700, Distructive red-50/red-100/red-200 (Distructive Selected is identical to Default, text stays red-400 throughout). Transparent has NO fill in any state - so a transparent button has no pointer affordance at all; flagged as a design question in docs/design-tokens.md, not invented here. Modelled as `hover:` + `active:` (CSS :active is exactly Figma's new 'being pressed' state) + `aria-pressed:text-text`; the three compose because Selected touches only `color` while Hover/Active touch only background/border - a stated product requirement (a selected button must still react to the pointer), so no aria-pressed:bg-*/border-* override may ever be added. Tokens renamed to the role/-hover/-active scale; the *-selected colour tokens #52 added were removed (Selected has no background of its own). Stories cut from 10 exports to 2 (StateMatrix + args-driven Playground) so Button no longer fills the Ladle sidebar with one heading per state.

## TICKET #68 (2026-07-20)

re-fetched node 3623:4346 again per the ticket's premise that the user re-authored Outline's borders since #58 — confirmed, not assumed: Outline Hover moved stone-400 -> stone-500 (`border-hover`, now the exact value `Atom/Input-field` already used for its Hover, so the two components' Hover tokens are unified — `border-input-hover` deleted), Outline Active moved stone-700 -> stone-800 (`border-active`, Button-only — Input-field's Active is stone-600, a confirmed real difference, not a stale node, so it keeps its own `border-input-active`), and Outline Selected gained a border for the first time (`border-selected`, new, stone-400 — again the exact value Input-field already used, so `border-input-selected` is deleted too). Net: 3 of 4 states are now shared tokens between Button/Outline and Input-field; Active is the one remaining, deliberately-kept divergence. Filled/White/Transparent/Distructive fills are unchanged — this is an Outline-borders-only re-author. Button.tsx's Outline variant gains `aria-pressed:border-border-selected`, which for the first time puts Selected in competition with Hover/Active on `border-color` (previously Selected touched only `text`, a disjoint property, by construction). Verified against the compiled `pnpm ladle:build` stylesheet rather than assumed: Tailwind emits the plain `aria-pressed:border-border-selected` rule *after* `hover:`/`active:`'s border rules, so at equal specificity it would win and silently kill hover/active feedback on a selected button — the exact failure mode `docs/design-tokens.md`'s existing rule was written to prevent. Fixed with two compound variants, `aria-pressed:hover:border-border-hover` and `aria-pressed:active:border-border-active`, each one pseudo-class/attribute term more specific than the plain rules, so they win by CSS specificity regardless of stylesheet order — grepped compiled selectors recorded in the PR. See docs/open-questions.md#button-vs-input-active-border and docs/design-tokens.md's "Selected must compose with Hover and Active" subsection for the full account.

## TICKET #75 (2026-07-21)

icon-only size=default measured 36x40 (pl-2 8px + Icon 24px + pr-1 4px, the icon wrapper's own pr-1 stripped for icon-only per #69) against Figma's fetched 40x40 icon-only instances (re-confirmed this ticket: 3623:4346's own Distructive/Default component with With text overridden false, plus the two callers' own nodes 3650:1297 and 3727:4378) — 4px short on width only, same emergent-footprint bug class #69 already fixed for size=compact. Fixed the same way: the size variant gained a third, internal-only key iconOnlyDefault (size-10 justify-center, not exposed on the public size prop — callers still only choose default/compact), which the component resolves to whenever size is default (or omitted) and there is no children label. Measured before and after by rendering to static markup and reading the resolved utility classes (no headless browser in this repo): pre-fix root classes were h-10 justify-start pl-2 pr-1 with an unpadded 24px icon (36x40); post-fix, size-10 justify-center (40x40). Labelled size=default is unchanged. CardContainer's and CardContentIngredient's stale deviation notes are removed/corrected in the same PR.

## TICKET #80 (2026-07-21)

flex-shrink defence added. Measured in a real browser (Playwright against `pnpm ladle`, first ticket with one available — no more static-markup workaround): CardContentIngredient's destructive icon-only Trash Button (stated size-10, 40x40) rendered 35.1x40 inside that molecule's width-constrained row, because a flex item defaults to flex-shrink:1 and this atom opted out nowhere. `shrink-0` added to the shared cva base class string (applies to every size/variant unconditionally, not per-size) so the atom defends its own stated footprint in any layout a composer drops it into, rather than requiring every call site to remember a local `shrink-0` (which is what already went missing at two of this codebase's three call sites — only Atom/Button-Toggle's segments had it, and that local copy is now removed as redundant).

## TICKET #13

"Distructive" (Figma's own spelling) was corrected to `destructive` in the code API — the component prop/CVA key reads `destructive`, only the Figma-facing prose still says "Distructive".

## TICKET #69 (2026-07-20, size=compact origin)

`Button/Toggle` (3623:4345) resizes its nested `Atom/Button` instances to 32x32 via an instance override — Button's own component set has no Size property, so that footprint can't be reproduced by a caller `className` (`h-8`/`h-10` are the same property at the same specificity; the winner would depend on Tailwind's utility-generation order, not the caller). `size="compact"` was added to cover it. First landed as `h-8 pl-1 pr-0`, a 32px width that only *totalled* correctly (4px inset + Icon's default 24px + 4px inset) rather than being stated directly — any future change to the icon's default size or the wrapper padding would have silently de-squared it. Ticket #69 verified the arithmetic did land on 32x32 today by rendering both `Button` and `ButtonToggle` via `react-dom/server`'s `renderToStaticMarkup` (no headless browser available yet) and reading the resolved class list plus the icon `<svg>`'s literal `width`/`height` attributes, then fixed the fragility structurally: `compact` is now `size-8 justify-center` — one utility stating width equal to height directly, icon centred by flex alignment instead of padding arithmetic. Verified for the icon-only case only (all Figma samples); pairing `compact` with `children` is untested and made unrepresentable by the props union (a fixed 32x32 box would clip a label).

## Dropdown node context for ticket #43's `justify-start` fix

The fetched `Atom/Dropdown` node (3705:4446) overrides its nested `Button/Default` instances to `sizing.horizontal: fill` while still specifying no `justifyContent` (i.e. still packed/left) — this is what made the `justify-center` bug visible: Dropdown's option-list slot stretches the button full-width, so `justify-center` (a no-op on a hug-sized standalone button) started centring content the instant a caller stretched it.

## TICKET #166 (2026-08-08) — linked node deleted, no fix made

The ticket's "Button is anders in design" pointed at node `4003:5441`, which no longer exists in the Figma file (REST API `nodes?ids=` returns `null`, confirmed two ways — see `design/notes/RecipeDetailPage.md`'s #166 entry for the full investigation). Re-fetched the component set this atom maps to (`3623:4346`) anyway: unchanged since #112 (same 40 variant node ids, same `componentPropertyDefinitions`), so nothing here drifted from what `Button.tsx` already implements. **No code change made** — flagged for the reporter to re-link rather than guessed at.

## Known gap: destructive dark mode

**Superseded by #204.** All four Distructive states (default/selected/hover/active) now resolve to the same `red-50` in dark mode — sourced directly from Figma's `Semantics / Style, Dark` export, not a codebase pick, so this is a deliberately-accepted Figma fact rather than an unfixed gap: text stays legible, there's no hover/press/selected fill feedback. Previously (pre-#204) hover/active resolved to `red-950`, invisible for a different reason (this codebase's own pre-Figma-dark-data guess).

## TICKET #205 (2026-08-12): radius/spacing tokens

Measured via `figma_execute`/`boundVariables` across the "Style=Filled,
State=Default, Alignment=Center" variant (3623:4344) and its siblings. Root
`rounded-lg` (8px) → `rounded-control`
(`topLeftRadius`→`radius/control`). `size=default`'s `px-2` (8px) →
`px-component-sm` (`paddingLeft`/`Right`→`spacing/component/padding-sm`).
The "Leading + Text" frame's `gap-2` (8px) → `gap-inline-sm`
(`itemSpacing`→`spacing/inline/gap-sm`).

**Left unconverted:** root `gap-1` (4px, the unconditional gap #112's own
comment already documents). Kept raw because **Figma is internally
inconsistent here**, which is a design-side question rather than a conversion
decision — re-measured across the whole component set (not one variant), the
root `itemSpacing` splits by Alignment:

| variant | root `itemSpacing` | value |
|---|---|---|
| `Alignment=Center` (all Styles/States) | **unbound** — no variable | 4 |
| `Alignment=Left` (all Styles/States) | `spacing/component/padding-xs` | 4 |

Both render 4px, so `gap-1` is pixel-correct either way and nothing here is a
value-matching guess. But "half the set binds a token and half doesn't" is not
something to resolve by picking the majority in a conversion ticket — flagged
for design instead: `docs/open-questions.md#button-root-gap-binding-split`.

An earlier revision of this note claimed the root `itemSpacing` was "literally
unbound … same bindings on every Style/State/Alignment combination". That was
generalised from the Center variant alone and is wrong — corrected here after
re-measuring the full set. Left on the record deliberately: it is the same
sample-one-then-generalise mistake #213 exists to correct, arriving in the
very ticket that documents it.

## TICKET #218 (2026-08-12): spacing gate

`scripts/check-raw-spacing.sh` now enforces that every raw radius/spacing
utility in `components/` carries an explicit `spacing-flag:` marker. Root
`gap-1`'s existing exception (above) got that marker added directly above
the flagged line — no reasoning or binding changed.
