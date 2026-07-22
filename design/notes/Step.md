# Step

- **Code:** `components/atoms/Step.tsx`
- **Node ID:** `3727:3208`

32x32 circular badge (radius 99px → rounded-full), bg stone-200 (surface-raised), text-sm/semibold stone-500 (text-muted). Figma files it under the Atoms 'Steps' frame. MOVED 2026-07-21 from components/molecules/ to components/atoms/ to match — the original placement note claimed the figma-map.json mapping being canonical (ADR-0010) justified keeping it under molecules/ despite Figma's own classification, but ADR-0010 only establishes the map as the canonical node-id/path record, not licence to override Figma's Atomic Design section; corrected per user report. `Card` (molecule) composes it as a nested instance, which is now atom->molecule, the direction CLAUDE.md's dependency rule expects. Fetched node is a single COMPONENT with no variant/state axis — no CVA added, content via children.
