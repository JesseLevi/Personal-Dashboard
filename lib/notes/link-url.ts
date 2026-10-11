// Link URL validation for the notes editor (#331, ADR-0021 s6): the single
// place that decides which hrefs a note may carry. Used by the Link
// extension's `isAllowedUri` (lib/notes/extensions.ts, so pasted, autolinked
// and stored hrefs are filtered too) and by the link popover input.
const ALLOWED_PROTOCOLS = ["http:", "https:", "mailto:"];
export const LINK_PROTOCOLS = ["mailto"];

const FORBIDDEN_CHARS = /[\s\u0000-\u001f\u007f\\]/;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const HOST_WITH_PORT = /^[^/?#:@\s]+:\d+(?:[/?#]|$)/;
const BARE_EMAIL = /^[^\s/?#:@]+@[^\s/?#:@]+\.[^\s/?#:@]+$/;

/** True when `uri` is an absolute http(s) URL with a host, or a mailto: with an address. */
export function isAllowedLinkUri(uri: string | null | undefined): boolean {
  if (!uri || FORBIDDEN_CHARS.test(uri)) return false;
  try {
    const url = new URL(uri);
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) return false;
    if (url.protocol === "mailto:") return url.pathname.length > 0;
    return url.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Turns what a user typed into a storable href, or `null` when it is not an
 * allowed link. `example.com` becomes `https://example.com`, `a@b.nl` becomes
 * `mailto:a@b.nl`; `javascript:`, `data:`, `ftp:`, `//host` and anything
 * with whitespace are rejected.
 */
export function normalizeLinkUrl(input: string): string | null {
  const value = input.trim();
  if (!value || FORBIDDEN_CHARS.test(value) || value.startsWith("//")) return null;

  let candidate: string;
  if (HAS_SCHEME.test(value) && !HOST_WITH_PORT.test(value)) {
    candidate = value;
  } else if (BARE_EMAIL.test(value)) {
    candidate = `mailto:${value}`;
  } else {
    candidate = `https://${value}`;
    const host = value.split(/[/?#]/)[0].replace(/:\d+$/, "");
    if (!host.includes(".") && host !== "localhost") return null;
  }
  return isAllowedLinkUri(candidate) ? candidate : null;
}
