import { test } from "node:test";
import assert from "node:assert/strict";
import { curriculum, upcomingChapters, pathEndText, UPCOMING } from "../../src/curriculum.js";

const mk = (no, title) => ({
  id: no, title,
  lessons: [1, 2, 3, 4, 5].map((k) => ({ id: `${no}-${k}`, chapter: no, title: `${title} ${k}`, goal: `목표 ${no}-${k}`, isExam: k === 5 })),
});
const CH = [mk(1, "첫 코드"), mk(2, "변수와 표현식"), mk(3, "조건문")];

test("cur_status: 완료·지금·잠김과 개수", () => {
  const c = curriculum({ chapters: CH, completed: ["1-1", "1-2"], currentId: "1-3" });
  assert.equal(c.total, 15);
  assert.equal(c.done, 2);
  assert.deepEqual(c.current, { id: "1-3", title: "첫 코드 3" });
  const st = c.chapters[0].lessons.map((l) => l.status);
  assert.deepEqual(st, ["done", "done", "current", "locked", "locked"]);
  assert.equal(c.chapters[0].done, 2);
  assert.equal(c.chapters[0].total, 5);
  assert.equal(c.chapters[1].lessons[0].status, "locked");
  assert.equal(c.chapters[0].lessons[2].goal, "목표 1-3");
  assert.match(c.chapters[0].topics, /첫 코드 1/);
});

test("cur_unlocked_not_current: 열렸지만 지금이 아닌 레슨은 open", () => {
  const c = curriculum({ chapters: CH, completed: ["1-1"], currentId: null });
  assert.equal(c.chapters[0].lessons[1].status, "open");
  assert.equal(c.current, null);
});

test("cur_upcoming: 1권만이라 예정된 과가 없음", () => {
  assert.equal(UPCOMING.length, 0);
  assert.deepEqual(upcomingChapters(CH), []);
});

test("path_end_text: 남은 레슨이 있을 때와 모두 끝냈을 때", () => {
  assert.equal(pathEndText({ chapters: CH, completed: ["1-1"] }), "第3课是最后一课，一起坚持到底吧");
  const all = CH.flatMap((c) => c.lessons.map((l) => l.id));
  assert.equal(pathEndText({ chapters: CH, completed: all }), "全部课程都学完了！用复习巩固一下吧");
});

import { chapterWindow } from "../../src/curriculum.js";
const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

test("window_middle: 지금 장과 앞뒤 하나씩", () => {
  assert.deepEqual(chapterWindow({ chapterIds: IDS, currentChapter: 5 }), { shown: [4, 5, 6], hidden: [1, 2, 3, 7, 8, 9, 10] });
});

test("window_start_end: 처음이면 1~3, 마지막이면 끝 셋", () => {
  assert.deepEqual(chapterWindow({ chapterIds: IDS, currentChapter: 1 }).shown, [1, 2, 3]);
  assert.deepEqual(chapterWindow({ chapterIds: IDS, currentChapter: 10 }).shown, [8, 9, 10]);
});

test("window_all_done: 지금 장이 없으면(모두 끝냄) 끝 셋", () => {
  const w = chapterWindow({ chapterIds: IDS, currentChapter: null });
  assert.deepEqual(w.shown, [8, 9, 10]);
  assert.equal(w.hidden.length, 7);
});

test("window_few: 장이 3개 이하면 모두 보이고 숨김 없음", () => {
  assert.deepEqual(chapterWindow({ chapterIds: [1, 2], currentChapter: 2 }), { shown: [1, 2], hidden: [] });
  assert.deepEqual(chapterWindow({ chapterIds: [1, 2, 3], currentChapter: 1 }), { shown: [1, 2, 3], hidden: [] });
  assert.deepEqual(chapterWindow({ chapterIds: [], currentChapter: null }), { shown: [], hidden: [] });
});

import { courseJustFinished } from "../../src/curriculum.js";
const FULL = Array.from({ length: 17 }, (_, i) => mk(i + 1, `장${i + 1}`));
const FULL_IDS = FULL.flatMap((c) => c.lessons.map((l) => l.id));

test("course_end_path: 17장 전부 끝내면 과정 완주 문구(다음 업데이트 말 없음)", () => {
  assert.equal(pathEndText({ chapters: FULL, completed: FULL_IDS }), "全部课程都学完了！用复习巩固一下吧");
  assert.equal(pathEndText({ chapters: FULL, completed: [] }), "第17课是最后一课，一起坚持到底吧");
});

test("course_just_finished: 처음으로 마지막 레슨까지 끝낸 순간만 참", () => {
  assert.equal(courseJustFinished({ chapters: FULL, completed: FULL_IDS, firstTime: true }), true);
  assert.equal(courseJustFinished({ chapters: FULL, completed: FULL_IDS, firstTime: false }), false); // 다시 하기·복습
  assert.equal(courseJustFinished({ chapters: FULL, completed: FULL_IDS.slice(1), firstTime: true }), false); // 빠진 레슨
  assert.equal(courseJustFinished({ chapters: CH, completed: CH.flatMap((c) => c.lessons.map((l) => l.id)), firstTime: true }), true); // 예정된 다음 과 없음
});
