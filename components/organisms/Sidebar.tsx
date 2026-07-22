// figma: node-id=3674:5664
import clsx from "clsx";
import { Button } from "../atoms/Button";
import type { IconName } from "../atoms/Icon";

/**
 * Organism/Sidebar — Figma component set "Sidebar" (node-id 3674:5664,
 * Organisms section). The app's persistent left-hand module navigation: an
 * icon-only expand/collapse toggle above a fixed stack of six module links,
 * one per Vision.md §3 module currently in scope (Kanban → "Te doen",
 * Notities, Recepten, Winkelmand → Boodschappenlijst, Kleren → Kleding, the
 * AI-agent → "Assistent").
 *
 * Figma variant axis (verified via MCP per the ticket's own instruction —
 * `componentPropertyDefinitions` on 3674:5664 was read, not assumed): a
 * single boolean, `Collapsed` (`No`/`Yes`), and nothing else — no other
 * property axis exists on this set. Modelled as a plain optional `collapsed`
 * prop with conditional `clsx` classes, the same treatment `Atom/Checkbox`
 * already gives its own Figma `Checked=No/Yes` axis, rather than introducing
 * a CVA boolean variant (an untested pattern in this codebase — every
 * existing CVA use here models a multi-value Style/Size string, not a
 * Yes/No axis).
 *
 * Figma structure, mirrored 1:1 (organism → atoms only, dependencies flow
 * one way per CLAUDE.md):
 *   root `<nav>` (column, p-4, gap-12, items-end, border-r border-border)
 *   ├─ INSTANCE "Button/Default" (icon-only, `variant="filled"`) — the
 *   │  toggle. Icon swaps Panel-left-close (expanded) ↔ Panel-left-open
 *   │  (collapsed); it is the *same* Button style both states, only the
 *   │  icon prop differs.
 *   └─ "Item container" (column, fill width, gap-3) — six fixed
 *      "Button/Default" instances. NOT a generic `children` slot: Figma
 *      hardcodes exactly these six items (same six every time, matching
 *      Vision.md's module list one-to-one), so they are rendered from a
 *      closed, internal `NAV_ITEMS` list rather than composer-supplied
 *      children — the composer only supplies labels/active-state/handlers
 *      for this fixed set, the same "don't invent a slot Figma doesn't
 *      define" reasoning `CardContainer` already used for its own fixed
 *      Croissant icon and edit buttons (there for chrome that can't vary;
 *      here for a list whose membership can't vary). Each item is Icon +
 *      optional Text — Text visibility tracks `collapsed` for every item at
 *      once (Figma's own `With text` boolean is flipped set-wide between the
 *      two Collapsed components, never per item), so `collapsed` alone
 *      decides the icon-only vs. labelled Button branch below.
 *
 * Sizing (measured against the downloaded node PNGs, not assumed —
 * `sidebar-collapsed-no.png` / `sidebar-collapsed-yes.png`, both @2x):
 * - Collapsed=No: Figma states `sizing.horizontal: fixed`, 198px; the PNG
 *   (396×1378 @2x) confirms 198px @1x. Rendered `w-[198px]` — a literal
 *   measured pixel, not a rounding shortcut: Tailwind's default width scale
 *   has no step at 198, and this codebase has no spacing/sizing token layer
 *   yet (only colours are tokenized per ADR-0010), so there is no semantic
 *   name to reuse here the way colour gaps get one.
 * - Collapsed=Yes: Figma states `sizing.horizontal: hug` — genuinely
 *   different from No's `fixed`, not a copy/paste artifact. Rendered
 *   `w-fit`, which lands on the measured 72px (`sidebar-collapsed-yes.png`,
 *   144×1378 @2x → 72px @1x = 16px pad + `Atom/Button`'s own 40px icon-only
 *   footprint + 16px pad) without this file stating that number anywhere —
 *   it falls out of composing unchanged atoms.
 * - Height: both variants report Figma `sizing.vertical: fixed`, 689px —
 *   NOT modelled literally. 689 is far taller than the fetched content
 *   needs (16 pad + 40 toggle + 48 gap + [6×40 items + 5×12 gaps] + 16 pad
 *   ≈ 420px), reading as this specific mockup artboard's own canvas height
 *   rather than a deliberate design constant — no viewport height is
 *   documented anywhere in Architecture.md/Vision.md that 689 could tie to.
 *   Rendered `h-full` so a future layout organism (no App Shell exists yet)
 *   controls the real height — the same "no real parent yet" reasoning
 *   `CardContainer`'s doc comment already used for its own (there
 *   `contextual`, here literally `fixed`) sizing. Flagged for
 *   re-verification once an App Shell is built.
 *
 * Colour: the single stroke (`0px 1px 0px 0px`, right edge only) is
 * stone-300 → the existing `border` token, not `surface-raised-hover` even
 * though both share the stone-300 primitive — different semantic role
 * (border vs. fill), so no gap. No other token is touched directly by this
 * file: every nav item's fill/text colour comes from composing `Atom/Button`
 * unchanged (`variant="filled"`/`variant="transparent"`), which already
 * reads its own tokens.
 *
 * FLAGGED GAP — the active item's fill has no dedicated token (open
 * question in docs/design-tokens.md, search "Sidebar"): the fetched node's
 * one instance that differs from its five siblings (Recepten) resolves to
 * Button's component `Type=Default, Style=Filled, State=Hover` (fill
 * stone-300, `surface-raised-hover`), not `Style=Filled, State=Default`
 * (stone-200, `surface-raised`) every other item's own Default instance
 * uses. An earlier revision of this file read that as a hover-capture
 * artifact (drawing on `Atom/Checkbox`'s ticket #45, which really did trace
 * a reported colour to canvas noise) and shipped stone-200 instead — that
 * reasoning does not survive independent pixel-sampling of the fetched
 * component SET: the toggle button stays stone-200 and the active pill
 * stays stone-300 in *both* separately-rendered `Collapsed=No`/`Collapsed=
 * Yes` variants alike. A single stray hover pointer cannot tint the same
 * item inside two independent variant components at once, so unlike
 * Checkbox's case, this is real, deliberate, stable design — not noise —
 * and stone-200 was silently normalising the design to the wrong colour,
 * exactly what CLAUDE.md's token-gap rule forbids.
 *
 * Corrected: the active item's resting fill is stone-300, rendered by
 * composing `Atom/Button` with `variant="filled"` plus a `!`-forced
 * `bg-surface-raised-hover` override (Tailwind's trailing-`!` important
 * modifier — the deterministic way to win a same-specificity, same-property
 * conflict against the variant's own `bg-surface-raised`, rather than
 * gambling on utility generation order the way an unmarked override class
 * would). This deliberately **reuses** the existing `surface-raised-hover`
 * token for a persistent (non-hover) state, per CLAUDE.md's explicit
 * instruction for this exact situation ("reuse the existing token for the
 * correct pixels and record the gap") — it is not a new token and not a
 * hardcoded hex.
 *
 * REGRESSION, FOUND AND FIXED IN REVIEW: a bare `bg-surface-raised-hover!`
 * outranks *every* non-important rule on that property regardless of
 * specificity — including Button's own `active:bg-surface-raised-active`,
 * so the very first shipped version of this override left a pressed active
 * item visually dead (measured in a real browser: resting/hovered/pressed
 * all read the identical stone-300, against a plain `variant="filled"`
 * control button that did visibly darken on press). That is exactly the
 * failure docs/design-tokens.md's own convention warns about — "a selected
 * button must still react to the pointer" — so a lone resting override is
 * not a complete fix, only half of one. The companion below,
 * `active:bg-surface-raised-active!`, is an equally-important rule scoped to
 * `:active` so it wins the same tie *only* while pressed, restoring the
 * atom's intended pressed feedback (`surface-raised-active`/stone-400 is
 * already exactly what `variant="filled"` uses for its own Active state, so
 * this invents no new value) — the same compound-override shape
 * `Atom/Button`'s Outline/Selected already uses to keep Selected composing
 * with Active rather than suppressing it.
 *
 * The gap this creates: `docs/design-tokens.md` currently states there is
 * deliberately no `role-selected` token, because Selected only ever darkens
 * text — and records `surface-raised-selected` as removed for lack of any
 * consumer. This component *is* that missing consumer: a persistent
 * selected/active state that carries a real fill, which the documented
 * assumption says shouldn't exist. Borrowing `surface-raised-hover` is a
 * stopgap that produces the right pixels today, not a permanent answer — a
 * real fix needs a dedicated selected-fill token (see the new open question
 * in docs/design-tokens.md).
 *
 * This composition problem is only PARTLY solved, not fully — be precise
 * about which half: pressing an active item now works correctly (verified
 * in a real browser after the fix — see the regression note above), but
 * hovering one still shows no visible change, and that residual flatness is
 * NOT a bug the `!` override introduced or could fix. It is inherent to
 * Figma's own chosen value: the active item's resting colour (stone-300) IS
 * `variant="filled"`'s Hover colour, so there is no third, lighter shade
 * left for `:hover` to move to even with a correct override in place. Same
 * missing-hover-affordance family docs/design-tokens.md's open questions 3
 * and 5 already record for Button/Transparent and Ingredient rows —
 * cross-referenced there rather than inventing a hover treatment Figma
 * doesn't show.
 *
 * Icons: `Panel-left-close`/`Panel-left-open` and the five listed module
 * icons were already shape-verified by earlier tickets (see `Icon.tsx`'s own
 * header). One new mapping was needed for this ticket — `Icon/Astroid` (node
 * 3726:2493, the Assistant item) maps directly to lucide's own `Astroid`
 * export, confirmed by rendering both side by side (an earlier pass had
 * wrongly matched it to `Sparkle` by numeric coincidence — see `Icon.tsx`'s
 * header for the full correction, search "ticket #25").
 *
 * Accessibility: the whole component is a `<nav>` landmark with a
 * composer-supplied accessible name (`navLabel`) — a "region" is exactly
 * what this is (the six module links plus their own collapse toggle), so it
 * is not split into an outer `<aside>` wrapping an inner `<nav>`. The active
 * item carries `aria-current="page"` (valid on any element per the ARIA
 * spec, not link-only — these are `<button>`s, not `<a>`s, since the fetched
 * node nests plain `Button/Default` instances, never link instances; real
 * `href`/`Link` integration is a future, composer-level concern this file
 * does not invent). The toggle is icon-only, so its accessible name is a
 * required prop the composer must pick per current state (`toggleLabel` —
 * e.g. "Expand sidebar" while collapsed, "Collapse sidebar" while expanded),
 * the same discriminated-union requirement `Atom/Button` itself already
 * enforces for any icon-only instance.
 *
 * i18n: every user-facing string (the six item `labels`, `navLabel`,
 * `toggleLabel`) is a required composer prop, never imported from
 * next-intl in this file — the same leaf/composer split `CardContainer`'s
 * `addLabel`/`editLabel` already established. Catalog keys live under
 * `components.sidebar.*` in `messages/{nl,en}.json`.
 *
 * Server Component (no `"use client"`): `collapsed` is a plain prop, not
 * component-owned state, because — unlike `Atom/Dropdown`'s disclosure,
 * which is identical ephemeral UI state for every caller and so stays
 * self-owned — *where* a sidebar's collapsed flag lives genuinely varies by
 * caller (a cookie for SSR-stable layout, `localStorage`, URL state, etc.),
 * so the composing layout, not this leaf, must own it. Same reasoning
 * `Atom/Checkbox` already gives for staying a Server Component with a
 * composer-owned `checked`.
 */
