# BoardPanel (`app/(app)/te-doen/BoardPanel.tsx`)

- **Code:** `app/(app)/te-doen/BoardPanel.tsx` (no `.stories.tsx` — flagged as a
  zero-Ladle/visual-coverage gap by `design/notes/CardDetailPanel.md`'s #106
  entry; #191 is the open ticket for it).
- **Node IDs:** `3878:9047` (mobile AddBoard, "Te doen/Mobile/AddBoard") and
  `3878:9060` (desktop AddBoard, "Te doen/Desktop/AddBoard") — same nodes
  `TeDoenBoard.md` already references for the page-level wiring; this file
  is the panel's own content (SidePanel + `InputField` + `Button`), not a
  new atomic-design leaf, so it is **not** added to `design/figma-map.json`
  (same precedent as `CardDetailPanel.tsx`/`TeDoenBoard.tsx`).

Built #95 piece 3. Full field/behaviour reasoning (name-only form, no
icon/colour picker, the deferred delete button) lives in
`design/notes/TeDoenBoard.md` — this file only carries this component's own
design-record entries (currently just #219, below), per the "one home per
fact" rule.

## #219 — raw radius/spacing utility, measured via `figma-console`

One raw utility: the footer button row, `<div className="flex gap-2">` →
`<div className="flex gap-inline-sm">`. Measured against
`Te doen/Mobile/AddBoard` (`3878:9047`) and `Te doen/Desktop/AddBoard`
(`3878:9060`) — the footer node ("Bottom" under `Pull-up panel`, id
`3878:9057` mobile / `3878:9070` desktop) is `layoutMode: HORIZONTAL`,
`itemSpacing: 8`, `boundVariables.itemSpacing` → `spacing/inline/gap-sm`,
identical on both breakpoints (no `md:` split needed). Row axis is
horizontal (the axis rule: inline for the row axis), matching this file's
own `flex` (row) direction — same footer-row convention `CardDetailPanel.md`
documents for its own footer (`#103` entry there).

No flags, no design discrepancy: this file's single raw utility converted
cleanly and pixel-identically (`gap-2` = 8px = `spacing/inline/gap-sm`).
