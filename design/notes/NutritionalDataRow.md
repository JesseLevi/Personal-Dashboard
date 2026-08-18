# NutritionalDataRow

- **Code:** `app/(app)/recepten/[recipeId]/NutritionalDataRow.tsx`
- **Figma:** "NutritionalData" — `3997:15948` (Mobile, under `Recept/Mobile`
  `3997:14737`) / `3997:15543` (Desktop, under `Recept/Desktop` `3997:15171`),
  both inside section `Pages/Recept_V2/Breakpoints` (`3997:14736`). A plain
  `FRAME` of `Button/Default` pills under the recipe title — not a fetched
  Figma component, same page-level-composition/no-`figma-map.json`-entry
  precedent as `RecipeDetailPage.tsx`'s own Header/Knoppen rows (see that
  file's own note for the component's full build history — this file didn't
  get its own `design/notes/` entry until #219; #160 built it, #166 added the
  seventh (fibre) pill, both documented there).

Full reasoning for the component itself — why it exists, the seven-pill
shape, the fibre-macro addition, the servings pill — lives in
`design/notes/RecipeDetailPage.md` (#160, #166). This file only carries the
record `CLAUDE.md`'s "one home per fact" rule wants once the component has
its own conversions to track (#219, below).

## #219

Raw radius/spacing utilities converted onto `Semantics / Responsive` tokens,
verified against real Figma `boundVariables` (never inferred from a matching
px value).

**Pill row (line ~127), `gap-3` → `gap-inline-md`:** already measured and
converted by the previous (session-limited) agent, with its own in-line
comment citing `3997:15948` (Mobile) / `3997:15543` (Desktop) —
`layoutMode: HORIZONTAL`, `itemSpacing: 12` → `spacing/inline/gap-md`. Row
axis in both Figma and code (`flex flex-wrap`, wraps to `md:flex-nowrap`),
so `inline/*` per the axis rule. Same value both breakpoints, no `md:` split
needed.

**Info popover (line ~143 wrapper, ~148 label padding, ~158 NEVO attribution
padding), `gap`/`px`/`py` left raw, `spacing-flag` × 3:** the fetched
"NutritionalData" frame only ever shows the collapsed pill state — no
open/expanded popover exists in either Mobile or Desktop node, so there is
no Figma node to bind any of this popover's spacing to. Three separate
raw utilities inside it, each flagged individually since the gate only reads
the contiguous comment block *directly above* the flagged line:

- `mt-2` on the popover's own absolutely-positioned wrapper (`div`
  under `{openKey === item.key && (`) — flagged in-line.
- `px-2 py-1` on the `item.fullLabel` heading inside `Dropdown` — flagged
  in-line, same "no Figma node for this popover" reason.
- `px-2 pb-1` on the NEVO attribution line (`item.isNevoData && (…)`) — this
  line carries a second, legally-mandated comment immediately above it
  (ADR-0013 §2: NEVO's licence requires this exact, unlocalised English
  attribution string; **not** restructured or reworded for #219, only the
  spacing utility is in scope). The session-limited agent's flag for this
  specific line landed as a trailing clause inside that ADR-0013 comment
  block, sitting above the `{item.isNevoData && (` wrapper line rather than
  directly above the `<p>` itself — the wrapper line is real code, not a
  comment, so it breaks the gate's upward scan and the line still failed
  `scripts/check-raw-spacing.sh`. Fixed for #219 by adding its own
  `// spacing-flag: …` comment directly above the `<p>`, inside the
  `isNevoData &&` block (same shape the popover-wrapper flag two levels up
  already uses successfully) — no change to the ADR-0013 comment or the
  attribution string itself.

None of the three popover flags are new open questions — the popover's
undesigned state was already known (`item.fullLabel`/attribution content
itself is unaffected); this section exists to record why the spacing
specifically stays raw and where each flag now lives.

## 2026-08-18 — moved onto the shared popover positioner

Not one of the two off-screen bugs reported (this row's own popovers were
fine — `SidePanel` isn't its ancestor and centring under a mid-row icon
button rarely runs off either edge), but converted anyway as one of the
seven call sites of the same hand-rolled pattern. `mt-2 left-1/2
-translate-x-1/2` → `lib/dom/use-popover-position.ts`, `anchor="center"`,
`prefer="below"`. The `-translate-x-1/2` trick is gone — the hook's
computed `left` already centres the popover, clamped into the viewport if
it ever gets close to an edge. Both widths (`w-64` NEVO / `w-40` non-NEVO)
stay real Tailwind classes and are measured live by the hook, not assumed —
see `docs/incidents.md` (2026-08-18) for the full mechanism.
