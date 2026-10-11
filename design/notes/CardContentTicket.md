# Card-content/Ticket
Figma: `Card-content/Ticket` · node `3670:1696` · Code: `components/molecules/CardContentTicket.tsx`

## Anatomy
Single component, no variant/state axis, so no CVA (`cn` merges className). Root column (`p-component-md`, gap 16) holds a title (`title`, text-base/semibold) and a wrapping row SLOT "Slot" (gap 8) -> `children`.

## Deliberate decisions
- The Slot is plain `children`, not a typed `priority`/`labels` prop: the fetched node binds no Figma property to either sampled Tag instance, same reasoning as `Card`'s content slot. Both sampled Tags are exact matches for existing `Tag` variants (Yellow `#FFF7ED`/`#FF8904` = `medium`; Grey `#F5F5F4`/`#79716B` = `neutral`), so no new colour. (#21)
- No i18n keys: title and Tag children are caller-supplied ticket content. (#21)

## Token gaps and flags
- Root `gap-4` (16px `itemSpacing`) has no bound variable in the node: stays raw, marked `spacing-flag:`. (#205, #218)
- Slot row `gap-2` (8px `itemSpacing`) likewise unbound: stays raw, marked `spacing-flag:`. (#205, #218)
- Root padding 12px is bound -> `p-component-md` (`spacing/component/padding-md`). (#205)
