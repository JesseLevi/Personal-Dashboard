# Design tokens: per-state colour convention (ADR-0010, ticket #52)

Read on demand from `CLAUDE.md` → "Design tokens" section. This file records the
convention every future component's state colours should follow, plus the concrete
table ticket #52 used to bring `Atom/Button` in line with it.

## Background

Figma's semantic variable system was reworked so that **every colour role now
carries a per-state variation** (Default / Hover / Selected), not just a single
ad-hoc `-hover` bolted onto two roles (`surface-hover`, `border-hover`, added by
ticket #42). Ticket #52 added the missing state tier and fixed `Atom/Button`,
whose CVA classes still pointed at the old two tokens and therefore rendered
three wrong colours (Filled Hover, Filled Selected, Outline Hover, Outline
Selected, Distructive Hover, Distructive Selected — see table below).

## The convention

For every semantic colour **role** that has Figma-defined state variation, model
it as three tokens, never as one token reused across states:

```
role            — Default
role-hover      — Hover
role-selected   — Selected
```

A component's CVA variant classes read `role` for the base case,
`hover:bg-role-hover` / `hover:border-role-hover` for `:hover`, and
`aria-pressed:bg-role-selected` / `aria-pressed:border-role-selected` for the
persistent "Selected" state (never CSS `:active` — that means "currently being
pressed", a different, non-persistent thing; see `Atom/Button`'s own doc
comment for why `aria-pressed` is the right hook).

**Never** read a `dark:`-prefixed utility class, a raw hex, or a one-off value
for a state colour — every state token gets its light value from the fetched
Figma node and a dark value chosen from Tailwind's stock stone/red scale (no
Figma dark-mode frames exist yet for any component), following the same
`[data-theme="dark"]` pipeline ticket #42 built. If Figma has no state
variation for a role in a given component, don't invent one — leave it
unstated (see Distructive's text colour below, which is `priority-urgent` in
every state because Figma never overrides it).

## The state matrix (`Atom/Button`, node 3623:4346, re-fetched 2026-07-20)

| Style | State | fill / stroke | text |
|---|---|---|---|
| Filled | Default | `surface-raised` (stone-200) | `text-muted` (stone-500) |
| Filled | Hover | `surface-raised-hover` (stone-400) | `text-muted` (unchanged) |
| Filled | Selected | `surface-raised-selected` (stone-300) | `text` (stone-950) |
| White | Default | `surface` (white) | `text-muted` (stone-500) |
| White | Hover | `surface` (no change) | `text-muted` (unchanged) |
| White | Selected | `surface-selected` (stone-50) | `text` (stone-950) |
| Transparent | Default / Hover | none | `text-muted` (stone-500) |
| Transparent | Selected | none | `text` (stone-950) |
| Outline | Default | `border` (stone-300) | `text-muted` (stone-500) |
| Outline | Hover | `border-hover-strong` (stone-700) | `text-muted` (unchanged) |
| Outline | Selected | `border-selected` (stone-400) | `text` (stone-950) |
| Distructive | Default | `priority-urgent-bg` (red-50) | `priority-urgent` (red-400) |
| Distructive | Hover | `priority-urgent-bg-hover` (red-200) | `priority-urgent` (unchanged) |
| Distructive | Selected | `priority-urgent-bg-selected` (red-100) | `priority-urgent` (unchanged) |

Every row above was verified against a fresh MCP fetch of node 3623:4346 as
part of #52, not carried over from the ticket body's table without checking —
the fetch confirmed the ticket's table exactly, no discrepancies found.

## Tokens added by #52

`design/tokens.json` gained:

- Primitives: `stone-50` (#FAFAF9), `red-100` (#FFE2E2), `red-200` (#FFC9C9).
- Doc-accuracy fix (no CSS effect — both primitives are `tailwind`-tagged, so
  the generated CSS already emitted `var(--color-stone-400)` /
  `var(--color-stone-700)`, which resolve through Tailwind's own stock v4
  palette): the recorded `value` for `stone-400` was `#A8A29E` (Tailwind v3);
  the Figma fetch and Tailwind v4 both give `#A6A09B`. Same for `stone-700`:
  recorded `#44403C` (v3) vs. `#44403B` (v4/Figma). Corrected in this ticket.
- Semantic tokens: `surface-selected`, `surface-raised-hover`,
  `surface-raised-selected`, `border-hover-strong`, `border-selected`,
  `priority-urgent-bg-hover`, `priority-urgent-bg-selected` — each with a
  `dark` value reusing an existing stock stone/red shade (no new primitives
  beyond the three above, no one-off hex); see the `$comment` in
  `design/tokens.json` for the reasoning behind each dark pick.
- `surface-hover` (stone-300) is **not deleted** even though `Atom/Button` was
  its only consumer and no longer reads it (Filled's hover moved to
  `surface-raised-hover`, stone-400). Flagged in the `$comment` for the user
  to decide whether to keep or remove it.

## Open questions (recorded, not resolved by guessing)

1. **`border-hover` has diverged in value between the two components that
   share it.** `Atom/Input-field`'s Hover stroke is still stone-500 (its own
   node was not part of this ticket and was not re-fetched). `Atom/Button`'s
   Outline Hover stroke is now stone-700 in the re-fetched node — hence the
   new, separate `border-hover-strong` token rather than changing
   `border-hover` itself. Likely explanation: one of the two Figma nodes was
   not re-bound to the reworked shared variable during the Figma-side rework.
   Needs the user (or a Figma-side check) to confirm which value is correct
   for which component, or whether they're now genuinely two different roles.
2. **Figma MCP returns resolved hex only, never the underlying variable
   name.** Every semantic token name in `design/tokens.json` — this ticket's
   additions and all earlier ones — is therefore derived by matching a pixel
   value back to a role, not read from Figma's own variable names. The names
   here may need aligning with Figma's real variable names once those are
   available (e.g. via a future Figma Variables API integration), rather than
   staying purely a code-side naming convention.
