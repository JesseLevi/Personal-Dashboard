import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { widgetDaySchema, type WidgetDay } from "../lib/widget/contract";
import { WIDGET_SCRIPT_VERSION } from "../lib/widget/script-version";

const SOURCE = readFileSync(path.join(__dirname, "../public/widget/atlas-widget.js"), "utf8");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...a: string[]) => (...a: unknown[]) => Promise<void>;

type Node = { kind: string; props: Record<string, unknown>; children: Node[] };
type Script = {
  SCRIPT_VERSION: number;
  errorText: (kind: string, language: string) => string;
  tapUrl: (date: string, parameter?: string) => string;
  selectItems: (day: WidgetDay, family: string) => { empty: boolean; items: WidgetDay["today"]; sections?: { title: string; items: WidgetDay["today"] }[]; remaining: string };
  inlineText: (day: WidgetDay) => string;
  decideOutcome: (status: number, day: unknown, cached: unknown) => { kind: string; text?: string };
  buildWidget: (family: string, state: Record<string, unknown>, language: string) => Node & Record<string, unknown>;
  loadState: (parameter?: string) => Promise<Record<string, unknown>>;
};

function makeNode(kind: string): Node & Record<string, unknown> {
  const node: Node & Record<string, unknown> = { kind, props: {}, children: [] };
  const child = (k: string) => {
    const c = makeNode(k);
    node.children.push(c);
    return c;
  };
  Object.assign(node, {
    addText: (text: string) => Object.assign(child("text"), { text }),
    addStack: () => child("stack"),
    addSpacer: (n?: number) => Object.assign(child("spacer"), { n }),
    layoutHorizontally: () => {},
    layoutVertically: () => {},
    centerAlignContent: () => {},
    centerAlignText: () => {},
    setPadding: () => {},
  });
  return node;
}

function load(opts: { token?: string | null; status?: number; body?: string; throws?: boolean; cache?: string | null } = {}) {
  const exportsHolder: { exports?: Script } = {};
  const files = new Map<string, string>();
  if (opts.cache) files.set("/doc/atlas-widget-cache.json", opts.cache);
  const requests: { url: string; headers?: Record<string, string> }[] = [];
  const keychain = new Map<string, string>();
  if (opts.token !== null) keychain.set("atlas.widget.token", opts.token ?? "atlas_wgt_secret");
  class Color {
    constructor(public hex: string) {}
    static dynamic(light: Color, dark: Color) {
      return { light, dark };
    }
  }
  class Size {
    constructor(public w: number, public h: number) {}
  }
  class Request {
    headers: Record<string, string> = {};
    response: { statusCode: number } | null = null;
    constructor(public url: string) {}
    async loadString() {
      requests.push({ url: this.url, headers: this.headers });
      if (opts.throws) throw new Error("offline");
      this.response = { statusCode: opts.status ?? 200 };
      return opts.body ?? "";
    }
  }
  const globals: Record<string, unknown> = {
    __ATLAS_TEST__: exportsHolder,
    ListWidget: function () {
      return makeNode("widget");
    },
    Color,
    Size,
    Request,
    Font: new Proxy({}, { get: () => (size: number) => ({ size }) }),
    Keychain: {
      contains: (k: string) => keychain.has(k),
      get: (k: string) => keychain.get(k),
      set: (k: string, v: string) => keychain.set(k, v),
    },
    FileManager: {
      local: () => ({
        documentsDirectory: () => "/doc",
        joinPath: (a: string, b: string) => `${a}/${b}`,
        fileExists: (p: string) => files.has(p),
        readString: (p: string) => files.get(p),
        writeString: (p: string, s: string) => void files.set(p, s),
      }),
    },
    Device: { language: () => "nl" },
    config: { runsInApp: false, widgetFamily: "medium" },
    args: { widgetParameter: null },
    Script: { setWidget: () => {}, complete: () => {} },
    Alert: function () {},
  };
  const names = Object.keys(globals);
  new AsyncFunction(...names, SOURCE)(...names.map((n) => globals[n]));
  return { script: exportsHolder.exports as Script, requests, files };
}

