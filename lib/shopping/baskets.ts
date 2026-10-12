// #429: the basket choice behind the recipe -> Winkelmand send buttons.
// Pure (no server-only), so the one-basket-vs-many decision is unit-testable
// and the molecules can import the type. Access to an explicit basket is
// decided by RLS (ADR-0035); nothing here grants anything.

export interface BasketOption {
  id: string;
  /** Display name, already translated for a null DB name. */
  name: string;
  /** Shared: at least one accepted share, or the caller is not the owner. */
  shared: boolean;
}

/** One available basket sends straight to the default; more than one asks first. */
export function needsBasketChoice(baskets: readonly BasketOption[] | undefined): boolean {
  return (baskets?.length ?? 0) > 1;
}

export interface BasketSourceRow {
  id: string;
  name: string | null;
  user_id: string;
}

export function toBasketOptions({
  lists,
  acceptedShareListIds,
  userId,
  defaultName,
}: {
  lists: readonly BasketSourceRow[];
  acceptedShareListIds: ReadonlySet<string>;
  userId: string;
  defaultName: string;
}): BasketOption[] {
  return lists.map((list) => ({
    id: list.id,
    name: list.name ?? defaultName,
    shared: list.user_id !== userId || acceptedShareListIds.has(list.id),
  }));
}
