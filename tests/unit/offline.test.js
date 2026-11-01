import { test } from "node:test";
import assert from "node:assert/strict";
import { offlineStatus, GAME_CACHE_PREFIX } from "../../src/offline.js";

const ORIGIN = "https://x.test/app/";
const CH = ["lessons/ch1-11111111.json", "lessons/ch2-22222222.json"];
const GAME = GAME_CACHE_PREFIX + "v0.1-a";

test("offline_prefix: 리아 앱과 같은 주소에서 저장본이 섞이지 않게 haechi- 접두", () => {
  assert.equal(GAME_CACHE_PREFIX, "haechi-game-");
});

test("offline_ready: 작업자가 다루고 게임 저장본에 장 파일이 모두 있으면 준비", () => {
  const r = offlineStatus({ controlled: true, cacheNames: [GAME], chapterFiles: CH, urlsByCache: { [GAME]: CH.map((c) => ORIGIN + c) } });
  assert.equal(r.ready, true);
  assert.deepEqual(r.missing, []);
  assert.equal(r.reason, "ok");
});

test("offline_no_controller: 서비스 작업자가 없으면 준비 안 됨", () => {
  const r = offlineStatus({ controlled: false, cacheNames: [GAME], urlsByCache: { [GAME]: [] } });
  assert.equal(r.reason, "no-controller");
});

test("offline_no_game_cache: 게임 저장본이 없으면 준비 안 됨(리아 저장본은 세지 않음)", () => {
  assert.equal(offlineStatus({ controlled: true, cacheNames: null, urlsByCache: null }).ready, false);
  const r = offlineStatus({ controlled: true, cacheNames: ["ria-game-v0.7-x"], chapterFiles: [], urlsByCache: { "ria-game-v0.7-x": [] } });
  assert.equal(r.ready, false);
  assert.equal(r.reason, "no-caches");
});

test("offline_chapters_needed: 장 파일 하나가 없으면 missing-chapters", () => {
  const r = offlineStatus({ controlled: true, cacheNames: [GAME], chapterFiles: CH, urlsByCache: { [GAME]: [ORIGIN + CH[0]] } });
  assert.deepEqual(r.missing, [CH[1]]);
  assert.equal(r.reason, "missing-chapters");
  const near = offlineStatus({ controlled: true, cacheNames: [GAME], chapterFiles: [CH[0]], urlsByCache: { [GAME]: [ORIGIN + "lessons/xch1-11111111.json"] } });
  assert.equal(near.ready, false);
});