const color = { light: "#7c3aed", dark: "#a78bfa" };
const item = (over: Partial<WidgetDay["today"][number]>): WidgetDay["today"][number] => ({
  kind: "event",
  title: "Item",
  timeLabel: null,
  endLabel: null,
  allDay: false,
  slotLabel: null,
  color,
  startsAt: null,
  endsAt: null,
  date: "2026-10-30",
  ...over,
});

const day = (over: Partial<WidgetDay> = {}): WidgetDay => ({
  version: 1,
  scriptVersion: 1,
  generatedAt: "2026-10-30T10:00:00.000Z",
  date: "2026-10-30",
  locale: "nl",
  labels: {
    dateLong: "vrijdag 30 oktober",
    dateShort: "vr 30 okt",
    empty: "Niets meer vandaag",
    tomorrow: "Morgen",
    remaining: "nog 6",
    sectionEvents: "Afspraken",
    sectionMeals: "Maaltijden",
    sectionCards: "Te doen",
    allDay: "Hele dag",
    updatedAt: "Bijgewerkt 11:00",
    updateAvailable: "Nieuwe scriptversie beschikbaar",
  },
  today: [
    item({ title: "Verjaardag", allDay: true, timeLabel: null }),
    item({ title: "Tandarts", timeLabel: "14:00", endLabel: "14:30" }),
    item({ title: "Standup", timeLabel: "15:00", color: null }),
    item({ kind: "meal", title: "Soep", allDay: true, slotLabel: "Avond", color: null }),
    item({ kind: "deadline", title: "Rapport", timeLabel: "17:00" }),
    item({ kind: "card", title: "Boodschappen", allDay: true }),
  ],
  tomorrow: [item({ title: "Fietsen", timeLabel: "09:00", date: "2026-10-31" })],
  refreshAfter: "2099-01-01T00:00:00.000Z",
  ...over,
});

const FAMILIES = ["small", "medium", "large", "extraLarge", "accessoryRectangular", "accessoryInline", "accessoryCircular"];

