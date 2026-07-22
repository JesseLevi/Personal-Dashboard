# Icon/*

- **Code:** `components/atoms/Icon.tsx`
- **Node ID:** `3760:6187`

single wrapper around lucide-react@1.25.0+ (upgraded 2026-07-20 for the Broccoli icon, added upstream between v1.14–1.15). Figma layer names are kept in sync with lucide export names (renamed 2026-07-20, refined same day: Clock→Alarm-clock-check, Cake→Cake-slice, List→Scroll, Folder→Folder-closed, Columns→Columns-3, Cross→X, Calandar typo fixed to Calendar) so IconName is a direct PascalCase lookup — every entry verified against rendered SVG structure, not name alone (caught 3 real bugs this way: Columns was previously mismapped to Columns2 — a 2-column/1-divider icon — when Figma's vector has 2 dividers = 3 columns; Cross was mapped by literal name to lucide's medical-cross glyph instead of X; the sidebar-panel icons (nodes 3629:126 / 3687:4453) went through an open/close label swap then a left/right correction — the app's sidebar sits on the left, so they're now 'Panel-left-close'/'Panel-left-open', matching the verified divider-at-x=9 geometry — both fixed 2026-07-20 by the user). No open discrepancies remain.
