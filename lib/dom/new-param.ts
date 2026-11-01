const NEW_PARAM = "nieuw";

/** True for `?nieuw=1`, the palette's "create something here" entry point (ADR-0048). */
export function hasNewParam(params: { get(name: string): string | null }): boolean {
  return params.get(NEW_PARAM) === "1";
}

/** The same URL without `nieuw`; every other param stays. */
export function withoutNewParam(pathname: string, params: { toString(): string }): string {
  const next = new URLSearchParams(params.toString());
  next.delete(NEW_PARAM);
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}
