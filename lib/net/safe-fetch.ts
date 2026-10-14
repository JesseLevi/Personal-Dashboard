import "server-only";

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request } from "node:https";

// SSRF-guarded fetch for user-supplied URLs (Architecture §6; #313).
// Rules: https only, no credentials, port 443 only (invalid_url otherwise);
// DNS is resolved once, every address must be public, and the connection goes
// to that validated IP (Host/SNI stay the hostname), so there is no
// resolve/connect gap for DNS rebinding. Max 3 redirects, followed manually,
// each hop re-validated. Body capped at 3 MB, 10 s for the whole operation.
// Only text/html, application/xhtml+xml, application/ld+json (+ image/* with
// `allowImages`) are returned; `contentTypes` replaces that list (an entry
// ending in "/" is a prefix, and `accept` sets the Accept header). Returns { url (final), status, contentType
// (mime, lowercase, no params), body (Buffer) }.
//
// SafeFetchError.code: invalid_url (bad URL, scheme, credentials, port, or DNS
// failure), blocked_address, too_large, timeout, bad_content_type,
// too_many_redirects, http_error (non-2xx, or redirect without Location).
//
// Tests inject `resolve` and `transport`, so nothing touches the network.

export type SafeFetchErrorCode =
  | "invalid_url"
  | "blocked_address"
  | "too_large"
  | "timeout"
  | "bad_content_type"
  | "too_many_redirects"
  | "http_error";

export class SafeFetchError extends Error {
  constructor(
    readonly code: SafeFetchErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export type ResolvedAddress = { address: string; family: number };

export type TransportRequest = {
  url: URL;
  /** Validated IP to connect to; Host header and TLS SNI use url.hostname. */
  address: ResolvedAddress;
  headers: Record<string, string>;
  signal: AbortSignal;
};

export type TransportResponse = {
  status: number;
  headers: Record<string, string | undefined>;
  body: AsyncIterable<Uint8Array>;
  /** Stop reading and release the socket. */
  destroy: () => void;
};

export type SafeFetchOptions = {
  allowImages?: boolean;
  /** Replaces the default allowed content types. */
  contentTypes?: string[];
  /** Accept header to send with `contentTypes`. */
  accept?: string;
  timeoutMs?: number;
  maxBytes?: number;
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>;
  transport?: (req: TransportRequest) => Promise<TransportResponse>;
};

export type SafeFetchResult = {
  url: string;
  status: number;
  contentType: string;
  body: Buffer;
};

const MAX_REDIRECTS = 3;
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const TEXT_TYPES = ["text/html", "application/xhtml+xml", "application/ld+json"];
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Separate lists: Node matches IPv4 input against IPv4-mapped IPv6 rules.
const blocked4 = new BlockList();
const blocked6 = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this network", unspecified
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local incl. metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
] as const) {
  blocked4.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["::", 96], // IPv4-compatible (deprecated)
  ["::ffff:0:0", 96], // IPv4-mapped: never a legitimate public target
  ["64:ff9b::", 96], // NAT64
  ["64:ff9b:1::", 48],
  ["100::", 64], // discard
  ["2001::", 32], // Teredo
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4
  ["fc00::", 7], // unique-local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (deprecated)
  ["ff00::", 8], // multicast
] as const) {
  blocked6.addSubnet(net, prefix, "ipv6");
}

