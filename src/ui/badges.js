// 배지 진열장 + 학습 통계
import { BADGES } from "../../data/badges.js";
import { CONCEPTS } from "../../data/concepts.js";
import { esc } from "./dom.js";
import { tabBar, bindTabs, statusBar } from "./nav.js";

const ART = {
  first_print: ["teal", ">_"], ch1: ["teal", "1课"], ch2: ["teal", "2课"], ch3: ["teal", "3课"],
  streak7: ["coral", "7天"], streak30: ["coral", "30天"], streak100: ["coral", "100"],
  perfectionist: ["sun", "★"],
  reviewer: ["navy", "30"], collector: ["sun", "3件"], night_owl: ["navy", "☾"],
  advanced1: ["teal", "A+"], advancedAll: ["sun", "A★"],   // v0.7 심화
};
const COL = { teal: ["#1F9E93", "#12756D"], coral: ["#F08A5D", "#C4512F"], navy: ["#3C5170", "#1F2B3D"], sun: ["#FFD43B", "#C99A00"] };

/** 코드로 그린 배지. 얻기 전에는 회색 실루엣 */
export function badgeArt(id, earned, size = 64) {
  const [c, glyph] = ART[id] || ["navy", "?"];
  const [fill, edge] = earned ? COL[c] : ["#E4DCCB", "#C9BEA6"];
  const ink = earned ? (c === "sun" ? "#3A2E00" : "#FFFFFF") : "#9A8F78";
  const fs = glyph.length >= 3 ? 15 : glyph.length === 2 ? 17 : 22;
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" class="badge-art${earned ? "" : " locked"}">
    <path d="M20 40 L14 60 L24 55 L28 62 L32 44 Z M44 40 L50 60 L40 55 L36 62 L32 44 Z" fill="${edge}" opacity="${earned ? 1 : 0.6}"/>
    <path d="M32 3 L39 7.5 L47.5 7.5 L51 15 L57.5 20.5 L55.5 29 L58 37 L51.5 42.5 L48.5 50.5 L40 50.5 L32 55 L24 50.5 L15.5 50.5 L12.5 42.5 L6 37 L8.5 29 L6.5 20.5 L13 15 L16.5 7.5 L25 7.5 Z" fill="${fill}" stroke="${edge}" stroke-width="2.5" stroke-linejoin="round" ${earned ? "" : 'stroke-dasharray="4 3"'}/>
    <circle cx="32" cy="29" r="17" fill="none" stroke="${earned ? "rgba(255,255,255,.55)" : "#D3C8B0"}" stroke-width="1.5"/>
    <text x="32" y="${29 + fs * 0.36}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-weight="700" font-size="${fs}" fill="${ink}">${esc(glyph)}</text>
  </svg>`;
}

export function render(root, ctx) {
  const s = ctx.save;
  const have = new Set(s.badges || []);
  const st = s.stats || {};
  const weak = Object.entries(s.weak_concepts || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const n = (v) => Math.max(0, Number(v) || 0);
  // 본 과정과 심화(v0.7)는 따로 센다
  const doneSet = new Set(s.completed_lessons || []);
  const mainDone = ctx.lessons.filter((l) => doneSet.has(l.id)).length;
  const advIds = ctx.advancedIds ? ctx.advancedIds() : [];
  const advTotal = advIds.length;
  const advDone = advIds.filter((id) => doneSet.has(id)).length;
  root.innerHTML = `<div class="screen badges with-tabs">
    ${statusBar(s)}
    <main>
      <h1 class="page-title">徽章 <small>${have.size}/${BADGES.length}</small></h1>
      <ul class="badge-grid">${BADGES.map((b) => {
        const e = have.has(b.id);
        return `<li class="badge${e ? " earned" : ""}">
          ${badgeArt(b.id, e)}
          <span class="b-name">${esc(b.name)}</span>
          <span class="b-desc">${e ? "已获得" : esc(b.desc)}</span>
        </li>`;
      }).join("")}</ul>
      <section class="panel">
        <h2>学习记录</h2>
        <dl class="stat-grid">
          <div><dt>完成的课</dt><dd>${n(mainDone)}<small>/${ctx.lessons.length}</small></dd></div>
          ${advTotal ? `<div><dt>完成的进阶</dt><dd>${n(advDone)}<small>/${advTotal}</small></dd></div>` : ""}
          <div><dt>答对的题</dt><dd>${n(st.items)}</dd></div>
          <div><dt>无失误的课</dt><dd>${n(st.perfect)}</dd></div>
          <div><dt>复习题</dt><dd>${n(st.review_items)}</dd></div>
          <div><dt>最长连续记录</dt><dd>${n(s.streak.best)}<small>天</small></dd></div>
          <div><dt>累计 XP</dt><dd>${n(s.xp)}</dd></div>
        </dl>
        <h3>常错的单词</h3>
        ${weak.length ? `<ol class="weak">${weak.map(([id]) => `<li>${esc((CONCEPTS.find((c) => c.id === id) || { name: id }).name)}</li>`).join("")}</ol>`
          : `<p class="muted">还没有。答错的单词会出现在这里。</p>`}
      </section>
    </main>
    ${tabBar("badges")}
  </div>`;
  bindTabs(root, ctx);
}
