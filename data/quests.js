// 일일 퀘스트 표 (설계서 5-3). key = tick()에 들어오는 사건 이름
export const QUESTS = [
  { id: "q_lessons2", name: "完成 2 节课", key: "lesson_done", goal: 2, reward: 5 },
  { id: "q_xp20", name: "获得 20 XP", key: "xp", goal: 20, reward: 5 },
  { id: "q_review3", name: "复习 3 道错题", key: "review_item", goal: 3, reward: 5 },
  { id: "q_perfect", name: "无失误完成一节课", key: "perfect_lesson", goal: 1, reward: 8 },
];
