// 레슨 화면: 개념 카드 → 터치 문제 → 재도전 → 이해도 확인 → 완료
// 진행 순서는 lessonflow.js 상태 기계가 정하고, 이 파일은 그리기와 채점만 한다.
import { current, nextCard, answer, summary } from "../lessonflow.js";
import { newSession, mark as markConcept, touchResult, logSubmit, finishInfo } from "../session.js";
import { packResume, restoreSession, hasProgress } from "../resume.js";
import { haechiImg } from "../haechi.js";
import { esc, icon, bar, codeBlock, dialog, riaSays, cardExample } from "./dom.js";
import { shuffleChoices, shuffleOrder, newSeed } from "../shuffle.js";
import { reviewPool } from "../lessondata.js";

const GUARD_MS = 400;
const WAIT_MS = 300;    // 장 파일이 이보다 늦으면 「준비 중」 (v0.3 작업 1)
const LOAD_TIMEOUT_MS = 12000;  // 이보다 오래 걸리면 「준비 중」을 그만두고 안내
export const OFFLINE_LINE = "这一课需要在有网络时打开一次";
export const STALE_LINE = "有新版本了，点一下刷新";

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 복습 묶음: review_queue 개념의 터치 문제 5개. 그 개념이 든 장만 받는다(심화는 끝낸 것만, v0.7).
 *  일부 장만 받아져도 문제가 있으면 진행하고, 하나도 못 받았으면 실패로 알린다. */
async function buildReview(ctx) {
  const concepts = ctx.save.review_queue || [];
  const got = await Promise.allSettled(ctx.chaptersForConcepts(concepts).map((n) => ctx.getChapter(n)));
  const pool = reviewPool(got.filter((r) => r.status === "fulfilled").map((r) => r.value), concepts, ctx.save.completed_lessons);
  const failed = got.find((r) => r.status === "rejected");
  if (!pool.length && failed) throw failed.reason;
  return { id: "review", title: "复习", cards: [], items: shuffle(pool).slice(0, 5) };
}



/** 장 파일을 기다리는 동안·못 받았을 때 화면.
 *  state: blank(0.3초 전) · wait(준비 중) · error. kind(error일 때): offline · stale(새 판) · broken(그리다 실패) */
function waitScreen(root, ctx, state, kind = "offline") {
  const err = state === "error";
  const face = (f) => riaSays({ item: ctx.save.item, face: f, text: err ? ERROR_LINES[kind].say : "准备中……正在打开课程", size: 92 });
  const body = err
    ? `<h1 class="sr">课程打开失败</h1>${face("think")}
       <p class="muted center">${esc(ERROR_LINES[kind].note)}</p>
       <div class="btn-row"><button class="btn ghost" id="to-home">回到学习路线</button><button class="btn primary" id="retry">${esc(ERROR_LINES[kind].btn)}</button></div>`
    : state === "wait"
      ? `${face("smile")}<div class="btn-row one"><button class="btn ghost" id="to-home">回到学习路线</button></div>`
      : "";
  root.innerHTML = `<div class="screen lesson-wait" data-state="${state}"${err ? ` data-kind="${kind}"` : ""} aria-busy="${err ? "false" : "true"}">
    <main role="status" aria-live="polite">${body}</main>
  </div>`;
  const home = root.querySelector("#to-home");
  if (home) home.addEventListener("click", () => ctx.show("home"));
}

const ERROR_LINES = {
  offline: { say: OFFLINE_LINE, note: "连上网络后请点「重试」。之前的进度不会丢失。", btn: "重试" },
  stale: { say: STALE_LINE, note: "刷新后，之前的进度不会丢失。", btn: "刷新" },
  broken: { say: "打开课程时出了问题", note: "请点「重试」。之前的进度不会丢失。", btn: "重试" },
};

export const RESUME_ASK = "要从上次的地方继续吗？";

/** 이어 하기 묻기: "resume" | "restart". 창을 그냥 닫으면(바깥 누르기·Esc) 지운 것 없이 이어 함 */
async function askResume(ctx, lesson, S0) {
  const p = Math.round(summary(S0.flow).progress * 100);
  const v = await dialog({
    title: "继续上课",
    body: riaSays({ item: ctx.save.item, face: "smile", text: RESUME_ASK, size: 72, cls: "small resume-ask" })
      + `<p class="muted resume-meta">${esc(`${lesson.id} ${lesson.title || ""}`.trim())} · 已完成 ${p}%</p>`,
    buttons: [{ label: "继续", value: "resume", kind: "primary" }, { label: "从头开始", value: "restart" }],
  });
  return v === "restart" ? "restart" : "resume";
}

