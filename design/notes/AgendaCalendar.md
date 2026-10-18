# AgendaCalendar
Claude-designed (#485), ADR-0037 §8, no Figma node · Code: `components/organisms/AgendaCalendar.tsx`, `AgendaCalendarTheme.ts` (class settings), `AgendaCalendarItem.tsx` (item content), `AgendaCalendarSkeleton.tsx`, `useAgendaDraggable.ts` · Types: `lib/agenda/types.ts` · Pure helpers: `lib/ui/agenda-calendar.ts`

## Anatomy
FullCalendar 7 (`@fullcalendar/react`, subpath plugins `daygrid`, `timegrid`, `list`, `interaction`; peer `temporal-polyfill`) with no theme plugin and no toolbar. Every look comes from class-name settings built in `buildAgendaCalendarOptions()`; the page (#486) owns navigation with `PageHeader` + `ButtonToggle`.

Props: `items: AgendaItem[]`, `view` (`day|threeDay|week|month|list`), `date` (`YYYY-MM-DD`), callbacks `onSelectSlot`, `onItemClick`, `onItemMove(change, revert)`, `onItemResize(change, revert)`, `onExternalDrop`, `onItemDropOut(item)` (an item dragged from the grid and released over an element carrying `AGENDA_TRAY_ATTRIBUTE`, found with `elementsFromPoint` in `eventDragStop`; FullCalendar fires no `eventDrop` then). The parent gives the root a height (`h-full`); the grid scrolls inside it.

Controlled: `items` map to FullCalendar events (`toEventInput`, the item rides in `extendedProps.item`). After a drag or resize FullCalendar has already moved the event, so the parent either updates `items` or calls `revert`. Spans are ISO strings: timed with the browser's offset, all-day as `YYYY-MM-DD` with an exclusive end.

| FullCalendar part | Setting | Tokens |
|---|---|---|
| Frame | `viewClass` | `rounded-card`, `border-stroke-primary`, `bg-surface-highlight-white`, `overflow-clip` (not `hidden`: keeps sticky headers) |
| Grid lines | `dayCellClass`, `slotLaneClass`, `dayHeaderClass`, ... | `border-stroke-lines`; half-hour lines dotted |
| Today | `dayCellClass`, `dayLaneClass`, header | `bg-surface-secondary/40` column tint (translucent, so the slot lines stay visible in dark mode), `bg-surface-secondary` number chip; not in the single-day view |
| Day header / time labels | `dayHeaderInnerClass`, `slotHeaderInnerClass` | `text-sm`/`text-xs font-semibold text-text-secondary` |
| All-day row | `allDayDividerClass` | `bg-surface-primary` band |
| Now line | `nowIndicatorLineClass` | `border-text-highlight-red` |
| Items | `eventClass`, `blockEventClass`, `columnEventInnerClass`, `rowEventInnerClass` | per kind, below; `rounded-control-inner` |
| "+N meer", popover | `rowMoreLinkClass`, `popoverClass` | `text-text-secondary`, white-hover/active; card-like popover |
| List view | `views.list`, `listDay*Class`, `listItemEventClass` | `bg-surface-primary` day band, rows hover `surface-highlight-white-hover` |
| Selection / drop target (all-day, month) | `highlightClass` | dashed `border-stroke-primary-active`, `bg-surface-secondary` |
| Hover outline | overlay in `AgendaCalendar` | dashed `border-stroke-primary-active`, `rounded-control-inner`, no fill |

## Item language
| Kind | Look |
|---|---|
| Own event | white surface, `border-stroke-primary`; hover/active/selected use the white fill steps |
| Imported event (`source: sync`) | `surface-highlight-blue`, `CalendarSync` icon; fixed |
| Meal | `surface-highlight-green`, slot icon (Croissant, Sandwich, Utensils, Cookie), recipe title, slot and servings; always all-day (see below) |
| Planned card | `surface-highlight-yellow`, `Columns3` icon, board and column |
| Deadline | no fill, `text-highlight-red`, `AlarmClockCheck`; hover/active tint `surface-highlight-red-*`; lives in the all-day row |
| Removed at source (`missingSince`) | own style, dashed border, `opacity-60`, "Verwijderd bij bron" |
| Draft (selection mirror, drag ghost) | dashed `border-stroke-primary-active` on white |

Coloured kinds have no hover/active/selected fill tokens, so those states move the border (`stroke-primary-hover/-active/-selected`), like Button Outline. Dragging dims the source (`opacity-60`) and the mirror takes `border-stroke-primary-active`.

## Deliberate decisions
- No FullCalendar theme plugin, `theme.css` or `--fc-*` variables. `skeleton.css` (positioning only) is imported by the component.
- All events render as blocks (`display: "block"`), also in month view, so kinds keep their surface instead of FullCalendar's dot style. `eventContent` is ours; labels are resolved with `useTranslations` once and passed in, because FullCalendar renders content outside our hook scope.
- Meals are day items: they sit in the all-day zone (week, day), never as a block on the hour grid. `eventOrder` is `compareEventOrder`: all-day items first (deadlines, planned cards, events, then meals by moment and `position`), timed items by start.
- Editability per kind (`itemEditability`): synced events and deadlines are fixed; meals and planned cards move but keep their length; manual events move, and resize when timed. FullCalendar enforces it via `startEditable`/`durationEditable`.
- Overlapping timed items sit side by side (`slotEventOverlap: false`).
- `week` becomes `threeDay` below `md` (`useIsNarrow`, wide on SSR). Day view is the other mobile default. FullCalendar has no swipe between days: the page header carries prev/next arrows.
- External dragging: `useAgendaDraggable(ref, payload)` wraps `Draggable` with `create: false`; the drop reports `{ payload, start, allDay, eventId? }` through `onExternalDrop` and the parent creates the item. `eventId` is the event under the pointer (`eventDidMount` stamps `data-agenda-event-id` on event elements; the drop looks them up with `elementsFromPoint`, also for touch), so a drop on an appointment can attach to it. The payload travels in a `WeakMap`, not the DOM.
- Selection fills the whole cell: the time-grid selection mirror (an event without item) cancels the lane inset with negative margins in `columnEventClass`; real items keep the inset.
- Hover outline: on `(hover: hover) and (pointer: fine)` an overlay (`aria-hidden`, `pointer-events-none`) follows the mouse and outlines the empty cell it would select: one 30-minute slot of a day column in the time grid (`slotBox`, clipped to the scroller with `clipBox`), the whole cell in the all-day row and month. It hides over items (`data-agenda-item`), links and buttons, while a button is down, on scroll and on leave. It works through `pointermove` + `requestAnimationFrame` with no React state; its `top/left/width/height` are set imperatively on the overlay (the one inline style we write, like FullCalendar's own geometry).
- Tap to create: `dateClick` calls `api.select` (30 minutes for a time slot, the whole day for all-day/month cells), so a tap behaves as a desktop click-select. FullCalendar ignores scroll gestures and event taps; a tap within 400 ms of a `select` is dropped, so a mouse click does not select twice.
- Touch: `AGENDA_LONG_PRESS_MS` (350) for the external draggable, `eventLongPressDelay`, `selectLongPressDelay` and `longPressDelay`, so a tray or grid still scrolls on a quick swipe.
- Scrollbars are hidden inside the frame (same as Carousel/EditingBar); the grid opens scrolled to 07:00.
- The skeleton mirrors the week grid (three days below `md`), real card/surface tokens, `animate-breathe`, one `role="status"`.

## Token gaps and flags
- `surface-highlight-blue/green/yellow` and `text-highlight-*` have no dark overrides, so coloured items stay pastel in dark mode (as `Tag` does) and the text on them is about 3:1. There is no on-highlight text token.
- No hover/active/selected tokens for the blue, green and yellow surfaces (see above).
- No accent or "today" token: today is a `surface-secondary/40` tint plus a `surface-secondary` chip. The opacity modifier keeps the slot lines visible; an opaque `surface-primary` hid them in dark mode.
- The now line borrows `text-highlight-red`; there is no red stroke token.
- No opacity token: `opacity-60` marks dragging and removed items.
- `min-w-56` on the popover and the `w-16` time column in the skeleton are layout sizes, not scale values. Other-month days dim with `opacity-50`: `text-placeholder` has no dark value.

## Gotchas
- FullCalendar writes event geometry inline (`top`, `height`, `inset-inline`); the only other inline style is the hover overlay's position (see above), and none comes from JSX. Its `fc-*` skeleton classes are `!important`: never fight them with utilities.
- `views.list.eventClass` replaces the kind surface in list view; the top-level `eventClass` applies to every view. Per-view settings are keyed by view type (`timeGrid`, `dayGrid`, `list`), not by name.
- Time zones: FullCalendar runs in the browser zone (`timeZone: "local"`) and returns offsets. Convert on the page/server boundary (#486); all-day items are dates without zone.
- Selecting a slot leaves FullCalendar's mirror until `items` change or the view moves; the page opens its panel from `onSelectSlot`.
- Visual stories assume the suite's frozen clock (Thursday 2026-01-01) for the today marker and now line.
- Thumbnails (`thumbnailPath`) are not drawn in the grid; the recipe tray/list can use them later.
