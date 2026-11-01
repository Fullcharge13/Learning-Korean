import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const HANGUL = /[가-힣]/;
// 번체로만 쓰이는 흔한 글자(간체 화면에 나오면 안 됨)
const TRAD = /[國們學習課說語這個為會來時開關東長門見對]/;

// 주석을 지운 코드(문자열 속 //는 드물어서 줄 시작·공백 뒤의 //만 주석으로 봄)
function code(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

const FILES = [
  ...readdirSync(new URL("src/", root)).filter((f) => f.endsWith(".js")).map((f) => "src/" + f),
  ...readdirSync(new URL("src/ui/", root)).filter((f) => f.endsWith(".js")).map((f) => "src/ui/" + f),
  "src/index.html", "manifest.webmanifest", "data/lines.js", "data/quests.js", "data/badges.js",
];

test("screen text has no Korean except Korean words being taught", () => {
  const bad = [];
  for (const f of FILES) {
    code(read(f)).split("\n").forEach((line, i) => { if (HANGUL.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`); });
  }
  assert.deepEqual(bad, []);
});

test("screen text uses simplified characters", () => {
  const bad = [];
  for (const f of FILES) {
    code(read(f)).split("\n").forEach((line, i) => { if (TRAD.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`); });
  }
  assert.deepEqual(bad, []);
});

test("page language is zh-Hans", () => {
  assert.match(read("src/index.html"), /<html lang="zh-Hans"/);
});
