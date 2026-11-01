// 인사 화면: 선생님 인사와 시작 버튼.
import { haechiImg } from "../haechi.js";
import { esc } from "./dom.js";

export function render(root, ctx) {
  const line = ctx.say("greet");
  root.innerHTML = `<main class="screen splash">
    <div class="splash-hero">
      <div class="ria-wrap big">${haechiImg({ face: "hello", item: ctx.save.item, size: 200 })}</div>
      <h1 class="logo">獬豸老师教韩语<span class="bang">!</span></h1>
      <p class="tagline">每天 10 分钟，跟着《延世韩国语》学单词</p>
    </div>
    <p class="bubble center">${esc(line.text)}</p>
    <button class="btn primary wide" id="go">开始</button>
    <p class="ver">${esc(ctx.version)}</p>
  </main>`;
  root.querySelector("#go").addEventListener("click", () => ctx.show("home"));
}
