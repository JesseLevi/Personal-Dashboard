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
| Today | `dayCellClass`, `dayLaneClass`, header | `bg-surface-secondary/40` column tint (translucent, so the slot lines stay visible in dark mode), the date as a `TODAY_CHIP` (`bg-event-red-surface text-event-red-text`, in the day header and the month cell); the tint is not in the single-day view |
| Day header / time labels | `dayHeaderInnerClass`, `slotHeaderInnerClass` | `text-sm`/`text-xs font-semibold text-text-secondary` |
| All-day row | `allDayDividerClass` | `bg-surface-primary` band |
| Now line, dot, label | `nowIndicatorLineClass`, `nowIndicatorDotClass`, `nowIndicatorHeaderClass` + `nowIndicatorHeaderContent` | line and dot `event-red-accent`; the label (`HH:mm`, `formatClock`) is a `TODAY_CHIP` on the time axis |
| Items | `eventClass`, `blockEventClass`, `columnEventInnerClass`, `rowEventInnerClass` | per kind, below; `rounded-control-inner` |
| "+N meer", popover | `rowMoreLinkClass`, `popoverClass` | `text-text-secondary`, white-hover/active; card-like popover |
| List view | `views.list`, `listDay*Class`, `listItemEventClass` | `bg-surface-primary` day band, rows hover `surface-highlight-white-hover` |
| Selection / drop target (all-day, month) | `highlightClass` | dashed `border-stroke-primary-active`, `bg-surface-secondary` |
| Hover outline | overlay in `AgendaCalendar` | dashed `border-stroke-primary-active`, `rounded-control-inner`, no fill |

## Item language
Every item has a palette colour (ADR-0040, `lib/agenda/colors.ts`): an event takes `AgendaEventItem.color` (until `calendars.color` exists, `manual` is blue and `sync` violet), meals are green, planned cards amber, deadlines red. A colour is three tokens, `event-<colour>-surface`, `-text` and `-accent`, read through the literal lookup table in `AgendaCalendarTheme.ts` (Tailwind needs whole class names).

| Kind | Look |
|---|---|
| Event (own or imported) | block: `event-<c>-surface` fill, `event-<c>-text`, `border-s-4` stripe in `event-<c>-accent`; imported adds the `CalendarSync` icon |
| Recurring own event (`recurring`) | the event block, plus a small `Repeat` icon (12px) after the title with an `sr-only` "Terugkerende afspraak"; it sits in the title row because day and month items have no meta row |
| Meal | green block, slot icon (Croissant, Sandwich, Utensils, Cookie), recipe title; always all-day. The moment ("Diner") is not drawn behind the title in the all-day row, month and grid: it stays in `sr-only` text and `title`. List and day-row meta show it |
| Planned card | amber block, `Columns3` icon, board and column |
| Deadline | no fill, `event-red-text`, `AlarmClockCheck`; hover and selected fill `event-red-surface`; lives in the all-day row |
| Removed at source (`missingSince`) | colour block with dashed border, `opacity-60`, "Verwijderd bij bron" |
| Draft (selection mirror, drag ghost) | dashed `border-stroke-primary-active` on white |

Hover, active and selected move the border on the top, bottom and end sides (`stroke-primary-hover/-active/-selected`), so the stripe keeps its colour. Dragging dims the source (`opacity-60`) and the mirror takes `border-stroke-primary-active`. The list view keeps the stripe and the text colour on a transparent row; month and the all-day row use the same blocks as the grid.

Item text (title, time, place) is `text-xs` in every view: blocks, all-day chips, month rows, the "+N more" popover and the list; axis labels and day headers keep their own sizes. Content in the time grid: shorter than 45 minutes (`AGENDA_SHORT_MINUTES`) is one line, title then start time (under 30 minutes the line height drops to `leading-none`; the three-day view drops the time to the `title`: no room beside a title); from 45 minutes the title runs on at most two lines (`line-clamp-2`, `wrap-anywhere`) and the time range follows. Blocks clip their content (`overflow-clip`). Lane inset is `inline-xs` on both sides; overlapping items still sit side by side.

