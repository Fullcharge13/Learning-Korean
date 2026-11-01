// 「홈 화면에 추가」 안내 시트: 리아 + 그림 3단계 + 이유
import { haechiImg } from "../haechi.js";
import { el, esc, icon } from "./dom.js";
import { INSTALL_AFTER_TEXT } from "../install.js";

const SHARE = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="10" fill="#fff" stroke="#22304A" stroke-width="2.5"/><path d="M24 12v17M18 18l6-6 6 6" fill="none" stroke="#2F7BE0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 23h-2v13h18V23h-2" fill="none" stroke="#2F7BE0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ADD = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="10" fill="#fff" stroke="#22304A" stroke-width="2.5"/><rect x="14" y="14" width="20" height="20" rx="5" fill="none" stroke="#22304A" stroke-width="2.5"/><path d="M24 19v10M19 24h10" stroke="#22304A" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const DONE = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="10" fill="#fff" stroke="#22304A" stroke-width="2.5"/><text x="24" y="29" text-anchor="middle" font-size="12" font-weight="800" fill="#2F7BE0" font-family="-apple-system, sans-serif">添加</text></svg>`;

const STEPS = [
  [SHARE, "点「分享」按钮（看不到时在 ··· 菜单里）"],
  [ADD, "选择「添加到主屏幕」"],
  [DONE, "点右上角的「添加」"],
];

const WHY = "在 Safari 里 7 天不打开，记录可能会被清除。添加到主屏幕会更安全。";

function safariBody(item) {
  return `<div class="ria-row">
          <div class="ria-wrap">${haechiImg({ face: "wink", item, size: 72 })}</div>
          <p class="bubble">把我带到主屏幕吧，可以像应用一样直接打开。</p>
        </div>
        <h2 id="ins-title">添加到主屏幕</h2>
        <ol class="ins-steps">${STEPS.map(([svg, text], i) => `<li><span class="ins-no" aria-hidden="true">${i + 1}</span>${svg}<span>${esc(text)}</span></li>`).join("")}</ol>
        <p class="ins-after">${icon("play")}<span>${esc(INSTALL_AFTER_TEXT)}</span></p>
        <p class="ins-why">${esc(WHY)}</p>`;
}

// 카카오톡 등 앱 안 브라우저: 홈 화면 추가가 안 되므로 사파리로 열라는 짧은 안내
function inAppBody(item) {
  return `<div class="ria-row">
          <div class="ria-wrap">${haechiImg({ face: "think", item, size: 72 })}</div>
          <p class="bubble">你现在用的是应用内的浏览器。</p>
        </div>
        <h2 id="ins-title">需要在 Safari 里打开才能添加到主屏幕</h2>
        <p class="ins-menu"><span class="ins-dots" aria-hidden="true">···</span><span>点屏幕上的 … 菜单 →「在浏览器中打开」或「在 Safari 中打开」</span></p>
        <p class="ins-why">${esc(WHY)}</p>`;
}

/** 안내 시트를 연다. kind: "safari"(기본) | "inapp". 닫히면 resolve */
export function openInstallSheet({ item, kind = "safari" }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const wrap = el(`<div class="modal-back" role="presentation">
      <div class="modal install ${kind === "inapp" ? "inapp" : "safari"}" role="dialog" aria-modal="true" aria-labelledby="ins-title">
        ${kind === "inapp" ? inAppBody(item) : safariBody(item)}
        <button class="btn primary wide" id="ins-ok">知道了</button>
      </div></div>`);
    const close = () => {
      wrap.remove();
      document.removeEventListener("keydown", onKey);
      if (prev && prev.focus) prev.focus({ preventScroll: true });
      resolve();
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("#ins-ok")) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    wrap.querySelector("#ins-ok").focus({ preventScroll: true });
  });
}