/** 레슨 화면: 장 파일을 받은 뒤 run()으로. 늦으면 「준비 중」(학습 길로 나갈 수 있음), 12초 넘거나 실패하면 안내와 다시 시도 */
export function render(root, ctx, params = {}) {
  const review = !!params.review;
  let alive = true, timers = [], inner = null, token = 0;
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  function fail(kind, err) {
    clear();
    if (err) console.warn("lesson load", err);
    waitScreen(root, ctx, "error", kind);
    root.querySelector("#retry").addEventListener("click", () => {
      // 새 판(장 파일 404, 새 서비스 작업자) → 새로고침해야 새 장 파일 이름표를 받는다
      if (kind === "stale") { location.reload(); return; }
      attempt();
    });
    const h = root.querySelector("h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }
  function attempt() {
    const my = ++token;
    const live = () => alive && my === token;
    clear();
    waitScreen(root, ctx, "blank");
    timers.push(setTimeout(() => { if (live()) waitScreen(root, ctx, "wait"); }, WAIT_MS));
    const timeout = new Promise((_, reject) => {
      timers.push(setTimeout(() => reject(Object.assign(new Error("chapter load timeout"), { timeout: true })), LOAD_TIMEOUT_MS));
    });
    let load;
    try {
      load = review ? buildReview(ctx) : ctx.getLesson(params.id);
    } catch (e) {
      load = Promise.reject(e);
    }
    Promise.race([load, timeout]).then((lesson) => {
      if (!live()) return;
      clear();
      if (!lesson || !lesson.items || !lesson.items.length) { ctx.show("home"); return; }
      start(lesson, live);
    }, (err) => {
      if (!live()) return;
      const stale = (err && err.stale) || (ctx.swChanged && ctx.swChanged());
      fail(stale ? "stale" : "offline", err);
    });
  }
  // 하던 기록이 있으면 한 번 묻고(v0.6.2 다), 이어 하기면 기록에서 되살려 시작
  async function start(lesson, live) {
    let resumed = null;
    if (!review && ctx.resume) {
      const rec = ctx.resume.read();
      if (rec && rec.lessonId === lesson.id) {
        const S0 = restoreSession(rec, lesson);
        if (!S0 || !hasProgress(S0.flow)) ctx.resume.clear();
        else {
          const pick = await askResume(ctx, lesson, S0);
          if (!live()) return;
          if (pick === "restart") ctx.resume.clear();
          else resumed = { S: S0, item: rec.item };
        }
      }
    }
    if (!live()) return;
    try {
      inner = run(root, ctx, lesson, review, resumed);
    } catch (e) {
      // 반쯤 그린 화면을 남기지 않음
      if (typeof inner === "function") { try { inner(); } catch { /* 무시 */ } }
      inner = null;
      document.body.classList.remove("result-open");
      console.error(e);
      fail("broken");
    }
  }
  attempt();
  return () => {
    alive = false;
    clear();
    if (typeof inner === "function") inner();
  };
}

function run(root, ctx, lesson, review, resumed = null) {
  // 누적 결과는 session.js 함수로만 바꾼다(이어 하기 기록과 보상이 같은 값을 봄). 나머지 칸은 화면 전용
  const S = {
    ...(resumed ? resumed.S : newSession(lesson)),
    guardUntil: 0, onContinue: null, cleanupItem: null,
    itemDone: false,   // 이 문제의 답을 냈고 「계속」을 기다림 → 그동안은 이어 하기 기록을 남기지 않음
  };

  // ---- 이어 하기 기록 (v0.6.2 다) ----
  function saveResume() {
    if (review || !ctx.resume || S.itemDone || !hasProgress(S.flow)) return;
    ctx.resume.write(packResume({ lessonId: lesson.id, S, item: null, now: Date.now() }));
  }

  root.innerHTML = `<div class="screen lesson">
    <header class="lesson-top">
      <button class="icon-btn" id="quit" aria-label="退出课程">${icon("close")}</button>
      <div class="lesson-progress">${bar(0, 100, "lp-bar", "课程进度")}</div>
      <span class="lesson-tag">${esc(review ? "复习" : lesson.id)}</span>
    </header>
    <main class="lesson-body" id="body"></main>
    <footer class="lesson-foot" id="foot"></footer>
    <section class="result" id="result" role="status" aria-live="polite" hidden></section>
  </div>`;
  const body = root.querySelector("#body");
  const foot = root.querySelector("#foot");
  const result = root.querySelector("#result");
  const progEl = root.querySelector(".lp-bar");

  function setProgress() {
    const p = Math.round(summary(S.flow).progress * 100);
    progEl.setAttribute("aria-valuenow", String(p));
    progEl.setAttribute("aria-valuemax", "100");
    progEl.setAttribute("aria-valuetext", `${p}%`);
    progEl.firstElementChild.style.width = p + "%";
  }

  const mark = (index, concept, outcome) => markConcept(S, index, concept, outcome);

  // ---- 결과 패널 ----
  function openResult({ ok, flowCorrect, title, text, answerHTML = "", situation, sfx, onContinue }) {
    const line = ctx.say(situation);
    result.className = "result " + (ok ? "ok" : "bad");
    result.innerHTML = `<div class="result-scroll">
      <div class="result-head">
        <span class="result-ic">${icon(ok ? "check" : "cross")}</span>
        <h2>${esc(title)}</h2>
      </div>
      ${answerHTML}
      ${text ? `<p class="result-explain">${esc(text)}</p>` : ""}
      <div class="ria-row small">
        <div class="ria-wrap${ok ? " jump" : ""}">${haechiImg({ face: line.face, size: 64 })}<span class="sfx" aria-hidden="true">${esc(sfx)}</span></div>
        <p class="bubble">${esc(line.text)}</p>
      </div>
    </div>
    <button class="btn ${ok ? "primary" : "coral"} wide" id="cont">继续</button>`;
    result.hidden = false;
    document.body.classList.add("result-open");
    S.guardUntil = performance.now() + GUARD_MS;
    S.onContinue = () => {
      result.hidden = true;
      document.body.classList.remove("result-open");
      if (onContinue) onContinue();
      else { S.flow = answer(S.flow, flowCorrect); step(); }
    };
    const btn = result.querySelector("#cont");
    btn.addEventListener("click", () => {
      if (performance.now() < S.guardUntil) return; // 입력 보호
      const f = S.onContinue; S.onContinue = null;
      if (f) f();
    });
    requestAnimationFrame(() => btn.focus({ preventScroll: true }));
  }

  // 터치 문제 채점 결과
  function judged(cur, ok, answerHTML) {
    // 같은 문제를 두 번 채점하지 않음(빠른 두 번 누르기 등)
    if (S.judged) return;
    S.judged = true;
    S.itemDone = true;
    const actBtn = foot.querySelector("#act");
    if (actBtn) actBtn.disabled = true;
    const it = cur.item;
    const { combo } = touchResult(S, cur, ok, review);
    ctx.sound.play(ok ? (combo ? "combo" : "correct") : "wrong");
    openResult({
      ok, flowCorrect: ok,
      title: ok ? (combo ? `连续答对 ${S.combo} 题！` : "答对了") : "差一点",
      text: it.explain || "",
      answerHTML: ok ? "" : answerHTML,
      situation: ok ? (combo ? "combo" : "correct") : "wrong",
      sfx: ok ? (combo ? "漂亮！" : "叮咚！") : "哎呀？",
    });
  }

  function footButton(label, { disabled = false, kind = "primary" } = {}) {
    foot.innerHTML = `<button class="btn ${kind} wide" id="act"${disabled ? " disabled" : ""}>${esc(label)}</button>`;
    return foot.querySelector("#act");
  }

  // ---- 카드 ----
  function renderCard(cur) {
    const c = cur.card;
    const first = cur.index === 0;
    body.innerHTML = `<article class="card-view">
      ${first && lesson.goal ? `<p class="goal-line">${icon("book")}<span>今天的目标：${esc(lesson.goal)}</span></p>` : ""}
      <h1 class="lesson-title">${esc(lesson.title)}</h1>
      <div class="ria-row">
        <div class="ria-wrap">${haechiImg({ face: first ? "smile" : "think", size: 84 })}</div>
        <p class="bubble">${esc(c.say)}</p>
      </div>
      ${cardExample(c)}
    </article>`;
    const b = footButton(cur.index + 1 < lesson.cards.length ? "下一张" : "开始做题");
    b.addEventListener("click", () => { S.flow = nextCard(S.flow); step(); });
  }

  // ---- 문제 머리 ----
  function itemHead(cur) {
    const it = cur.item;
    const tag = cur.retry ? `<span class="tag retry">${icon("review")}再做一次</span>`
      : it.type === "check" ? `<span class="tag check">检查理解</span>`
      : review && it.from ? `<span class="tag">${esc(it.from)} 复习</span>` : "";
    return `${tag}<h1 class="q">${esc(it.q || (it.type === "order" ? "按顺序点音节，拼出单词。" : "选出正确答案。"))}</h1>
      ${it.code ? codeBlock(it.code) : ""}`;
  }

  function renderChoice(cur) {
    const orig = cur.item;
    const sh = shuffleChoices(orig.options, orig.answer, newSeed()); // 이번 풀이 동안 고정 (C26)
    const it = { ...orig, options: sh.options, answer: sh.answer };
    let pick = -1;
    body.innerHTML = `<article class="item">${itemHead(cur)}
      <div class="options" role="radiogroup" aria-label="选项">${it.options.map((o, i) =>
        `<button class="opt" role="radio" aria-checked="false" data-i="${i}"><span class="opt-key" aria-hidden="true">${i + 1}</span><span class="opt-text">${esc(o)}</span></button>`).join("")}</div>
    </article>`;
    const act = footButton("确认", { disabled: true });
    body.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
      pick = +b.dataset.i;
      body.querySelectorAll(".opt").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      act.disabled = false;
    }));
    act.addEventListener("click", () => {
      if (pick < 0) return;
      judged(cur, pick === it.answer, `<p class="answer">正确答案：<span>${esc(it.options[it.answer])}</span></p>`);
    });
  }

  function renderOrder(cur) {
    const it = cur.item;
    const order = shuffleOrder(it.lines, newSeed());
    const chosen = [];
    body.innerHTML = `<article class="item">${itemHead(cur)}
      <p class="ex-label">我拼的单词 <small>（点一下可以拿掉）</small></p>
      <ol class="order-answer" id="oa" aria-label="选择的顺序"></ol>
      <p class="ex-label">音节卡片 <small>（按点击顺序放入）</small></p>
      <div class="order-pool" id="op">${order.map((li) =>
        `<button class="line" lang="ko" data-li="${li}">${esc(it.lines[li])}</button>`).join("")}</div>
    </article>`;
    const act = footButton("确认", { disabled: true });
    const oa = body.querySelector("#oa");
    const paint = () => {
      oa.innerHTML = chosen.length ? chosen.map((li, k) =>
        `<li><button class="line placed" lang="ko" data-k="${k}" aria-label="${esc(`拿掉第 ${k + 1} 个：${it.lines[li]}`)}">${esc(it.lines[li])}</button></li>`).join("")
        : `<li class="empty">点下面的卡片</li>`;
      body.querySelectorAll("#op .line").forEach((b) => {
        const used = chosen.includes(+b.dataset.li);
        b.disabled = used;
        b.classList.toggle("used", used);
      });
      oa.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => { chosen.splice(+b.dataset.k, 1); paint(); }));
      act.disabled = chosen.length !== it.lines.length;
    };
    body.querySelectorAll("#op .line").forEach((b) => b.addEventListener("click", () => {
      const li = +b.dataset.li;
      if (!chosen.includes(li)) { chosen.push(li); paint(); }
    }));
    paint();
    act.addEventListener("click", () => {
      if (chosen.length !== it.lines.length) return;
      // 순서 문제는 정답 순서가 하나뿐이라 저장된 순서와 비교한다(C23)
      const ok = chosen.map((li) => it.lines[li]).join("\n") === it.lines.join("\n");
      judged(cur, ok, `<p class="answer">正确答案：<span lang="ko">${esc(it.lines.join(""))}</span></p>`);
    });
  }

  function finishLesson() {
    const sum = summary(S.flow);
    if (!review && ctx.resume) ctx.resume.clear();
    const res = ctx.finish(finishInfo(S, lesson, review));
    ctx.sound.play("done");
    ctx.show("done", { result: res, lesson: review ? null : lesson, sum });
  }

  function step() {
    S.judged = false;
    S.itemDone = false;
    setProgress();
    const cur = current(S.flow);
    body.scrollTop = 0;
    window.scrollTo(0, 0);
    if (cur.kind === "done") { finishLesson(); return; }
    if (cur.kind === "card") { renderCard(cur); }
    else {
      const t = cur.item.type;
      if (t === "choice" || t === "check") renderChoice(cur);
      else if (t === "order") renderOrder(cur);
      else { S.flow = answer(S.flow, true); step(); return; }
    }
    saveResume();
    const h = body.querySelector("h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  root.querySelector("#quit").addEventListener("click", async () => {
    const ok = await dialog({
      title: "要退出这节课吗？",
      body: "<p>已经做的题不会保存，下次要从头开始。</p>",
      buttons: [{ label: "继续做题", value: false, kind: "primary" }, { label: "退出", value: true }],
    });
    if (ok) {
      if (!review && ctx.resume) ctx.resume.clear();
      ctx.show("home");
    }
  });

  const onKey = (e) => {
    if (e.key === "Enter" && !result.hidden && S.onContinue && performance.now() >= S.guardUntil) {
      if (document.activeElement && document.activeElement.id === "cont") return; // 버튼 자체 클릭으로 처리
      e.preventDefault();
      const f = S.onContinue; S.onContinue = null; f();
    }
  };
  document.addEventListener("keydown", onKey);
  step();
  return () => {
    document.removeEventListener("keydown", onKey);
    document.body.classList.remove("result-open");
    if (S.cleanupItem) S.cleanupItem();
  };
}
