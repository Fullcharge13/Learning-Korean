// 레슨 완료: 얻은 XP·바이트, 정확도, 연속 기록, 요약 3줄, 퀘스트·배지·이정표
import { QUESTS } from "../../data/quests.js";
import { BADGES } from "../../data/badges.js";
import { haechiImg } from "../haechi.js";
import { esc, icon, celebrate, MILESTONE_REWARD } from "./dom.js";
import { badgeArt } from "./badges.js";
import { courseJustFinished } from "../curriculum.js";
import { isAdvancedLesson } from "../advanced.js";

export function render(root, ctx, params = {}) {
  const r = params.result;
  if (!r) { ctx.show("home"); return; }
  const lesson = params.lesson;
  const review = r.mode === "review";
  const adv = !review && isAdvancedLesson(lesson);
  const finished = !review && courseJustFinished({ chapters: ctx.chapters, completed: ctx.save.completed_lessons, firstTime: r.firstTime, lessonId: r.lessonId });
  const line = ctx.say(finished ? "course_done" : "lesson_done", { xp: r.xp });
  const streakLine = r.streakUp || r.milestone ? ctx.say("streak_up", { streak: r.streak }) : null;
  const bytes = r.totalBytes ?? (r.lessonBytes + r.questBytes + (r.milestoneBytes || 0));
  const parts = [["课程", r.lessonBytes], ["任务", r.questBytes], ["连续记录", r.milestoneBytes || 0]].filter(([, v]) => v > 0);
  const acc = Math.round((r.accuracy ?? 1) * 100);
  const quests = r.finished.map((id) => QUESTS.find((q) => q.id === id)).filter(Boolean);
  const badges = r.newBadges.map((id) => BADGES.find((b) => b.id === id)).filter(Boolean);

  root.innerHTML = `<div class="screen done">
    <main>
      <div class="done-hero">
        <div class="ria-wrap big jump">${haechiImg({ face: "done", item: ctx.save.item, size: 150 })}<span class="sfx" aria-hidden="true">锵！</span></div>
        <h1>${review ? "复习完成！" : finished ? "全部完成！" : adv ? esc(`${lesson.id} 进阶完成！`) : esc(`${lesson.id} 完成！`)}</h1>
        <p class="bubble center">${esc(line.text)}</p>
      </div>
      ${r.milestone ? `<p class="milestone">${icon("flame")}<span>${esc(`连续 ${r.milestone} 天！${MILESTONE_REWARD[r.milestone] || ""}`)}</span></p>` : ""}
      <ul class="tiles" aria-label="获得的奖励">
        <li class="tile xp">${icon("xp")}<b>+${r.xp}</b><span>XP</span></li>
        <li class="tile byte">${icon("byte")}<b>+${bytes}</b><span>字节</span></li>
        <li class="tile acc">${icon("check")}<b>${acc}%</b><span>首次答对</span></li>
        <li class="tile flame${r.streakUp ? " lit" : ""}">${icon("flame")}<b>${r.streak}</b><span>天连续</span></li>
      </ul>
      ${parts.length > 1 ? `<p class="muted center">字节：${parts.map(([k, v]) => `${k} ${v}`).join(" + ")}</p>` : ""}
      ${!r.firstTime && !review ? `<p class="muted center">重做没有课程字节，但 XP 和今日任务照样计算。</p>` : ""}
      ${r.firstTime && r.perfect ? `<p class="perk">${icon("star")}无失误完成（+5 XP，+5 字节）</p>` : ""}
      ${streakLine ? `<div class="ria-row small"><div class="ria-wrap">${haechiImg({ face: streakLine.face, size: 56 })}</div><p class="bubble">${esc(streakLine.text)}</p></div>` : ""}
      ${lesson && lesson.summary && lesson.summary.length ? `<section class="panel summary"><h2>今天学到的</h2><ol>${lesson.summary.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>` : ""}
      ${quests.length || r.chest ? `<section class="panel"><h2>完成的任务</h2><ul class="plain">${quests.map((q) => `<li>${icon("check")}${esc(q.name)} <b class="sun-text">+${q.reward}</b></li>`).join("")}
        ${r.chest ? `<li>${icon("chestOpen")}打开了宝箱 <b class="sun-text">+10</b></li>` : ""}</ul></section>` : ""}
      ${badges.length ? `<section class="panel"><h2>新徽章</h2><ul class="new-badges">${badges.map((b) => `<li>${badgeArt(b.id, true, 56)}<span>${esc(b.name)}</span></li>`).join("")}</ul></section>` : ""}
    </main>
    <footer class="lesson-foot"><button class="btn primary wide" id="home">继续</button></footer>
  </div>`;
  root.querySelector("#home").addEventListener("click", () => ctx.show("home"));
  (async () => {
    if (r.milestone) {
      ctx.sound.play("levelup");
      await celebrate({ item: ctx.save.item, milestone: r.milestone });
    }
    await ctx.afterDone(); // 첫 레슨이면 「홈 화면에 추가」 안내(아이폰 사파리만)
    root.querySelector("#home")?.focus({ preventScroll: true });
  })();
}
