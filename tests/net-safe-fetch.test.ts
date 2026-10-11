import { describe, expect, it, vi } from "vitest";

// "server-only" throws outside a react-server context, including Vitest.
vi.mock("server-only", () => ({}));

import {
  isBlockedAddress,
  safeFetch,
  SafeFetchError,
  type TransportRequest,
  type TransportResponse,
} from "@/lib/net/safe-fetch";

const PUBLIC = [{ address: "93.184.216.34", family: 4 }];
const resolvePublic = async () => PUBLIC;

function res(
  status: number,
  headers: Record<string, string>,
  body: Uint8Array[] = [],
): TransportResponse {
  return {
    status,
    headers,
    body: (async function* () {
      yield* body;
    })(),
    destroy: vi.fn(),
  };
}
const html = (text = "<html></html>") =>
  res(200, { "content-type": "text/html; charset=utf-8" }, [Buffer.from(text)]);

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof SafeFetchError) return e.code;
    throw e;
  }
  return "no error";
}

describe("isBlockedAddress", () => {
  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "100.127.255.255",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:10.0.0.1",
    "64:ff9b::7f00:1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "febf::1",
    "ff02::1",
    "2001:db8::1",
    "2002:7f00:1::",
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "100.63.255.255", "172.32.0.1", "2606:4700:4700::1111"])(
    "allows %s",
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false);
    },
  );
});

