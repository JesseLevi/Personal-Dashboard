# AvatarGroup
Figma: `4231:16052` in `Winkelmand/09` (`4231:15885`) · Code: `components/molecules/AvatarGroup.tsx`

## Anatomy
- Horizontal flex, `gap-inline-sm`: an avatar stack, then the label.
  - Figma binds this `itemSpacing` to `spacing/inline/gap-sm` (8).
  - The stack is two or more `Avatar size="sm"` (32×32, round), overlapping by 8 px (`-ml-2` on every avatar after the first). The first member paints on top (DOM reversed with `flex-row-reverse` inside an `isolate` container; visual order left to right stays the `members` order). The fallback's border (a user addition on top of Figma, see `Avatar.md`) separates overlapping circles.
  - The label is `text-base font-semibold text-text-primary` (Figma 16/24 Inter Semi Bold, fill `color/text/base/primary`).
- Props: `members: { id, name, src }[]`. The molecule knows nothing about shopping lists.
- Label: first word of each name. Two names: "Jesse & Youri". Three or more: "Jesse, Youri & Anne". One name: just that name.
- The joiner is the i18n key `components.avatarGroup.and`, present in both `messages/nl.json` and `messages/en.json`. It is "&" in both.

## Deliberate decisions
- **The avatar stack is `aria-hidden`**: the label carries the names, so there is no duplicate announcement.
- **No overflow ("+N") treatment**: Figma draws none. Add it when a design asks for it.
- **Uses `useTranslations`** directly (like `NoteWordCount`) rather than a label prop, because the joiner is part of how the label is built.
- New component by exception (ADR-0034): the sharing model needs it in several places.

## Token gaps and flags
- Figma overlaps by 16 px (unbound negative `itemSpacing`, no variable). Code uses 8 px because the letter fallback would otherwise be covered by the next circle; `-ml-2` carries a `spacing-flag`.
- Figma's avatar fill (`#D6D3D1`) and the placeholder photo are unbound canvas content. In code, `avatar_url` is null everywhere, so the letter fallback renders (see `design/notes/Avatar.md`).

## Gotchas
- Names are split on whitespace; a name with a particle ("Anne de Vries") shows as "Anne".
- Avatar order is the `members` order; the caller decides who comes first.

## Open
None.
