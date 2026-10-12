// R2 implementation over the S3-compatible API via aws4fetch (ADR-0024 §2).
import "server-only";
import { createHash } from "node:crypto";
import { AwsClient, AwsV4Signer } from "aws4fetch";
import type { R2Config } from "./env";
import { PRESIGN_EXPIRES_SECONDS, floorToHour, type ObjectStore } from "./types";

const DELETE_BATCH = 1000;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 100;

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const xmlUnescape = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

export function createR2Store(config: R2Config): ObjectStore {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const base = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}`;
  const objectUrl = (key: string) => `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;

  // Sign, then call the global fetch with a URL string and the original body. client.fetch
  // would hand Next's patched fetch a Request, which it rebuilds with a stream body: no
  // Content-Length reaches R2, which answers 411 (#446).
  async function call(url: string, init: RequestInit, okStatuses: number[] = []) {
    const signed = await client.sign(url, init);
    let res: Response;
    for (let attempt = 0; ; attempt++) {
      res = await fetch(url, {
        method: init.method,
        headers: signed.headers,
        body: init.body,
        cache: "no-store",
      });
      const retryable = res.status >= 500 || res.status === 429;
      if (!retryable || attempt >= MAX_RETRIES) break;
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * 2 ** attempt));
    }
    if (!res.ok && !okStatuses.includes(res.status)) {
      throw new Error(`R2 request failed: ${init.method ?? "GET"} ${res.status}`);
    }
    return res;
  }

  async function deleteBatch(keys: string[]) {
    const body =
      `<Delete><Quiet>true</Quiet>` +
      keys.map((k) => `<Object><Key>${xmlEscape(k)}</Key></Object>`).join("") +
      `</Delete>`;
    const res = await call(`${base}?delete`, {
      method: "POST",
      body,
      headers: {
        "content-type": "application/xml",
        "content-md5": createHash("md5").update(body).digest("base64"),
      },
    });
    // Quiet mode reports only failures, and they can arrive with a 200.
    if ((await res.text()).includes("<Error>")) throw new Error("R2 DeleteObjects reported errors");
  }

  async function list(prefix: string, token?: string) {
    const params = new URLSearchParams({ "list-type": "2", prefix });
    if (token) params.set("continuation-token", token);
    const xml = await (await call(`${base}?${params}`, { method: "GET" })).text();
    const keys = [...xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map((m) => xmlUnescape(m[1]));
    const next = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? xmlUnescape(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "")
      : undefined;
    return { keys, next: next || undefined };
  }

  const store: ObjectStore = {
    async put(key, bytes, { contentType, cacheControl }) {
      const headers: Record<string, string> = { "content-type": contentType };
      if (cacheControl) headers["cache-control"] = cacheControl;
      await call(objectUrl(key), { method: "PUT", body: bytes as BodyInit, headers });
    },
    async get(key) {
      const res = await call(objectUrl(key), { method: "GET" }, [404]);
      if (res.status === 404) return null;
      return {
        bytes: new Uint8Array(await res.arrayBuffer()),
        contentType: res.headers.get("content-type") ?? "application/octet-stream",
      };
    },
    async delete(keys) {
      for (let i = 0; i < keys.length; i += DELETE_BATCH) {
        await deleteBatch(keys.slice(i, i + DELETE_BATCH));
      }
    },
    async list(prefix) {
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const page = await list(prefix, token);
        keys.push(...page.keys);
        token = page.next;
      } while (token);
      return keys;
    },
    async deletePrefix(prefix) {
      let count = 0;
      let token: string | undefined;
      do {
        const page = await list(prefix, token);
        if (page.keys.length > 0) await store.delete(page.keys);
        count += page.keys.length;
        token = page.next;
      } while (token);
      return count;
    },
    async presignGet(key, now = new Date()) {
      const url = new URL(objectUrl(key));
      url.searchParams.set("X-Amz-Expires", String(PRESIGN_EXPIRES_SECONDS));
      const signer = new AwsV4Signer({
        url: url.toString(),
        method: "GET",
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        service: "s3",
        region: "auto",
        signQuery: true,
        datetime: floorToHour(now).toISOString().replace(/[:-]|\.\d{3}/g, ""),
      });
      return (await signer.sign()).url.toString();
    },
  };
  return store;
}