/** True when the literal IP is not safely public. Unparseable input is blocked. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  return family === 4
    ? blocked4.check(address, "ipv4")
    : blocked6.check(address, "ipv6");
}

async function defaultResolve(hostname: string): Promise<ResolvedAddress[]> {
  return lookup(hostname, { all: true, verbatim: true });
}

function defaultTransport(req: TransportRequest): Promise<TransportResponse> {
  return new Promise((resolve, reject) => {
    const r = request(
      {
        host: req.address.address,
        port: 443,
        path: req.url.pathname + req.url.search,
        method: "GET",
        // RFC 6066: SNI carries hostnames only, never an IP literal.
        servername: isIP(req.url.hostname.replace(/^\[|\]$/g, "")) ? undefined : req.url.hostname,
        headers: { ...req.headers, Host: req.url.host },
        signal: req.signal,
      },
      (res) => {
        const headers: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          headers[k] = Array.isArray(v) ? v[0] : v;
        }
        resolve({
          status: res.statusCode ?? 0,
          headers,
          body: res,
          destroy: () => res.destroy(),
        });
      },
    );
    r.on("error", reject);
    r.end();
  });
}

function parseUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("invalid_url", "Not a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new SafeFetchError("invalid_url", "Only https URLs are allowed");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("invalid_url", "Credentials in URL are not allowed");
  }
  // WHATWG URL normalises an explicit :443 to "", so any remaining port is non-default.
  if (url.port !== "") {
    throw new SafeFetchError("invalid_url", "Only the default https port is allowed");
  }
  return url;
}

async function pickAddress(
  url: URL,
  resolve: NonNullable<SafeFetchOptions["resolve"]>,
): Promise<ResolvedAddress> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const literal = isIP(host);
  let addresses: ResolvedAddress[];
  if (literal) {
    addresses = [{ address: host, family: literal }];
  } else {
    try {
      addresses = await resolve(host);
    } catch {
      throw new SafeFetchError("invalid_url", "Hostname could not be resolved");
    }
  }
  if (addresses.length === 0) {
    throw new SafeFetchError("invalid_url", "Hostname could not be resolved");
  }
  // One bad record poisons the host: a rebinding set mixes public and private.
  if (addresses.some((a) => isBlockedAddress(a.address))) {
    throw new SafeFetchError("blocked_address", "Address is not publicly routable");
  }
  return addresses[0];
}

async function readCapped(res: TransportResponse, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes) {
    res.destroy();
    throw new SafeFetchError("too_large", "Response too large");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += chunk.byteLength;
    if (total > maxBytes) {
      res.destroy();
      throw new SafeFetchError("too_large", "Response too large");
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function safeFetch(
  rawUrl: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const resolve = opts.resolve ?? defaultResolve;
  const transport = opts.transport ?? defaultTransport;
  const maxBytes = opts.maxBytes ?? MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const allowed = opts.contentTypes ?? (opts.allowImages ? [...TEXT_TYPES, "image/"] : TEXT_TYPES);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  // Rejects when the deadline fires, even if a transport ignores the signal.
  const deadline = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () =>
      reject(new SafeFetchError("timeout", "Request timed out")),
    );
  });
  deadline.catch(() => {});

  const run = async (): Promise<SafeFetchResult> => {
    let url = parseUrl(rawUrl);
    for (let hop = 0; ; hop++) {
      const address = await pickAddress(url, resolve);
      const res = await transport({
        url,
        address,
        headers: {
          "User-Agent": USER_AGENT,
          Accept:
            opts.accept ??
            (opts.allowImages
              ? "text/html,application/xhtml+xml,application/ld+json,image/*;q=0.8"
              : "text/html,application/xhtml+xml,application/ld+json"),
          "Accept-Encoding": "identity",
        },
        signal: controller.signal,
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        res.destroy();
        const location = res.headers.location;
        if (!location) {
          throw new SafeFetchError("http_error", "Redirect without Location", res.status);
        }
        if (hop >= MAX_REDIRECTS) {
          throw new SafeFetchError("too_many_redirects", "Too many redirects");
        }
        let next: URL;
        try {
          next = new URL(location, url);
        } catch {
          throw new SafeFetchError("invalid_url", "Invalid redirect target");
        }
        url = parseUrl(next.href);
        continue;
      }

      if (res.status < 200 || res.status >= 300) {
        res.destroy();
        throw new SafeFetchError("http_error", `HTTP ${res.status}`, res.status);
      }
      const contentType = (res.headers["content-type"] ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      const ok = allowed.some((t) =>
        t.endsWith("/") ? contentType.startsWith(t) : contentType === t,
      );
      if (!ok) {
        res.destroy();
        throw new SafeFetchError(
          "bad_content_type",
          `Content type not allowed: ${contentType || "none"}`,
        );
      }
      const body = await readCapped(res, maxBytes);
      return { url: url.href, status: res.status, contentType, body };
    }
  };

  try {
    return await Promise.race([run(), deadline]);
  } catch (err) {
    if (err instanceof SafeFetchError) throw err;
    if (timedOut) throw new SafeFetchError("timeout", "Request timed out");
    throw new SafeFetchError("http_error", "Request failed");
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