export type SidebarItemId =
  | "todo"
  | "notes"
  | "recipes"
  | "shopping"
  | "clothes"
  | "assistant";

const NAV_ITEMS: ReadonlyArray<{ id: SidebarItemId; icon: IconName }> = [
  { id: "todo", icon: "Columns3" },
  { id: "notes", icon: "Notebook" },
  { id: "recipes", icon: "FolderClosed" },
  { id: "shopping", icon: "ShoppingBasket" },
  { id: "clothes", icon: "Shirt" },
  { id: "assistant", icon: "Astroid" },
];

export interface SidebarProps {
  /** Figma `Collapsed` variant axis (No/Yes). Defaults to expanded (`No`). */
  collapsed?: boolean;
  /** Accessible name for the root `<nav>` landmark. */
  navLabel: string;
  /** Icon-only toggle's accessible name — pick the text for the state a click would move TO (e.g. "Expand sidebar" while collapsed). */
  toggleLabel: string;
  /** Forwarded to the toggle button's `onClick`. */
  onToggle?: () => void;
  /** The fixed module matching the current page/route, if any. */
  activeItem?: SidebarItemId;
  /** One label per fixed module — composer-supplied, see `messages/*.json` `components.sidebar.items.*`. */
  labels: Record<SidebarItemId, string>;
  /** Fired with the item id when a module link is clicked. */
  onNavigate?: (item: SidebarItemId) => void;
  className?: string;
}

