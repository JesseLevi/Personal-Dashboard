# Icon/*

- **Code:** `components/atoms/Icon.tsx`
- **Node ID:** `3760:6187`

single wrapper around lucide-react@1.25.0+ (upgraded 2026-07-20 for the Broccoli icon, added upstream between v1.14–1.15). Figma layer names are kept in sync with lucide export names (renamed 2026-07-20, refined same day: Clock→Alarm-clock-check, Cake→Cake-slice, List→Scroll, Folder→Folder-closed, Columns→Columns-3, Cross→X, Calandar typo fixed to Calendar) so IconName is a direct PascalCase lookup — every entry verified against rendered SVG structure, not name alone (caught 3 real bugs this way: Columns was previously mismapped to Columns2 — a 2-column/1-divider icon — when Figma's vector has 2 dividers = 3 columns; Cross was mapped by literal name to lucide's medical-cross glyph instead of X; the sidebar-panel icons (nodes 3629:126 / 3687:4453) went through an open/close label swap then a left/right correction — the app's sidebar sits on the left, so they're now 'Panel-left-close'/'Panel-left-open', matching the verified divider-at-x=9 geometry — both fixed 2026-07-20 by the user). `Astroid` (ticket #25, Organism/Sidebar node 3674:5664 — the Assistant/AI-agent nav item, Figma layer "Icon/Astroid", vector node 3726:2493) went through a correction 2026-07-22: initially misidentified as a `Sparkle`-shaped false friend and vendored as a custom SVG, on the mistaken belief lucide had no `Astroid` export — the match was made by leading numeric path coefficients alone (`M12.6389 21.7716C12.8184 21.6225…`, matched to `Sparkle` via 11.017/2.814/1.966), which turned out to be a coincidence of the shared 24x24/radius-2 construction, not a shape match (`Sparkle` is a visibly different asymmetric twinkle). lucide does ship an `Astroid` export (spelled without the middle "e", missed by an `/asteroid/i` search, confirmed via Context7 docs), confirmed as the real match by rendering both exports side by side against the Figma vector at 1:1 scale — same symmetric four-point diamond. Fixed to a direct `Astroid` import.

`Timer` was added for ticket #19 (Card-content/Recipi, node-id 3628:67): the node's "Icon" child is an IMAGE-SVG with no layer name beyond "Icon", so it was verified by rendered path structure, not name — the fetched vector (two short lines at 10,2→14,2 and 12,14→15,11, plus a circle at cx=12 cy=14 r=8) matches lucide's `Timer` export exactly (a plain stopwatch, no checkmark) and does NOT match `AlarmClockCheck`, which was ruled out.

`CircleCheck` (node 3878:10477) and `StarPlus` (node 3878:8976) were added for ticket #98 (Phase 3 blocker: the seed migration writes `board_columns.icon = 'CircleCheck'`, which was not yet a valid `IconName`). Verified by rendering the real lucide-react@1.25.0 exports (`renderToStaticMarkup`) into a live page and reading each path/circle's `getBBox()` in-browser, compared coordinate-for-coordinate against the Figma sub-vectors' `x/y/width/height`: `CircleCheck`'s circle is 2,2/20×20 and its check path is 9,10/6×4 in both; `StarPlus`'s star is 2,2/20×19.07 and its plus strokes are 15,18/6×0 and 18,15/0×6 in both — an exact match on every sub-vector, not just a name match. No false friend found for either.

`Save` was added for #94 (`Te doen/*/AddItem`'s footer "Opslaan" button, node `3892:18636`). Verified by downloading the fetched node's SVG (`download_figma_images`) and comparing its 3 paths against lucide-react@1.25.0's `save` icon node array path-for-path: the outer folded-corner rect (`M15.2 3…z`), the bottom label rect (`M17 21V14…`), and the top-left notch (`M7 3V7…`) match exactly (only the Figma export's `C`-curve corner smoothing differs from lucide's straight `a`-arc corners — the same visual glyph, not a different icon). No false friend found.

`WeightTilde` and `AArrowDown` were added for ticket #104 (`Te doen/Desktop/SortOnClick` sort dropdown, node `3877:7682`: Grootte's `Icon/Weight-tilde`, sub-vector `3877:7726`; Alfabetisch's `Icon/A-arrow-down`, sub-vector `3877:7783`). Verified by downloading each fetched sub-vector's SVG (`download_figma_images`) and comparing its raw path `d` coordinates against `lucide-react@1.25.0`'s real export (rendered via `renderToStaticMarkup`), landmark-for-landmark rather than by name — a stricter check than the usual `getBBox()` comparison, since it matches every anchor point instead of just the bounding box: `WeightTilde`'s weight-body path shares the exact anchors `6.5,8` / `21.925,18.46` (Figma's `21.925…2.54`) / `17.48,8` in both (lucide draws the same shape with arc `a` commands, Figma's export with cubic `C` curves — same glyph, different curve-command style, same non-difference class as `Save`'s #94 entry above); the tilde stroke spans the same `7.999,15` → `15.999,15` endpoints via two 4-unit humps in both; the head is a circle at `cx=12 cy=5 r=3` in lucide, exported by Figma as the equivalent 4-arc path with the same bounds (`12,8`/`15,5`/`12,2`/`9,5` — bottom/right/top/left of that circle). `AArrowDown`'s four paths match anchor-for-anchor: chevron `14,12 → 18,16 → 22,12`; stem `18,16 → 18,7`; the "A" apex `2,16 → 6.5,6 (via the same rounded-arc landmarks 6.039,6.31 / 6.962,6.31) → 11,16`; crossbar `3.304,13 → 9.696,13`. No false friend found for either — both are direct, unambiguous matches.

`Search`, `ArrowRightLeft` and `Minus` were added for #123 (portion-stepper molecule + the upcoming ingredient searcher/#131 and `Add recipi/Mobile` name field/#126). `Search` (node `3957:9761`) verified path-for-path: Figma's 16×16 circle at `3,3` matches lucide's `circle cx=11 cy=11 r=8` exactly, and the `4.34×4.34` handle vector at `16.66,16.66` matches lucide's `m21 21-4.34-4.34` endpoint-for-endpoint. `ArrowRightLeft` (node `3957:11145`) was checked against BOTH `ArrowRightLeft` and the same-shaped-sounding `ArrowLeftRight` export to rule out a mirrored false friend: Figma's four sub-vectors (`16,3`/`4×8`; `4,7`/`16×0`; `4,13`/`4×8`; `4,17`/`16×0`) match `ArrowRightLeft`'s four paths bounding-box-for-bounding-box (top arrowhead pointing right at x16–20, bottom arrowhead pointing left at x4–8) — `ArrowLeftRight` draws the mirrored arrangement and does not match. `Minus` has no Figma node to compare against (see `docs/open-questions.md#portion-stepper-figma-draws-plus-twice` — Figma draws `Icon/Plus` on both sides of the stepper it's used in); verified instead that lucide's export really is a single horizontal stroke (`renderToStaticMarkup` → one `path d="M5 12h14"`), and that this stroke is coordinate-identical to the horizontal bar of Figma's own already-verified `Icon/Plus` (`3629:149`, sub-vector at `5,12`/`14×0`) — i.e. `Minus` is exactly "Plus with the vertical stroke removed", not a different glyph (em-dash, underscore, etc.) wearing the right name. Union is now 34 names (was 31).

`Coffee`, `Soup`, `Pizza` and `Cookie` were added for #125's category icon
picker (`Add column/Mobile` `3891:17997` / desktop `3957:11537`, "Icon list"
`3891:18524`/`3957:11544`). **Unlike every earlier addition in this file,
these have no Figma vector to shape-verify against**: all 8 button instances
in both fetched nodes render the identical `Icon/Sandwich` placeholder
(`3632:177`) — the ticket's own Dev Mode annotation ("List all lucide food
icons here") is an instruction to the builder, not a delivered icon list (the
`category-icon-picker-curated-set` open question this raised was resolved by
direct user instruction and now lives in
`design/notes/CategoryPanel.md`). With no Figma
shape to compare paths against, verification here is confirming each is a
real, unambiguous `lucide-react@1.25.0` export via `Object.keys(lucide)`
(`node -e "console.log(Object.keys(require('lucide-react')))"`) rather than
the usual path/bbox comparison — all four are common, single-referent food
glyphs (a mug, a bowl, a wedge, a round biscuit) with no known false-friend
history the way `Cross`/`Astroid` had. Picked alongside the three icons
already in the union (`Sandwich`, `Croissant`, `Broccoli` — all three used by
`seed_default_recipe_categories()`) plus the already-present `CakeSlice`, for
a curated 8: `Sandwich`, `Croissant`, `CakeSlice`, `Broccoli`, `Coffee`,
`Soup`, `Pizza`, `Cookie` — spanning breakfast/drink, lunch/veg, dinner and
dessert/snack rather than 8 near-duplicates.

