// Atlas day widget for Scriptable (ADR-0047). Copy this file into Scriptable; it never loads remote code.
// First run in the app asks for the widget token and stores it in the Keychain.

const SCRIPT_VERSION = 1;
const BASE_URL = "https://heyatlas.nl";
const KEYCHAIN_KEY = "atlas.widget.token";
const CACHE_FILE = "atlas-widget-cache.json";
const TIMEOUT_SECONDS = 10;
const RETRY_MINUTES = 15;
const NEUTRAL = { light: "#8e8e93", dark: "#8e8e93" };

// The only copy in this script: states where the endpoint cannot answer, plus the in-app setup menu.
const TEXT = {
  nl: {
    noToken: "Open Scriptable om de widget in te stellen",
    tokenRefused: "Token ongeldig, maak een nieuwe in Atlas",
    unreachable: "Atlas niet bereikbaar",
    tokenTitle: "Widget-token",
    tokenMessage: "Plak de token uit Atlas (Instellingen).",
    tokenField: "atlas_wgt_...",
    save: "Opslaan",
    cancel: "Annuleer",
    replaceToken: "Token vervangen",
    previewSmall: "Voorbeeld klein",
    previewMedium: "Voorbeeld middel",
    previewLarge: "Voorbeeld groot",
  },
  en: {
    noToken: "Open Scriptable to set up the widget",
    tokenRefused: "Token invalid, create a new one in Atlas",
    unreachable: "Atlas unreachable",
    tokenTitle: "Widget token",
    tokenMessage: "Paste the token from Atlas (Settings).",
    tokenField: "atlas_wgt_...",
    save: "Save",
    cancel: "Cancel",
    replaceToken: "Replace token",
    previewSmall: "Preview small",
    previewMedium: "Preview medium",
    previewLarge: "Preview large",
  },
};

// ---- Pure helpers (exported for tests) ----

function pickLanguage(language) {
  return String(language || "").toLowerCase().indexOf("nl") === 0 ? "nl" : "en";
}

function errorText(kind, language) {
  return TEXT[pickLanguage(language)][kind];
}

function tapUrl(date, parameter) {
  if (parameter === "safari") return BASE_URL + "/agenda?date=" + date;
  const target = "webapp://heyatlas.nl/agenda?date=" + date;
  return "shortcuts://run-shortcut?name=Open%20Atlas&input=text&text=" + encodeURIComponent(target);
}

function itemTime(item, labels) {
  if (item.timeLabel && !item.allDay) return item.timeLabel;
  if (item.slotLabel) return item.slotLabel;
  return item.allDay ? labels.allDay : "";
}

function nextItem(items) {
  for (let i = 0; i < items.length; i++) {
    if (!items[i].allDay && items[i].timeLabel) return items[i];
  }
  return items[0] || null;
}

function inlineText(day) {
  const item = nextItem(day.today);
  if (!item) return day.labels.empty;
  const time = itemTime(item, day.labels);
  return time ? time + " " + item.title : item.title;
}

function sections(items, labels) {
  const groups = [
    { title: labels.sectionEvents, items: items.filter((i) => i.kind === "event") },
    { title: labels.sectionMeals, items: items.filter((i) => i.kind === "meal") },
    { title: labels.sectionCards, items: items.filter((i) => i.kind === "card" || i.kind === "deadline") },
  ];
  return groups.filter((g) => g.items.length > 0);
}

// What each family draws, as plain data. `empty` means nothing is left today and the items are tomorrow's.
function selectItems(day, family) {
  const today = day.today;
  const empty = today.length === 0;
  const base = { empty: empty, remaining: day.labels.remaining, count: today.length, items: [] };
  switch (family) {
    case "small":
    case "accessoryRectangular": {
      const first = empty ? day.tomorrow[0] : nextItem(today);
      return Object.assign(base, { items: first ? [first] : [] });
    }
    case "accessoryInline":
    case "accessoryCircular":
      return base;
    case "large":
    case "extraLarge": {
      let left = family === "large" ? 9 : 14;
      const capped = [];
      sections(empty ? day.tomorrow : today, day.labels).forEach((g) => {
        if (left <= 0) return;
        const take = g.items.slice(0, left);
        left -= take.length;
        capped.push({ title: g.title, items: take });
      });
      return Object.assign(base, { sections: capped });
    }
    default:
      return Object.assign(base, { items: (empty ? day.tomorrow : today).slice(0, 4) });
  }
}

// What to do with an answer from the endpoint: show it, show the cache, or show a message.
function decideOutcome(status, day, cached) {
  if (status === 200 && day) return { kind: "fresh", day: day };
  if (status === 401) return { kind: "message", text: "tokenRefused" };
  if (cached) return { kind: "cached", day: cached };
  return { kind: "message", text: "unreachable" };
}

