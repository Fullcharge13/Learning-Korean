// 임시 레슨(작업 1). 작업 5에서 tools/make_lessons.py가 만든 표로 바뀐다.
export const CHAPTER = { id: 1, title: "第1课" };

export const LESSONS = [
  {
    id: "1-1", chapter: 1, title: "인사", goal: "打招呼的说法",
    summary: ["안녕하세요 = 你好", "네 = 是的"],
    cards: [{ say: "안녕하세요 — 你好 / 네 — 是的 / 저 — 我 / 이름 — 名字" }],
    items: [
      { type: "choice", concept: "v01-c01-u01-002", q: "「네」是什么意思？", options: ["是的", "我", "名字", "你好"], answer: 0, explain: "네 = 是的" },
      { type: "choice", concept: "v01-c01-u01-003", q: "「我」用韩语怎么说？", options: ["저", "네", "이름", "씨"], answer: 0, explain: "저 = 我" },
      { type: "order", concept: "v01-c01-u01-004", q: "按顺序点音节：「名字」", lines: ["이", "름"], explain: "이름 = 名字" },
      { type: "choice", concept: "v01-c01-u01-004", q: "「이름」是什么意思？", options: ["名字", "我", "是的", "朋友"], answer: 0, explain: "이름 = 名字" },
      { type: "check", concept: "v01-c01-u01-002", q: "「네」是什么意思？", options: ["是的", "不是", "我", "名字"], answer: 0, explain: "네 = 是的" },
    ],
  },
];
