# BoardPanel
Figma: `Te doen/Mobile/AddBoard` node `3878:9047` · `Te doen/Desktop/AddBoard` node `3878:9060` · Code: `app/(app)/te-doen/BoardPanel.tsx`

## Anatomy
Page-level composition of `SidePanel` + `InputField` + `Button` (add/edit board). Not an atomic-design leaf, so it is not in `design/figma-map.json` (same precedent as `CardDetailPanel`/`TeDoenBoard`). The panel remounts on target change via `key`. Field and behaviour reasoning (name-only form, no icon/colour picker, deferred delete) lives in `TeDoenBoard.md`.

## Token gaps and flags
- Footer button row `gap-2` -> `gap-inline-sm`: the footer node ("Bottom" under "Pull-up panel", `3878:9057` mobile / `3878:9070` desktop) is HORIZONTAL with `itemSpacing` 8 bound to `spacing/inline/gap-sm`, identical on both breakpoints, so no `md:` split. (#219)

## Gotchas
- Stories `CreateBoard` (empty Name, Save disabled) and `EditBoard` (Name prefilled) take mock server actions, so no `useRouter()`/Supabase under Ladle. Each sits in a `min-h-screen` wrapper: `SidePanel` is `position: fixed`, so without it the baseline collapses to a 1280x64 sliver. (#191)
- `ci-visual.yml` also triggers on `app/**/*.stories.tsx` and `app/(app)/te-doen/*Panel.tsx`. (#191)