function refreshDate(day, now) {
  const target = day ? new Date(day.refreshAfter) : null;
  if (target && !isNaN(target.getTime()) && target.getTime() > now.getTime()) return target;
  return new Date(now.getTime() + RETRY_MINUTES * 60000);
}

function todayString(now) {
  const pad = (n) => (n < 10 ? "0" + n : String(n));
  return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
}

// ---- Drawing ----

function neutralColor() {
  return Color.dynamic(new Color(NEUTRAL.light), new Color(NEUTRAL.dark));
}

function itemColor(item) {
  const c = item.color || NEUTRAL;
  return Color.dynamic(new Color(c.light), new Color(c.dark));
}

function addLine(parent, text, size, weight, secondary, lines) {
  const t = parent.addText(text);
  t.font = weight === "semibold" ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  if (secondary) t.textColor = neutralColor();
  t.lineLimit = lines;
  t.minimumScaleFactor = 0.8;
  return t;
}

function addItemRow(parent, item, labels, size) {
  const row = parent.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  const bar = row.addStack();
  bar.size = new Size(3, size * 2.4);
  bar.cornerRadius = 1.5;
  bar.backgroundColor = itemColor(item);
  row.addSpacer(6);
  const text = row.addStack();
  text.layoutVertically();
  const time = itemTime(item, labels);
  if (time) addLine(text, time, size - 2, "regular", true, 1);
  addLine(text, item.title, size, "semibold", false, 1);
  row.addSpacer();
  return row;
}

function addFooter(widget, day, stale) {
  const notes = [];
  if (stale) notes.push(day.labels.updatedAt);
  if (day.scriptVersion > SCRIPT_VERSION) notes.push(day.labels.updateAvailable);
  if (notes.length === 0) return;
  widget.addSpacer(4);
  addLine(widget, notes.join(" · "), 9, "regular", true, 1);
}

function addMessage(widget, text) {
  widget.addSpacer();
  addLine(widget, text, 13, "semibold", false, 4);
  widget.addSpacer();
}

function addEmptyHeader(widget, selection, day, size) {
  if (!selection.empty) return;
  addLine(widget, day.labels.empty, size, "semibold", false, 2);
  widget.addSpacer(4);
  addLine(widget, day.labels.tomorrow, size - 2, "regular", true, 1);
  widget.addSpacer(4);
}

function addList(widget, selection, day, size, gap) {
  addEmptyHeader(widget, selection, day, size);
  selection.items.forEach((item, index) => {
    if (index > 0) widget.addSpacer(gap);
    addItemRow(widget, item, day.labels, size);
  });
}

function addRemaining(widget, selection) {
  widget.addSpacer();
  if (!selection.empty) addLine(widget, selection.remaining, 11, "regular", true, 1);
}

function buildSmall(widget, day, stale) {
  const selection = selectItems(day, "small");
  addLine(widget, day.labels.dateShort, 12, "semibold", true, 1);
  widget.addSpacer(6);
  addList(widget, selection, day, 14, 0);
  addRemaining(widget, selection);
  addFooter(widget, day, stale);
}

function buildMedium(widget, day, stale) {
  const selection = selectItems(day, "medium");
  addLine(widget, day.labels.dateLong, 13, "semibold", true, 1);
  widget.addSpacer(6);
  addList(widget, selection, day, 13, 5);
  addRemaining(widget, selection);
  addFooter(widget, day, stale);
}

function buildLarge(widget, day, stale, family) {
  const selection = selectItems(day, family);
  addLine(widget, day.labels.dateLong, 14, "semibold", true, 1);
  widget.addSpacer(8);
  addEmptyHeader(widget, selection, day, 14);
  selection.sections.forEach((group) => {
    widget.addSpacer(8);
    addLine(widget, group.title, 11, "semibold", true, 1);
    widget.addSpacer(3);
    group.items.forEach((item, index) => {
      if (index > 0) widget.addSpacer(4);
      addItemRow(widget, item, day.labels, 13);
    });
  });
  addRemaining(widget, selection);
  addFooter(widget, day, stale);
}

function buildRectangular(widget, day) {
  const selection = selectItems(day, "accessoryRectangular");
  const item = selection.items[0];
  if (selection.empty) {
    addLine(widget, day.labels.empty, 13, "semibold", false, 2);
    if (item) addLine(widget, itemTime(item, day.labels) + " " + item.title, 11, "regular", true, 1);
    return;
  }
  if (item) {
    addLine(widget, itemTime(item, day.labels), 11, "regular", true, 1);
    addLine(widget, item.title, 13, "semibold", false, 1);
  }
  addLine(widget, selection.remaining, 11, "regular", true, 1);
}

function buildInline(widget, day) {
  widget.addText(inlineText(day)).lineLimit = 1;
}

function buildCircular(widget, day) {
  widget.addAccessoryWidgetBackground = true;
  widget.addSpacer();
  const t = widget.addText(String(day.today.length));
  t.font = Font.boldSystemFont(24);
  t.centerAlignText();
  widget.addSpacer();
}

