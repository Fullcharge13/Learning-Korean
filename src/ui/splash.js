// 인사 화면: 선생님 인사와 시작 버튼.
import { riaSVG } from "../ria.js";
import { esc } from "./dom.js";

export function render(root, ctx) {
  const line = ctx.say("greet");
  root.innerHTML = `<main class="screen splash">
    <div class="splash-hero">
      <div class="ria-wrap big">${riaSVG({ outfit: ctx.save.outfit, face: "joy", size: 200 })}</div>
      <h1 class="logo">리아와 파이썬<span class="bang">!</span></h1>
      <p class="tagline">하루 10분, 문리아 교수와 첫 코드부터</p>
    </div>
    <p class="bubble center">${esc(line.text)}</p>
    <button class="btn primary wide" id="go">시작하기</button>
    <p class="ver">${esc(ctx.version)}</p>
  </main>`;
  root.querySelector("#go").addEventListener("click", () => ctx.show("home"));
}
