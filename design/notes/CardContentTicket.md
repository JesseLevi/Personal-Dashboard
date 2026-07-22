# Card-content/Ticket

- **Code:** `components/molecules/CardContentTicket.tsx`
- **Node ID:** `3670:1696`

Built #21. Single COMPONENT, no variant/state axis, so no CVA — clsx merges className, same as Card/CardContentRecipe. Root (column, padding 12px -> p-3, gap 16px -> gap-4) has a TEXT title (sizing fill -> `title`, text-base/semibold) and a SLOT 'Slot' (row, wrap, gap 8px -> gap-2) -> `children`, per CLAUDE.md's 'SLOT nodes -> children/named slots' — not re-modelled as a typed priority/labels prop since the fetched node binds no Figma property to either sampled Tag instance, same reasoning Card's own content SLOT already documents. Both fetched Tag instances are exact hex matches for Atom/Tag's existing variants, no new colour and no token gap: Color=Yellow (#FFF7ED/#FF8904) == `medium` (orange-50/orange-400); Color=Grey (#F5F5F4/#79716B) == `neutral` (stone-100/stone-500). No icons in this node. No i18n keys added — title and the Tag children are caller-supplied ticket content, same reasoning CardContentRecipe's name/duration document.
