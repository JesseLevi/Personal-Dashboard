# ADR-0055: A bottom tab bar switches modules on mobile

**Status**: Accepted (2026-11-01, user decision on the improvement brief, package 9: Claude designs). An exception under ADR-0034 (new organism).

## Context

- On mobile every module switch went through the drawer: the button top left, then the item. Two taps for the most common move.
- No Figma design exists; the user asked Claude to design it.

## Decision

1. **`MobileTabBar`** (new organism), fixed to the bottom below `md`, with the Sidebar's routed `NAV_ITEMS` (icon + short label; icons only below 360px), the active one marked with `aria-current`.
2. **The drawer stays** for account, settings and search.
3. **Hidden on the note editor**, which has its own bottom bar.
4. Existing tokens only; the safe-area clearance is a flagged raw value.

## Consequences

- Pages lose nothing at the bottom: `pb-page-bottom` (80px) already clears the 56px bar; a spacer adds the safe-area inset.
- A new module appears in both navigations by adding it to `NAV_ITEMS` and `ROUTES`.
