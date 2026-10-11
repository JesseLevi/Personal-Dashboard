# Step
Figma: `Atoms/Steps` · node `3727:3208` · Code: `components/atoms/Step.tsx`

## Anatomy
Single COMPONENT, no variant/state axis, so no CVA. 32x32 circular badge (`rounded-full`), `bg-surface-secondary`, `text-sm font-semibold text-text-secondary`. Content via `children`. `Card` (molecule) composes it as a nested instance via its `step` prop.

## Deliberate decisions
- Lives in `components/atoms/`, matching Figma's Atoms section. It was first placed under `molecules/` on the argument that `figma-map.json` is canonical (ADR-0010); that map only records node-id/path and does not override Figma's Atomic Design classification. The atom -> molecule direction (Card imports Step) is what the dependency rule expects. (#22)
