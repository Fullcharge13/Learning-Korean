// 설정: 소리, 하루 목표, 이름, 저장 내보내기·가져오기, 판 번호
import { DAILY_GOALS } from "../rules.js";
import { esc, toast, dialog, celebrate, icon } from "./dom.js";
import { collectOfflineStatus } from "../offline.js";
import { curriculum, chapterWindow } from "../curriculum.js";
import { applyGoalChange } from "../finish.js";
import { isOwnSave } from "../save.js";
import { tabBar, bindTabs, statusBar } from "./nav.js";
import { localDate } from "../today.js";

/** 이름: 앞뒤 빈칸을 빼고 8자까지 */
export function cleanName(v) {
  let s = String(v || "").trim();
  return Array.from(s).slice(0, 8).join("");
}

const ST = {
  done: ["check", "已完成"], current: ["play", "现在"], open: ["play", "已开放"], locked: ["lock", "未开放"],
};

/** 학습 내용 카드 (C33): 요약 한 줄, 장마다 펼치기, 다음 업데이트 예정 */
function courseCard(ctx) {
  const c = curriculum({ chapters: ctx.chapters, completed: ctx.save.completed_lessons, currentId: ctx.currentLessonId(),
    seenUpdates: ctx.save.seen_updates });
  const dot = (l) => (l.isNew ? '<span class="new-dot inline" role="img" aria-label="有新内容">新</span>' : "");
  const first = c.upcoming.slice(0, 3);
  const rest = c.upcoming.slice(3);
  const upName = (u) => `第${u.no}课 ${u.title}`;
  // 처음엔 지금 장과 앞뒤 셋만(C35). 나머지는 「다른 장 N개 더 보기」로
  const curCh = c.current ? (c.chapters.find((ch) => ch.lessons.some((l) => l.id === c.current.id)) || {}).id : null;
  const win = chapterWindow({ chapterIds: c.chapters.map((ch) => ch.id), currentChapter: curCh ?? null });
  const hiddenSet = new Set(win.hidden);
  return `<section class="panel course" aria-labelledby="course-title">
    <h2 id="course-title">学习内容</h2>
    <p class="course-sum">共 ${c.total} 节课，已完成 <b>${c.done}</b> 节${c.current ? ` · 现在：${esc(c.current.id)} ${esc(c.current.title)}` : ""}${c.advTotal ? `<br><small>进阶（选修）${c.advTotal} 节中完成 ${c.advDone} 节</small>` : ""}</p>
    <ul class="course-chapters" id="course-chapters">${c.chapters.map((ch) => `<li${hiddenSet.has(ch.id) ? ' class="ch-extra" hidden' : ""}>
      <button class="ch-row" aria-expanded="false" aria-controls="ch-${ch.id}">
        <span class="ch-no">${ch.id}</span>
        <span class="ch-main"><b>${esc(ch.title)}</b><small>${esc(ch.topics)}</small></span>
        <span class="ch-side"><span class="ch-count${ch.done === ch.total ? " full" : ""}">${ch.done}/${ch.total} 完成</span>
          ${ch.advTotal ? `<span class="ch-adv${ch.advDone === ch.advTotal ? " full" : ""}">${icon("star")}进阶 ${ch.advDone}/${ch.advTotal}</span>` : ""}</span>
      </button>
      <ol class="ch-lessons" id="ch-${ch.id}" hidden>${ch.lessons.map((l) => `<li class="ls ${l.status}">
        <span class="ls-st">${icon(ST[l.status][0])}<span>${ST[l.status][1]}</span></span>
        <span class="ls-main"><b>${esc(l.id)} ${esc(l.title)}${dot(l)}</b><small>${esc(l.goal)}</small></span>
      </li>`).join("")}
      ${ch.advTotal ? `<li class="ch-adv-head">${icon("star")}进阶 <small>通过测验后开放 · 选修</small></li>${ch.advanced.map((l) => `<li class="ls adv ${l.status}">
        <span class="ls-st">${icon(ST[l.status][0])}<span>${ST[l.status][1]}</span></span>
        <span class="ls-main"><b>${esc(l.id)} ${esc(l.title)}${dot(l)}</b><small>${esc(l.goal)}</small></span>
      </li>`).join("")}` : ""}</ol>
    </li>`).join("")}</ul>
    ${win.hidden.length ? `<button class="btn ghost small wide" id="ch-more" aria-expanded="false" aria-controls="course-chapters" data-n="${win.hidden.length}">再看 ${win.hidden.length} 课</button>` : ""}
    ${c.upcoming.length ? `<p class="muted course-next">下次更新：${esc(first.map(upName).join(" · "))}${rest.length ? `<span id="up-rest" hidden> · ${esc(rest.map(upName).join(" · "))}</span><span id="up-dots"> …</span>` : ""}</p>
      ${rest.length ? `<button class="link" id="up-all" aria-expanded="false" aria-controls="up-rest">全部</button>` : ""}` : ""}
  </section>`;
}

