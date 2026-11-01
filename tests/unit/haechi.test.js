import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { FACE_IDS, haechiImg } from "../../src/haechi.js";

const root = new URL("../../", import.meta.url);

test("every face has its picture file", () => {
  assert.deepEqual(FACE_IDS, ["smile", "joy", "sparkle", "think", "surprise", "worry", "cheer", "wink", "hello", "done", "sleepy"]);
  for (const id of FACE_IDS) assert.ok(existsSync(new URL(`src/img/haechi/${id}.png`, root)), id);
});

test("face picks its picture, unknown face falls back to smile", () => {
  assert.ok(haechiImg({ face: "joy" }).includes("img/haechi/joy.png"));
  assert.ok(haechiImg({ face: "angry" }).includes("img/haechi/smile.png"));
  assert.ok(haechiImg().includes("img/haechi/smile.png"));
  assert.ok(haechiImg({ face: "joy" }).includes('alt="獬豸老师"'));
});

test("item is drawn beside haechi; none or a bad id draws nothing", () => {
  assert.ok(haechiImg({ item: "janggu" }).includes("img/items/janggu.png"));
  assert.ok(!haechiImg({ item: "none" }).includes("img/items/"));
  assert.ok(!haechiImg({ item: '"><script>' }).includes("<script>"));
});

test("same input, same output; size sets width", () => {
  assert.equal(haechiImg({ face: "wink", size: 64 }), haechiImg({ face: "wink", size: 64 }));
  assert.ok(haechiImg({ size: 64 }).includes('width="64"'));
});
