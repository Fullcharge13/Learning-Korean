import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SRC = readFileSync(new URL("../../src/lang.js", import.meta.url), "utf8");

// src/lang.js를 가짜 브라우저에서 실행한다. replace에 넘긴 주소를 모은다.
function run({ lang = "zh-Hans", languages = [], saved = null, meta = true, storageThrows = false, path } = {}) {
  const store = { "haechi-korean.lang": saved };
  const localStorage = {
    getItem(k) { if (storageThrows) throw new Error("blocked"); return store[k] ?? null; },
    setItem(k, v) { if (storageThrows) throw new Error("blocked"); store[k] = v; },
  };
  const replaced = [];
  const pathname = path || (/^zh-hant/i.test(lang) ? "/Learning-Korean/zh-hant/" : "/Learning-Korean/");
  const location = { replace: (u) => replaced.push(u), href: "", pathname };
  const document = { documentElement: { lang }, querySelector: (s) => (meta && s.includes("ria-version") ? {} : null) };
  const window = { navigator: { languages }, document, location };
  const box = { window, document, location, navigator: window.navigator };
  Object.defineProperty(box, "localStorage", { get() { if (storageThrows) throw new Error("denied"); return localStorage; } });
  window.localStorage = localStorage;
  vm.runInNewContext(SRC, box);
  return { api: window.haechiLang, replaced, store, location };
}

test("traditional phone languages pick hant", () => {
  const { api } = run({ meta: false });
  for (const l of [["zh-TW"], ["zh-HK", "en"], ["zh-Hant-TW"], ["ZH-tw"], ["en-US", "zh-TW"], ["zh-MO"]]) {
    assert.equal(api.pickLang({ saved: null, languages: l }), "hant", l.join());
  }
  for (const l of [["zh-CN"], ["zh-CN", "zh-TW"], ["ko-KR"], [], undefined]) {
    assert.equal(api.pickLang({ saved: null, languages: l }), "hans", String(l));
  }
});

test("saved choice wins, odd values are ignored", () => {
  const { api } = run({ meta: false });
  assert.equal(api.pickLang({ saved: "hans", languages: ["zh-TW"] }), "hans");
  assert.equal(api.pickLang({ saved: "hant", languages: ["zh-CN"] }), "hant");
  assert.equal(api.pickLang({ saved: "xx", languages: ["zh-TW"] }), "hant");
});

test("does nothing without ria-version meta", () => {
  assert.deepEqual(run({ meta: false, languages: ["zh-TW"] }).replaced, []);
});

test("goes to the other edition when it does not match", () => {
  assert.deepEqual(run({ languages: ["zh-TW"] }).replaced, ["/Learning-Korean/zh-hant/"]);
  assert.deepEqual(run({ lang: "zh-Hant", saved: "hans", languages: ["zh-TW"] }).replaced, ["/Learning-Korean/"]);
  assert.deepEqual(run({ languages: ["zh-TW"], path: "/Learning-Korean/index.html" }).replaced, ["/Learning-Korean/zh-hant/"]);
  assert.deepEqual(run({ lang: "zh-Hant", saved: "hans", path: "/Learning-Korean/zh-hant/index.html" }).replaced, ["/Learning-Korean/"]);
  assert.deepEqual(run({ lang: "zh-Hant", languages: ["zh-TW"] }).replaced, []);
  assert.deepEqual(run({ languages: ["zh-CN"] }).replaced, []);
});

test("currentLang reads <html lang>", () => {
  const { api } = run({ meta: false });
  assert.equal(api.currentLang({ documentElement: { lang: "zh-Hant" } }), "hant");
  assert.equal(api.currentLang({ documentElement: { lang: "zh-CN" } }), "hans");
});

test("switchLang remembers and moves", () => {
  const r = run({ meta: false });
  r.api.switchLang("hant");
  assert.equal(r.store["haechi-korean.lang"], "hant");
  assert.equal(r.location.href, "/Learning-Korean/zh-hant/");
  const t = run({ meta: false, lang: "zh-Hant" });
  t.api.switchLang("hans");
  assert.equal(t.location.href, "/Learning-Korean/");
});

test("storage that throws still picks from phone language", () => {
  const r = run({ storageThrows: true, languages: ["zh-TW"] });
  assert.deepEqual(r.replaced, ["/Learning-Korean/zh-hant/"]);
  assert.doesNotThrow(() => r.api.switchLang("hans"));
});

test("file never spells the simplified tag (build swaps it in the hant edition)", () => {
  assert.ok(!SRC.includes("zh-Hans"));
});

test("no redirect when the address is already the wanted edition (a wrong cached page was served)", () => {
  // 간체 서비스 작업자가 /zh-hant/ 주소에 간체 index.html을 줬을 때: 다시 넘어가면 /zh-hant/zh-hant/… 고리
  assert.deepEqual(run({ lang: "zh-Hans", saved: "hant", path: "/Learning-Korean/zh-hant/" }).replaced, []);
  assert.deepEqual(run({ lang: "zh-Hant", saved: "hans", path: "/Learning-Korean/" }).replaced, []);
});
