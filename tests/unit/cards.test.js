import { test } from "node:test";
import assert from "node:assert/strict";
import { cardExample } from "../../src/ui/dom.js";

test("word card lists korean, chinese and simplified hanja", () => {
  const html = cardExample({ say: "x", words: [{ ko: "친구", zh: "朋友", hanja: "亲旧" }, { ko: "네", zh: "是的" }] });
  for (const t of ["친구", "朋友", "亲旧", "네", "是的"]) assert.ok(html.includes(t), t);
  assert.ok(!html.includes("<pre"), "no code block");
});

test("word card escapes text", () => {
  const html = cardExample({ words: [{ ko: "<b>", zh: "x" }] });
  assert.ok(html.includes("&lt;b&gt;") && !html.includes("<b>"));
});