describe("safeFetch", () => {
  it("returns the body on the happy path and pins the validated IP", async () => {
    const transport = vi.fn<(r: TransportRequest) => Promise<TransportResponse>>(
      async () => html("hello"),
    );
    const out = await safeFetch("https://example.com/a?b=1", {
      resolve: resolvePublic,
      transport,
    });
    expect(out).toMatchObject({
      url: "https://example.com/a?b=1",
      status: 200,
      contentType: "text/html",
    });
    expect(out.body.toString()).toBe("hello");
    const req = transport.mock.calls[0][0];
    expect(req.address.address).toBe("93.184.216.34");
    expect(req.url.hostname).toBe("example.com");
    expect(req.headers["User-Agent"]).toMatch(/Mozilla\/5\.0/);
  });

  it.each([
    ["http://example.com/"],
    ["ftp://example.com/"],
    ["https://user:pw@example.com/"],
    ["https://example.com:8443/"],
    ["nonsense"],
  ])("rejects %s as invalid_url", async (url) => {
    const transport = vi.fn();
    expect(await code(safeFetch(url, { resolve: resolvePublic, transport }))).toBe(
      "invalid_url",
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it("allows an explicit :443", async () => {
    const out = await safeFetch("https://example.com:443/", {
      resolve: resolvePublic,
      transport: async () => html(),
    });
    expect(out.url).toBe("https://example.com/");
  });

  it("blocks hostnames resolving to private addresses, including mixed sets", async () => {
    const transport = vi.fn();
    for (const addrs of [
      [{ address: "127.0.0.1", family: 4 }],
      [
        { address: "93.184.216.34", family: 4 },
        { address: "169.254.169.254", family: 4 },
      ],
      [{ address: "::ffff:10.0.0.1", family: 6 }],
    ]) {
      expect(
        await code(safeFetch("https://evil.test/", { resolve: async () => addrs, transport })),
      ).toBe("blocked_address");
    }
    expect(transport).not.toHaveBeenCalled();
  });

  it("blocks IP-literal URLs without resolving", async () => {
    const resolve = vi.fn();
    const transport = vi.fn();
    expect(await code(safeFetch("https://[::1]/", { resolve, transport }))).toBe(
      "blocked_address",
    );
    expect(await code(safeFetch("https://169.254.169.254/", { resolve, transport }))).toBe(
      "blocked_address",
    );
    expect(resolve).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it("re-validates every redirect hop (redirect to private)", async () => {
    const resolve = async (h: string) =>
      h === "internal.test" ? [{ address: "10.0.0.5", family: 4 }] : PUBLIC;
    const transport = vi.fn(async () => res(302, { location: "https://internal.test/admin" }));
    expect(await code(safeFetch("https://example.com/", { resolve, transport }))).toBe(
      "blocked_address",
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("follows relative redirects but rejects a downgrade to http", async () => {
    let n = 0;
    const transport = vi.fn(async (r: TransportRequest) => {
      n++;
      if (n === 1) return res(301, { location: "/next" });
      expect(r.url.href).toBe("https://example.com/next");
      return html();
    });
    await safeFetch("https://example.com/", { resolve: resolvePublic, transport });
    const downgrade = async () => res(302, { location: "http://example.com/" });
    expect(
      await code(safeFetch("https://example.com/", { resolve: resolvePublic, transport: downgrade })),
    ).toBe("invalid_url");
  });

  it("allows 3 redirects and fails on the 4th", async () => {
    const mk = (hops: number) => {
      let n = 0;
      return async () =>
        n++ < hops ? res(302, { location: `https://example.com/${n}` }) : html();
    };
    await expect(
      safeFetch("https://example.com/", { resolve: resolvePublic, transport: mk(3) }),
    ).resolves.toBeTruthy();
    expect(
      await code(safeFetch("https://example.com/", { resolve: resolvePublic, transport: mk(4) })),
    ).toBe("too_many_redirects");
  });

  it("aborts when the body exceeds the cap", async () => {
    const response = res(200, { "content-type": "text/html" }, [
      Buffer.alloc(600),
      Buffer.alloc(600),
    ]);
    expect(
      await code(
        safeFetch("https://example.com/", {
          resolve: resolvePublic,
          maxBytes: 1000,
          transport: async () => response,
        }),
      ),
    ).toBe("too_large");
    expect(response.destroy).toHaveBeenCalled();
  });

  it("rejects early on an oversized Content-Length", async () => {
    const response = res(200, { "content-type": "text/html", "content-length": "5000" }, [
      Buffer.alloc(1),
    ]);
    expect(
      await code(
        safeFetch("https://example.com/", {
          resolve: resolvePublic,
          maxBytes: 1000,
          transport: async () => response,
        }),
      ),
    ).toBe("too_large");
  });

  it("times out the whole operation, even if the transport hangs", async () => {
    const transport = () => new Promise<TransportResponse>(() => {});
    expect(
      await code(
        safeFetch("https://example.com/", { resolve: resolvePublic, timeoutMs: 20, transport }),
      ),
    ).toBe("timeout");
  });

  it("rejects disallowed content types; images only with allowImages", async () => {
    const json = async () => res(200, { "content-type": "application/json" }, [Buffer.from("{}")]);
    expect(
      await code(safeFetch("https://example.com/", { resolve: resolvePublic, transport: json })),
    ).toBe("bad_content_type");
    const png = async () => res(200, { "content-type": "image/png" }, [Buffer.from("x")]);
    expect(
      await code(safeFetch("https://example.com/", { resolve: resolvePublic, transport: png })),
    ).toBe("bad_content_type");
    const out = await safeFetch("https://example.com/", {
      resolve: resolvePublic,
      allowImages: true,
      transport: png,
    });
    expect(out.contentType).toBe("image/png");
    const ld = async () =>
      res(200, { "content-type": "application/ld+json" }, [Buffer.from("{}")]);
    await expect(
      safeFetch("https://example.com/", { resolve: resolvePublic, transport: ld }),
    ).resolves.toBeTruthy();
  });

  it("maps non-2xx to http_error with status", async () => {
    const err = await safeFetch("https://example.com/", {
      resolve: resolvePublic,
      transport: async () => res(404, {}),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(SafeFetchError);
    expect(err).toMatchObject({ code: "http_error", status: 404 });
  });

  it("maps DNS failure to invalid_url", async () => {
    const resolve = async () => {
      throw new Error("ENOTFOUND");
    };
    expect(await code(safeFetch("https://nope.test/", { resolve, transport: vi.fn() }))).toBe(
      "invalid_url",
    );
  });
});
