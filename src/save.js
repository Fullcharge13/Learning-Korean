// 저장: localStorage 한 칸에 JSON 하나. 옛 저장은 migrate로 새 형식에 맞춘다.
// 리아와 파이썬과 같은 주소(github.io)에 올라가므로 저장 키를 따로 둔다(리아 저장은 읽지도 지우지도 않음).
import { ITEMS } from "../data/items.js";
import { cleanSeenUpdates } from "./newcontent.js";

export const SAVE_KEY = "haechi-korean.save";
export const SAVE_VER = 2;
const LOG_CAP = 50;
const BROKEN_SLOTS = 5; // .broken 다음 .broken.1 ~ .broken.5
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function newSave() {
  return {
    saveVer: SAVE_VER,
    current_chapter: 1, current_lesson: "1-1",
    completed_lessons: [],
    submission_logs: [],
    grading_results: {},
    weak_concepts: {},
    review_queue: [],
    last_active_at: null,
    xp: 0, bytes: 0,
    streak: { days: 0, best: 0, lastGoalDate: null, todayDate: null, todayXp: 0 },
    freezes: 0,
    quests: { date: null, ids: [], progress: {}, done: [], chest: false },
    badges: [], items: ["none"], item: "none",
    stats: { lessons: 0, perfect: 0, review_items: 0 },
    settings: { sound: true, dailyGoal: 20, name: "" },
    seen_updates: {},  // v0.7.1 「새 내용」 점: { 레슨 id: 끝까지 다시 본 판 "v0.7.1" }. saveVer 그대로, 없으면 {}
  };
}

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

// 위험한 키를 빼고 얕게 복사한다.
function safeCopy(obj) {
  const out = {};
  for (const key of Object.keys(obj)) if (!BAD_KEYS.has(key)) out[key] = obj[key];
  return out;
}

// 기본값의 종류에 맞는 옛 값만 받아들이고, 아니면 기본값을 쓴다.
function coerce(d, v) {
  if (d === null) return v;                                   // null 기본: 무엇이든 받음
  if (Array.isArray(d)) return Array.isArray(v) ? v : d;
  if (typeof d === "number") {
    if (typeof v === "number") return Number.isFinite(v) ? v : d;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    }
    return d;
  }
  if (typeof d === "boolean") return typeof v === "boolean" ? v : d;
  if (typeof d === "string") return typeof v === "string" ? v : d;
  if (isPlainObject(d)) {
    if (!isPlainObject(v)) return d;
    return Object.keys(d).length > 0 ? fill(d, v) : safeCopy(v);
  }
  return v;
}

// 기본값 위에 옛 값을 덮는다. 기본값에 없는 칸은 그대로 남긴다.
function fill(defaults, raw) {
  const out = { ...defaults };
  for (const key of Object.keys(raw)) {
    if (BAD_KEYS.has(key)) continue;
    out[key] = Object.hasOwn(defaults, key) ? coerce(defaults[key], raw[key]) : raw[key];
  }
  return out;
}

const MAX_FREEZES = 2;
const nonNegInt = (v) => Math.max(0, Math.floor(v));

// 값의 범위를 맞춘다(타입은 fill에서 이미 숫자로 맞춰져 있음).
function clampRanges(s) {
  s.freezes = Math.min(MAX_FREEZES, nonNegInt(s.freezes));
  s.xp = nonNegInt(s.xp);
  s.bytes = nonNegInt(s.bytes);
  s.streak.days = nonNegInt(s.streak.days);
  s.streak.best = nonNegInt(s.streak.best);
  for (const k of Object.keys(s.stats)) {
    if (typeof s.stats[k] === "number") s.stats[k] = nonNegInt(s.stats[k]);
  }
  const wc = {};
  for (const [k, v] of Object.entries(s.weak_concepts)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) wc[k] = v;
  }
  s.weak_concepts = wc;
  s.seen_updates = cleanSeenUpdates(s.seen_updates);
  return s;
}

const ITEM_ORDER = ITEMS.map((o) => o.id);

// 가진 물건·둔 물건 정리: 물건 표 순서, 중복 없음, none 항상 포함, 표에 없는 id는 버림. 둔 물건이 가진 것이 아니면 none.
function cleanItems(s) {
  const owned = new Set(["none", ...s.items.filter((x) => typeof x === "string")]);
  s.items = ITEM_ORDER.filter((id) => owned.has(id));
  if (!s.items.includes(s.item)) s.item = "none";
  return s;
}

export function migrate(raw) {
  if (!isPlainObject(raw)) return newSave();
  const oldVer = raw.saveVer;
  const ver = typeof oldVer === "number" && Number.isFinite(oldVer) ? oldVer : 1; // saveVer 없음 = 첫 판(1)
  const s = clampRanges(fill(newSave(), structuredClone(raw)));
  cleanItems(s);
  s.saveVer = ver > SAVE_VER ? ver : SAVE_VER;
  return s;
}

// 깨진 원본을 남긴다. 이미 남긴 것은 덮지 않고 .broken.1 ~ .broken.5 중 빈 칸에 쓴다(모두 차면 .broken.5를 덮음).
function keepBroken(storage, text) {
  const keys = [SAVE_KEY + ".broken"];
  for (let i = 1; i <= BROKEN_SLOTS; i++) keys.push(`${SAVE_KEY}.broken.${i}`);
  try {
    const free = keys.find((k) => storage.getItem(k) === null);
    storage.setItem(free ?? keys[keys.length - 1], text);
  } catch { /* 남기지 못해도 새 저장으로 시작 */ }
}

export function loadEx(storage) {
  let text;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return { save: newSave(), readFailed: true };
  }
  if (text === null || text === undefined) return { save: newSave(), readFailed: false };
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    keepBroken(storage, text);
    return { save: newSave(), readFailed: false };
  }
  if (!isPlainObject(raw)) {
    keepBroken(storage, text);
    return { save: newSave(), readFailed: false };
  }
  return { save: migrate(raw), readFailed: false };
}

/** 가져온 파일이 이 앱의 저장인지: 물건 칸(items·item)이 있고 리아와 파이썬의 의상 칸(outfits)이 없음 */
export function isOwnSave(raw) {
  return isPlainObject(raw) && Array.isArray(raw.items) && typeof raw.item === "string" && !("outfits" in raw);
}

export function load(storage) {
  return loadEx(storage).save;
}

export function store(storage, save) {
  const logs = Array.isArray(save.submission_logs) ? save.submission_logs.slice(-LOG_CAP) : [];
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...save, submission_logs: logs }));
    return true;
  } catch {
    return false;
  }
}