describe("atlas-widget.js", () => {
  it("keeps the fixture on contract v1", () => {
    expect(widgetDaySchema.safeParse(day()).success).toBe(true);
    expect(widgetDaySchema.safeParse(day({ today: [] })).success).toBe(true);
  });

  it("keeps SCRIPT_VERSION in step with the endpoint", () => {
    expect(load().script.SCRIPT_VERSION).toBe(WIDGET_SCRIPT_VERSION);
  });

  it("never evaluates or imports remote code and does not log", () => {
    expect(SOURCE).not.toMatch(/\beval\s*\(|new Function|importModule|console\./);
  });

  it("builds the tap URL for the Shortcut and for Safari", () => {
    const { script } = load();
    expect(script.tapUrl("2026-10-30")).toBe(
      "shortcuts://run-shortcut?name=Open%20Atlas&input=text&text=" + encodeURIComponent("webapp://heyatlas.nl/agenda?date=2026-10-30"),
    );
    expect(script.tapUrl("2026-10-30", "safari")).toBe("https://heyatlas.nl/agenda?date=2026-10-30");
  });

  it("picks error texts by device language", () => {
    const { script } = load();
    expect(script.errorText("noToken", "nl-NL")).toBe("Open Scriptable om de widget in te stellen");
    expect(script.errorText("tokenRefused", "nl")).toBe("Token ongeldig, maak een nieuwe in Atlas");
    expect(script.errorText("unreachable", "nl")).toBe("Atlas niet bereikbaar");
    expect(script.errorText("unreachable", "en-US")).toBe("Atlas unreachable");
    expect(script.errorText("noToken", "fr")).toBe("Open Scriptable to set up the widget");
  });

  it("selects items per family", () => {
    const { script } = load();
    const d = day();
    expect(script.selectItems(d, "small").items.map((i) => i.title)).toEqual(["Tandarts"]);
    expect(script.selectItems(d, "medium").items.map((i) => i.title)).toEqual(["Verjaardag", "Tandarts", "Standup", "Soep"]);
    const large = script.selectItems(d, "large");
    expect(large.sections?.map((s) => [s.title, s.items.length])).toEqual([["Afspraken", 3], ["Maaltijden", 1], ["Te doen", 2]]);
    expect(script.selectItems(d, "accessoryRectangular").items.map((i) => i.title)).toEqual(["Tandarts"]);
    expect(script.inlineText(d)).toBe("14:00 Tandarts");
  });

  it("shows tomorrow when nothing is left today", () => {
    const { script } = load();
    const d = day({ today: [] });
    const small = script.selectItems(d, "small");
    expect(small.empty).toBe(true);
    expect(small.items.map((i) => i.title)).toEqual(["Fietsen"]);
    expect(script.selectItems(d, "large").sections?.[0].items[0].title).toBe("Fietsen");
    expect(script.inlineText(d)).toBe("Niets meer vandaag");
  });

  it("decides between fresh, cached and message", () => {
    const { script } = load();
    const d = day();
    expect(script.decideOutcome(200, d, null).kind).toBe("fresh");
    expect(script.decideOutcome(401, null, d)).toEqual({ kind: "message", text: "tokenRefused" });
    for (const status of [0, 429, 500, 503]) {
      expect(script.decideOutcome(status, null, d).kind).toBe("cached");
      expect(script.decideOutcome(status, null, null)).toEqual({ kind: "message", text: "unreachable" });
    }
  });

  it.each(FAMILIES)("renders %s without throwing", (family) => {
    const { script } = load();
    for (const d of [day(), day({ today: [] }), day({ scriptVersion: 2 })]) {
      const widget = script.buildWidget(family, { day: d, stale: true, parameter: null }, "nl");
      expect(widget.children.length).toBeGreaterThan(0);
      expect(String(widget.url)).toContain("shortcuts://run-shortcut");
      expect(widget.refreshAfterDate).toBeInstanceOf(Date);
    }
  });

  it("renders messages for states without a day", () => {
    const { script } = load();
    for (const family of FAMILIES) {
      for (const text of ["noToken", "tokenRefused", "unreachable"]) {
        expect(script.buildWidget(family, { day: null, text, parameter: "safari" }, "en").children.length).toBeGreaterThan(0);
      }
    }
  });

  it("fetches with the bearer token, caches a good answer and falls back to it", async () => {
    const good = JSON.stringify(day());
    const online = load({ status: 200, body: good });
    const state = await online.script.loadState(undefined);
    expect(state.stale).toBe(false);
    expect(online.requests[0].url).toMatch(/^https:\/\/heyatlas\.nl\/api\/widget\/today\?tz=/);
    expect(online.requests[0].headers).toEqual({ Authorization: "Bearer atlas_wgt_secret" });
    expect(online.files.get("/doc/atlas-widget-cache.json")).toBe(good);

    const offline = load({ throws: true, cache: good });
    expect((await offline.script.loadState(undefined)).stale).toBe(true);
    const limited = load({ status: 429, body: "{}", cache: good });
    expect((await limited.script.loadState(undefined)).stale).toBe(true);
    const refused = load({ status: 401, body: "{}", cache: good });
    expect((await refused.script.loadState(undefined)).text).toBe("tokenRefused");
    const nothing = load({ status: 503, body: "{}" });
    expect((await nothing.script.loadState(undefined)).text).toBe("unreachable");
    const noToken = load({ token: null });
    expect((await noToken.script.loadState(undefined)).text).toBe("noToken");
    expect(noToken.requests).toHaveLength(0);
  });
});
