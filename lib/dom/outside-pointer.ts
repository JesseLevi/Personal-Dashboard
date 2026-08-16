// Pure containment check backing `useCloseOnOutsidePointerDown`
// (app/(app)/_components/AppShellNav.tsx). Extracted so it can be unit
// tested without jsdom/RTL — see tests/outside-pointer.test.ts.

/** The subset of `Node`/`RefObject.current` this check actually needs. */
export interface ContainmentCheck {
  contains(node: Node): boolean;
}

/**
 * True when `target` is outside every given container. A `null` entry
 * (unmounted ref) is skipped rather than counted as "outside" or "inside".
 */
export function isOutsideAllContainers(
  target: Node,
  containers: ReadonlyArray<ContainmentCheck | null>,
): boolean {
  return containers.every((container) => !container || !container.contains(target));
}