## Palette and contrast (ADR-0040 §7)
Nine colours (red, orange, amber, green, teal, blue, violet, pink, stone), each with a light and dark value, code only (`figma: null`). Light: surface = Tailwind 100, text = 800, accent = 500. Dark: surface = **950**, text = 200, accent = 400. A dark 900 surface (the first idea) is 1.01-1.13:1 against the dark grid (`surface-highlight-white`, stone-700) and stone is 1.70:1, so blocks would not stand out; 950 gives 1.41-1.57:1 (stone 1.92) and raises text contrast. The accent stripe is decorative. Measured (WCAG contrast ratios computed from Tailwind's oklch values):

| Colour | Text/surface light | Text/surface dark | Dark surface vs stone-700 | Accent/surface light | Accent/surface dark |
|---|---|---|---|---|---|
| red | 6.86 | 11.14 | 1.57 | 3.13 | 5.58 |
| orange | 6.41 | 11.55 | 1.52 | 2.52 | 6.58 |
| amber | 6.41 | 12.03 | 1.46 | 1.93 | 8.73 |
| green | 6.45 | 12.32 | 1.45 | 2.02 | 8.40 |
| teal | 6.69 | 11.50 | 1.41 | 2.15 | 7.76 |
| blue | 7.25 | 10.35 | 1.43 | 3.08 | 5.58 |
| violet | 7.71 | 10.99 | 1.49 | 3.70 | 5.36 |
| pink | 6.71 | 10.89 | 1.47 | 3.05 | 5.47 |
| stone | 13.93 | 15.72 | 1.92 | 4.41 | 7.63 |

Light surfaces are 1.09-1.22:1 against the white grid; the stripe and text carry the difference. Moving the palette to Figma later means filling `figma` and `figmaVariableId` for the 27 tokens.

## Deliberate decisions
- No FullCalendar theme plugin, `theme.css` or `--fc-*` variables. `skeleton.css` (positioning only) is imported by the component.
- All events render as blocks (`display: "block"`), also in month view, so kinds keep their surface instead of FullCalendar's dot style. `eventContent` is ours; labels are resolved with `useTranslations` once and passed in, because FullCalendar renders content outside our hook scope.
- Meals are day items: they sit in the all-day zone (week, day), never as a block on the hour grid. `eventOrder` is `compareEventOrder`: all-day items first (deadlines, planned cards, events, then meals by moment and `position`), timed items by start.
- Editability per kind (`itemEditability`): synced events and deadlines are fixed; meals and planned cards move but keep their length; manual events move, and resize when timed. FullCalendar enforces it via `startEditable`/`durationEditable`. An occurrence of a recurring event moves and resizes like any own event; the page saves that as "Alleen deze" (the row becomes detached, ADR-0042).
- Overlapping timed items sit side by side (`slotEventOverlap: false`).
- `week` becomes `threeDay` below `md` (`useIsNarrow`, wide on SSR). Day view is the other mobile default. FullCalendar has no swipe between days: the page header carries prev/next arrows.
- External dragging: `useAgendaDraggable(ref, payload)` wraps `Draggable` with `create: false`; the drop reports `{ payload, start, allDay, eventId? }` through `onExternalDrop` and the parent creates the item. `eventId` is the event under the pointer (`eventDidMount` stamps `data-agenda-event-id` on event elements; the drop looks them up with `elementsFromPoint`, also for touch), so a drop on an appointment can attach to it. The payload travels in a `WeakMap`, not the DOM.
- Selection fills the whole cell: the time-grid selection mirror (an event without item) cancels the lane inset with a negative margin in `columnEventClass`; real items keep the inset.
- Selection snaps to whole slots (#548): `select` widens every timed selection with `slotsForSelection` (start floored, end ceiled to the 30-minute slot, so the cell where the pointer is released counts fully, also when dragging upward) and re-selects it. Moving and resizing existing items still snaps to 15 minutes (`snapDuration`).
- Hover outline: on `(hover: hover) and (pointer: fine)` an overlay (`aria-hidden`, `pointer-events-none`) follows the mouse and outlines the empty cell it would select: one 30-minute slot of a day column in the time grid (`slotBox`, clipped to the scroller with `clipBox`), the whole cell in the all-day row and month. It hides over items (`data-agenda-item`), links and buttons, while a button is down, on scroll and on leave. It works through `pointermove` + `requestAnimationFrame` with no React state; its `top/left/width/height` are set imperatively on the overlay (the one inline style we write, like FullCalendar's own geometry).
- Tap to create: `dateClick` calls `api.select` (30 minutes for a time slot, the whole day for all-day/month cells), so a tap behaves as a desktop click-select. FullCalendar ignores scroll gestures and event taps; a tap within 400 ms of a `select` is dropped, so a mouse click does not select twice.
- Touch: `AGENDA_LONG_PRESS_MS` (350) for the external draggable, `eventLongPressDelay`, `selectLongPressDelay` and `longPressDelay`, so a tray or grid still scrolls on a quick swipe.
- Scrollbars are hidden inside the frame (same as Carousel/EditingBar).
- Opening scroll (`scrollTime`, recomputed per render from `initialScrollHour`): a range that holds today opens at the hour before now (14:48 opens at 13:00, floored to the hour so a gridline sits on top; never before 00:00), any other range at 07:00. FullCalendar re-applies `scrollTime` whenever the range changes (`scrollTimeReset`), so stepping to another week scrolls to 07:00 and back to today's week to the hour before now. The prop `scrollNowKey` (the page bumps it on "Vandaag") scrolls again when the date does not change, so FullCalendar would not. A grid shorter than the day clamps at the bottom, as in any scroll. `scrollToNow={false}` keeps 07:00; the older stories use it so their baselines keep their items in view.
- The time axis has one label width (`AXIS_LABEL`, `w-14`, right-aligned) shared by the hour labels, "Hele dag" and the now label. FullCalendar sizes the axis from the widest label, and the now label sits in an overlay as wide as the whole view, so equal widths are what lets it lie exactly over its hour label (`start-0` plus the same margin). Hour labels within 15 minutes of now (`isUnderNowLabel`) are `invisible` (they keep their space) while the shown range holds today, so only the pill is there, as in Apple Calendar. The class settings read the clock, so the component rebuilds them once a minute (`useMinute`) to make FullCalendar re-run them.
- The skeleton mirrors the week grid (three days below `md`), real card/surface tokens, `animate-breathe`, one `role="status"`.

## Token gaps and flags
- The palette tokens have no hover/active/selected steps: those states move the border (see above). `surface-highlight-*` still has no dark values elsewhere (`Tag`).
- No "today" token: the column is a `surface-secondary/40` tint (an opaque `surface-primary` hid the slot lines in dark mode); the chip and the now line reuse the red palette tokens. Chip contrast is the red text/surface pair above (6.86 light, 11.14 dark).
- No opacity token: `opacity-60` marks dragging and removed items.
- `min-w-56` on the popover and the `w-16` time column in the skeleton are layout sizes, not scale values. Other-month days dim with `opacity-50`: `text-placeholder` has no dark value.

## Gotchas
- FullCalendar writes event geometry inline (`top`, `height`, `inset-inline`); the only other inline style is the hover overlay's position (see above), and none comes from JSX. Its `fc-*` skeleton classes are `!important`: never fight them with utilities.
- `views.list.eventClass` replaces the kind surface in list view; the top-level `eventClass` applies to every view. Per-view settings are keyed by view type (`timeGrid`, `dayGrid`, `list`), not by name.
- Time zones: FullCalendar runs in the browser zone (`timeZone: "local"`) and returns offsets. Convert on the page/server boundary (#486); all-day items are dates without zone.
- Selecting a slot leaves FullCalendar's mirror until `items` change or the view moves; the page opens its panel from `onSelectSlot`.
- Visual stories assume the suite's frozen clock (Thursday 2026-01-01 14:00) for the today marker, now line and opening scroll. `Now`, `NowDay`, `NowMobile` and `OtherWeek` open on the clock; the rest set `scrollToNow={false}`.
- Thumbnails (`thumbnailPath`) are not drawn in the grid; the recipe tray/list can use them later.
