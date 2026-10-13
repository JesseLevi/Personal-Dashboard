# BlurFade
Figma: none (motion is not in the design file) · Code: `app/globals.css` (`animate-blur-in`, `animate-blur-out`), `lib/ui/blur-fade.ts`, story `components/molecules/BlurFade.stories.tsx`

## Anatomy
Not a component: two Tailwind utilities plus a helper module, for a staggered "blur fade" (opacity, 0.98 scale, 8px blur, 4px rise on enter).
- `animate-blur-in`: 420ms, `cubic-bezier(0.22, 1, 0.36, 1)`, opacity 0 -> 1, blur 8px -> 0, scale 0.98 -> 1, translateY 4px -> 0.
- `animate-blur-out`: 280ms, same easing, opacity 1 -> 0, blur 0 -> 8px, scale 1 -> 0.98. Fill mode `both`, so the element stays hidden after exit.
- Stagger: delay = `min(--fade-index * 50ms, 400ms)`. Set the index with `blurFadeStagger(i)` (class `[--fade-index:i]`, i clamped to 0-9).
- `blurOutTotalMs(count, reduced?)` / `blurInTotalMs(count, reduced?)`: how long to await before navigating or swapping. `usePrefersReducedMotion()` supplies `reduced`.

## Deliberate decisions
- Stagger index is a CSS custom property set by utility classes, because inline styles are banned in `components/`. The literal lookup table keeps the classes visible to Tailwind's scanner.
- `BLUR_FADE` in `blur-fade.ts` mirrors the CSS values; change both together.
- `prefers-reduced-motion: reduce`: no blur, scale, rise or stagger; a 120ms opacity fade.
- Exit uses the same ease-out as enter: it starts fast, so it reads as quick.
- Both utilities set `will-change: opacity, filter, transform`, so the element gets its own GPU layer for the run; without it iOS Safari repaints the blur on the CPU each frame and stutters where Chrome stays smooth.

## Token gaps and flags
- Unbound, local custom properties in `:root` of `app/globals.css`: `--blur-fade-in-duration` (420ms), `--blur-fade-out-duration` (280ms), `--blur-fade-ease`, `--blur-fade-step` (50ms), `--blur-fade-max-delay` (400ms), `--blur-fade-blur` (8px), `--blur-fade-reduced-duration` (120ms). `--duration-base` (200ms) is too short for the blur to read.
- Scale 0.98 and rise 4px are literals in the keyframes.

## Gotchas
- `filter` and `transform` create a stacking context and a containing block for fixed descendants; do not animate an ancestor of a `position: fixed` panel.
- The `both` fill keeps a staggered enter element invisible until its turn; an exit element stays visible until its turn.