function buildWidget(family, state, language) {
  const widget = new ListWidget();
  const now = new Date();
  const accessory = String(family).indexOf("accessory") === 0;
  if (!accessory) widget.setPadding(12, 14, 12, 14);
  const day = state.day;
  if (!day) {
    const text = errorText(state.text, language);
    if (accessory) widget.addText(text).lineLimit = 3;
    else addMessage(widget, text);
    widget.url = tapUrl(todayString(now), state.parameter);
    widget.refreshAfterDate = refreshDate(null, now);
    return widget;
  }
  switch (family) {
    case "small":
      buildSmall(widget, day, state.stale);
      break;
    case "large":
    case "extraLarge":
      buildLarge(widget, day, state.stale, family);
      break;
    case "accessoryRectangular":
      buildRectangular(widget, day);
      break;
    case "accessoryInline":
      buildInline(widget, day);
      break;
    case "accessoryCircular":
      buildCircular(widget, day);
      break;
    default:
      buildMedium(widget, day, state.stale);
  }
  widget.url = tapUrl(day.date, state.parameter);
  widget.refreshAfterDate = state.stale ? refreshDate(null, now) : refreshDate(day, now);
  return widget;
}

// ---- Token, network and cache ----

function readToken() {
  return Keychain.contains(KEYCHAIN_KEY) ? Keychain.get(KEYCHAIN_KEY) : null;
}

async function askToken(language) {
  const t = TEXT[pickLanguage(language)];
  const alert = new Alert();
  alert.title = t.tokenTitle;
  alert.message = t.tokenMessage;
  alert.addSecureTextField(t.tokenField, "");
  alert.addAction(t.save);
  alert.addCancelAction(t.cancel);
  const pressed = await alert.presentAlert();
  if (pressed === -1) return false;
  const value = alert.textFieldValue(0).trim();
  if (!value) return false;
  Keychain.set(KEYCHAIN_KEY, value);
  return true;
}

function cachePath() {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), CACHE_FILE);
}

function readCache() {
  try {
    const fm = FileManager.local();
    const path = cachePath();
    return fm.fileExists(path) ? JSON.parse(fm.readString(path)) : null;
  } catch {
    return null;
  }
}

function writeCache(day) {
  try {
    FileManager.local().writeString(cachePath(), JSON.stringify(day));
  } catch {
    // A missing cache only costs the offline view.
  }
}

async function fetchDay(token) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const request = new Request(BASE_URL + "/api/widget/today?tz=" + encodeURIComponent(zone));
  request.timeoutInterval = TIMEOUT_SECONDS;
  request.headers = { Authorization: "Bearer " + token };
  try {
    const body = await request.loadString();
    const status = request.response ? request.response.statusCode : 0;
    let day = null;
    if (status === 200) {
      try {
        day = JSON.parse(body);
      } catch {
        day = null;
      }
    }
    return { status: status, day: day };
  } catch {
    return { status: 0, day: null };
  }
}

async function loadState(parameter) {
  const token = readToken();
  if (!token) return { day: null, text: "noToken", parameter: parameter };
  const answer = await fetchDay(token);
  const outcome = decideOutcome(answer.status, answer.day, readCache());
  if (outcome.kind === "fresh") writeCache(outcome.day);
  if (outcome.kind === "message") return { day: null, text: outcome.text, parameter: parameter };
  return { day: outcome.day, stale: outcome.kind === "cached", parameter: parameter };
}

// ---- Entry ----

async function main() {
  const language = Device.language();
  const parameter = args.widgetParameter;
  if (!config.runsInApp) {
    const state = await loadState(parameter);
    Script.setWidget(buildWidget(config.widgetFamily || "medium", state, language));
    return;
  }
  const t = TEXT[pickLanguage(language)];
  if (!readToken()) await askToken(language);
  const menu = new Alert();
  menu.addAction(t.replaceToken);
  menu.addAction(t.previewSmall);
  menu.addAction(t.previewMedium);
  menu.addAction(t.previewLarge);
  menu.addCancelAction(t.cancel);
  const choice = await menu.presentSheet();
  if (choice === 0) {
    await askToken(language);
  } else if (choice > 0) {
    const state = await loadState(parameter);
    const preview = buildWidget(["small", "medium", "large"][choice - 1], state, language);
    if (choice === 1) await preview.presentSmall();
    else if (choice === 2) await preview.presentMedium();
    else await preview.presentLarge();
  }
}

if (typeof __ATLAS_TEST__ !== "undefined") {
  __ATLAS_TEST__.exports = { SCRIPT_VERSION, pickLanguage, errorText, tapUrl, selectItems, inlineText, nextItem, decideOutcome, refreshDate, buildWidget, loadState };
} else {
  await main();
  Script.complete();
}
