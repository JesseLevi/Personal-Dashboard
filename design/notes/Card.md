# Card

- **Code:** `components/molecules/Card.tsx`
- **Node ID:** `3624:4448`

Props Title (bool)+Text (text) -> `title?: string`; Step (bool) -> `step?: ReactNode` composed via the existing Step atom instance (Figma nests a real Step instance here); SLOT 'Type' -> required `children`. No variant/state axis on the node (booleans + text only) so no CVA — clsx merges className, same as Step. No token gaps: heading #0C0A09->text, slot fill #FFFFFF->surface, slot stroke #D6D3D1->border, all existing tokens. The 'Stap + Card' frame's own 12px corner radius has no fill/stroke so it's a no-op and is not modelled. AllContentTypes story added 2026-07-21 (after merging #66/#67): one Card per built Card-content/* molecule, each showing its own variant axis, so every kind of card content the design system has so far can be compared side by side. Completed 2026-07-21 after #21/#22 merged: all four Card-content/* molecules are represented. Add the next one in the same PR that builds it.