66 more were added 2026-08-01 on direct user instruction, superseding the
curated-8 decision above: `CategoryPanel`'s icon picker now shows all 74 of
lucide's own "Food & beverage" category
(`design/notes/CategoryPanel.md#icon-picker-all-74`), not a curation.
**Same no-Figma-vector situation as `Coffee`/`Soup`/`Pizza`/`Cookie` above —
none of the 66 has a shape to verify against**, so verification here means
confirming the *list itself* is correct and complete, and that every name is
a real export, not the usual path/bbox comparison:

- The list came from `lucide-icons/lucide`'s own repo, not lucide.dev's
  page text — fetching that page returns no icon names (its grid isn't
  server-rendered). Each icon in the lucide repo carries a `categories`
  array in its own metadata file (e.g. `icons/coffee.json` →
  `"categories": ["food-beverage"]`); pulling all 1756 icons' metadata via
  the GitHub API and filtering on `"food-beverage"` returned exactly 74
  names — matching the count lucide.dev's category page displays, so the
  74-icon universe itself is corroborated by two independent sources, not
  one.
- Every one of the 66 PascalCase names was checked against the installed
  `lucide-react@1.25.0` package's actual exports (`Object.keys` on the
  required module) before being added — none were guessed from the
  kebab-case-to-PascalCase convention alone.