/** 글자판 고르기: 간체판(/)·대만식 번체판(zh-hant/). src/lang.js(머리 스크립트)가 없으면 그리지 않음 */
function langRow() {
  const L = typeof window !== "undefined" && window.haechiLang;
  if (!L) return "";
  const cur = L.currentLang(document);
  return `<div class="row col" role="group" aria-labelledby="lang-label">
          <p class="row-label" id="lang-label">文字<small>简体中文 / 繁體中文（台灣）</small></p>
          <div class="seg two" role="radiogroup" aria-label="文字">${[["hans", "简体"], ["hant", "繁體"]].map(([k, t]) =>
            `<button role="radio" aria-checked="${k === cur}" data-lang="${k}">${t}</button>`).join("")}</div>
        </div>`;
}

export function render(root, ctx) {
  const s = ctx.save;
  const goal = DAILY_GOALS.includes(s.settings.dailyGoal) ? s.settings.dailyGoal : 20;
  root.innerHTML = `<div class="screen settings with-tabs">
    ${statusBar(s)}
    <main>
      <h1 class="page-title">设置</h1>
      ${courseCard(ctx)}
      <section class="panel">
        ${langRow()}
        <div class="row">
          <label for="snd" class="row-label">声音<small>答对、答错的音效</small></label>
          <button class="switch" id="snd" role="switch" aria-checked="${s.settings.sound !== false}"><span></span></button>
        </div>
        <div class="row col" role="group" aria-labelledby="goal-label">
          <p class="row-label" id="goal-label">每日目标<small>每完成一天目标，连续记录加一天</small></p>
          <div class="seg" role="radiogroup" aria-label="每日目标">${DAILY_GOALS.map((g) =>
            `<button role="radio" aria-checked="${g === goal}" data-g="${g}">${g} XP</button>`).join("")}</div>
        </div>
        <div class="row col">
          <label for="name" class="row-label">称呼<small>獬豸老师会这样叫你，也可以不填</small></label>
          <input id="name" type="text" maxlength="9" autocomplete="nickname" autocapitalize="off" value="${esc(s.settings.name || "")}" placeholder="例如：小明">
        </div>
      </section>
      <section class="panel">
        <h2>存档</h2>
        <p class="muted">进度只保存在这个浏览器里。换手机或担心记录丢失时，请导出成文件。</p>
        <div class="btn-row">
          <button class="btn ghost" id="export">导出存档</button>
          <label class="btn ghost" for="import">导入存档</label>
          <input id="import" type="file" accept="application/json,.json" class="sr">
        </div>
        <p class="offline-status wait" id="offline" role="status" aria-live="polite">${icon("review")}<span>正在检查离线准备状态……</span></p>
      </section>
      <section class="panel">
        <h2>添加到主屏幕</h2>
        <p class="muted">在 iPhone、iPad 的 Safari 里添加到主屏幕后，可以像应用一样打开，记录也更安全。</p>
        <button class="btn ghost wide" id="install">如何添加到主屏幕</button>
      </section>
      <p class="ver center">獬豸老师教韩语 ${esc(ctx.version)} · <a class="lic-link" href="licenses.txt" target="_blank" rel="noopener">开源软件</a></p>
      <p class="muted center credit">单词：<a class="lic-link" href="https://github.com/Amulopapa67/open-yonsei-korean-vocabulary" target="_blank" rel="noopener">Open Yonsei Korean Vocabulary</a>（《延世韩国语》第一、二册，CC BY-SA 3.0，部分释义经过修改）<br>词典资料：韩国国立国语院《<a class="lic-link" href="https://krdict.korean.go.kr/" target="_blank" rel="noopener">韩国语基础词典</a>》（CC BY-SA 2.0 KR）<br>本应用与延世大学无关。</p>
    </main>
    ${tabBar("settings")}
  </div>`;
  bindTabs(root, ctx);

  // 학습 내용 펼치기
  root.querySelectorAll(".ch-row").forEach((b) => b.addEventListener("click", () => {
    const open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(open));
    root.querySelector("#" + b.getAttribute("aria-controls")).hidden = !open;
  }));
  const chMore = root.querySelector("#ch-more");
  if (chMore) chMore.addEventListener("click", () => {
    const open = chMore.getAttribute("aria-expanded") !== "true";
    chMore.setAttribute("aria-expanded", String(open));
    root.querySelectorAll(".ch-extra").forEach((li) => { li.hidden = !open; });
    chMore.textContent = open ? "收起" : `再看 ${chMore.dataset.n} 课`;
  });
  const upAll = root.querySelector("#up-all");
  if (upAll) upAll.addEventListener("click", () => {
    const open = upAll.getAttribute("aria-expanded") !== "true";
    upAll.setAttribute("aria-expanded", String(open));
    root.querySelector("#up-rest").hidden = !open;
    root.querySelector("#up-dots").hidden = open;
    upAll.textContent = open ? "收起" : "全部";
  });

  // 오프라인 준비 상태: 서비스 작업자 + 장 파일 전부. 색만이 아니라 아이콘과 글로 알림
  const off = root.querySelector("#offline");
  collectOfflineStatus(ctx.chapterFiles).then((r) => {
    if (!off.isConnected) return;
    off.className = "offline-status " + (r.ready ? "ready" : "wait");
    off.innerHTML = r.ready
      ? `${icon("check")}<span>离线准备完成</span>`
      : `${icon("review")}<span>还在准备中 —— 有网络时重新打开一次应用，就会下载全部课程</span>`;
    off.dataset.ready = String(r.ready);
  });

  const setSettings = (patch) => {
    const cur = ctx.save;
    ctx.commit({ ...cur, settings: { ...cur.settings, ...patch } });
  };
  root.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => {
    if (b.getAttribute("aria-checked") !== "true") window.haechiLang.switchLang(b.dataset.lang);
  }));
  const snd = root.querySelector("#snd");
  snd.addEventListener("click", () => {
    const on = !(ctx.save.settings.sound !== false);
    setSettings({ sound: on });
    snd.setAttribute("aria-checked", String(on));
    if (on) ctx.sound.play("correct");
  });
  root.querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", async () => {
    // 목표를 낮춰 오늘 모은 XP가 이미 넘으면 그날을 바로 인정(이정표 보상 포함)
    const r = applyGoalChange(ctx.save, +b.dataset.g, ctx.today());
    ctx.commit(r.save);
    if (r.streakUp) toast(`今日目标完成！连续 ${r.save.streak.days} 天了。`);
    if (r.milestone) {
      ctx.sound.play("levelup");
      await celebrate({ item: ctx.save.item, milestone: r.milestone });
    }
    ctx.show("settings"); // 위 상태 줄 목표 숫자도 바로 맞춤
  }));
  const name = root.querySelector("#name");
  name.addEventListener("change", () => {
    const v = cleanName(name.value);
    name.value = v;
    setSettings({ name: v });
    toast(v ? `以后就叫你「${v}」啦。` : "好的，不用称呼。");
  });

  root.querySelector("#install").addEventListener("click", () => ctx.showInstallSheet());
  root.querySelector("#export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(ctx.save, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `haechi-korean-save-${localDate()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast("存档已导出。");
  });
  root.querySelector("#import").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    let raw;
    try { raw = JSON.parse(await f.text()); } catch { toast("读取存档失败。请确认是导出得到的 .json 文件。", "warn"); return; }
    if (!isOwnSave(raw)) {
      toast("这不是本应用的存档。请选择用「导出存档」得到的文件。", "warn");
      return;
    }
    const next = ctx.migrate(raw);
    const ok = await dialog({
      title: "要换成这个存档吗？",
      body: `<p>已完成 ${next.completed_lessons.length} 节课，XP ${Math.max(0, next.xp)}，字节 ${Math.max(0, next.bytes)}，连续 ${next.streak.days} 天</p><p>当前浏览器里的进度会被这个文件替换。</p>`,
      buttons: [{ label: "取消", value: false }, { label: "替换", value: true, kind: "primary" }],
    });
    if (!ok) return;
    ctx.commit(next);
    ctx.dayStart(); // 가져온 저장의 날짜로 연속 기록·퀘스트를 오늘에 맞춤
    toast("存档已导入。");
    ctx.show("home");
  });
}