export function Sidebar({
  collapsed = false,
  navLabel,
  toggleLabel,
  onToggle,
  activeItem,
  labels,
  onNavigate,
  className,
}: SidebarProps) {
  return (
    <nav
      aria-label={navLabel}
      className={clsx(
        "flex h-full flex-col items-end gap-12 border-r border-border p-4",
        collapsed ? "w-fit" : "w-[198px]",
        className,
      )}
    >
      <Button
        variant="filled"
        icon={collapsed ? "PanelLeftOpen" : "PanelLeftClose"}
        aria-label={toggleLabel}
        onClick={onToggle}
      />
      <div className="flex w-full flex-col gap-3">
        {NAV_ITEMS.map(({ id, icon }) => {
          const isActive = id === activeItem;
          const variant = isActive ? "filled" : "transparent";
          const label = labels[id];
          const handleClick = onNavigate ? () => onNavigate(id) : undefined;
          // See the class doc comment ("FLAGGED GAP" / "REGRESSION, FOUND
          // AND FIXED IN REVIEW") for why the active item forces
          // `surface-raised-hover` (stone-300) at rest rather than Filled's
          // own default `surface-raised` (stone-200) — and why the
          // `active:` companion below is required, not optional: a bare
          // resting `!` override outranks Button's own non-important
          // `active:bg-surface-raised-active`, which would otherwise leave
          // a pressed active item visually dead.
          const activeFillOverride = isActive
            ? "bg-surface-raised-hover! active:bg-surface-raised-active!"
            : undefined;

          return collapsed ? (
            <Button
              key={id}
              variant={variant}
              icon={icon}
              className={activeFillOverride}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              onClick={handleClick}
            />
          ) : (
            <Button
              key={id}
              variant={variant}
              icon={icon}
              className={activeFillOverride}
              aria-current={isActive ? "page" : undefined}
              onClick={handleClick}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