- A handful read as non-obviously food-related from the name alone
  (`Cuboid`, `Torus`, `Tractor`, `DnaOff`, `PaperBag`, `Shell`, `Snail`) —
  each was individually re-checked against its own `tags` metadata before
  being trusted (`Cuboid`: butter/tofu/cheese/soap block shape; `Torus`:
  donut/ring shape, distinct from the literal `Donut` icon; `Tractor`:
  farming/harvest; `DnaOff`: GMO-free; `PaperBag`: takeout bag; `Shell`/
  `Snail`: shellfish/escargot), all genuinely tagged `food-beverage`
  upstream, not a filtering mistake.
- Each of the 66 also has a distinct accessible label in both message
  catalogs (`components.categoryPanel.iconLabels.*`), sourced from the same
  tag metadata rather than a literal reading of the PascalCase name — e.g.
  the four `*Off` dietary-restriction icons whose tags explicitly say
  "gluten free"/"lactose free"/"soy free" read as "Gluten-free"/
  "Lactose-free"/"Soy-free", not "No wheat"/"No milk"/"No bean".

Union is 107 names (counted directly from `IconName`'s union type, not
carried forward from the previous paragraph's running tally, which had
already drifted 3 short of the real count by this point — a pre-existing
documentation slip, not introduced here).

`Flame`, `BicepsFlexed`, `Droplet`, `User` (V2 `NutritionalData` row, node
`3997:15948` mobile / `3997:15543` desktop) and `Settings2` (the ingredients
`Card`'s Pas-aan trigger, node `I3997:25493;3997:25434`) were added for
#160. All five were downloaded (`download_figma_images`) and compared
path-for-path against `lucide-react@1.25.0`'s real exports
(`renderToStaticMarkup`), not matched by name alone: `Flame`'s single closed
path shares every landmark (`12,3` apex, the `16,9.5`/`19,15` right-side
curve, the `8.5,14.5`-region inner teardrop) with lucide's `M12 3q1 4 4
6.5t3 5.5…` — cubic-bezier vs. `q`/`t` quadratic notation, the same
non-difference class as `Save`/`WeightTilde`'s prior entries in this file.
`BicepsFlexed`'s three paths match lucide's three paths point-for-point,
including the shared `12.409,13.017` and `9.964,6.825` anchors. `Droplet`'s
closed path (`12,22`→`19,15`→`16,9.5`→`12,3`→`8,9.5`→`5,15`→back to `12,22`)
matches lucide's arc-based teardrop at every one of those coordinates.
`User`'s two Figma paths (a rounded-rect body + a circle-as-cubic-bezier at
`12,7` radius 4) match lucide's `path` + `circle cx=12 cy=7 r=4` exactly.
`Settings2`'s four Figma paths (two horizontal lines + two circles-as-cubic-
beziers at `17,17` and `7,7`, both radius 3) match lucide's two lines + two
`circle r=3` elements at the same centres. No false friend found for any of
the five.

Union is now 112 names.

No open discrepancies remain.
