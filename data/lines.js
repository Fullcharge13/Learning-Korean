// 해치(獬豸) 선생님 대사 표 — 상황 13종 × 3~5줄. 화면 언어는 간체 중국어.
// 표정: src/haechi.js FACE_IDS (smile joy sparkle think surprise worry cheer wink hello done sleepy)
// 자리 표시: {name} {streak} {xp} {item}
//   {item}에는 물건 이름(「장구 · 长鼓」)이 들어간다.
//   {streak}·{xp}·{item} 값이 없으면 say()가 그 줄을 건너뛴다. 상황마다 자리 표시 없는 줄을 하나 이상 둔다.
// {name}은 줄 맨 앞에 「{name}，」 꼴로 한 번만 쓴다. 이름이 비면 say()가 이 덩어리를 통째로 뺀다.

export const LINES = {
  greet: [
    { text: "{name}，欢迎！今天也一起学几个韩语单词吧。", face: "smile" },
    { text: "来啦！今天的目标只有一个：比昨天多记一个词。", face: "cheer" },
    { text: "我是獬豸，守护光化门的那位。今天守护你的韩语！", face: "wink" },
    { text: "{name}，位子给你留好了。开始吧？", face: "joy" },
    { text: "每天几分钟，韩语就会慢慢变成你的。", face: "smile" },
  ],
  correct: [
    { text: "叮咚！完全正确。", face: "joy" },
    { text: "对了！看得出你是真的记住了。", face: "smile" },
    { text: "漂亮！这个词已经是你的了。", face: "sparkle" },
    { text: "答对了，记住刚才的感觉。", face: "cheer" },
  ],
  combo: [
    { text: "连续答对！节奏很好。", face: "sparkle" },
    { text: "这么顺，韩国朋友都要夸你了。", face: "wink" },
    { text: "一连答对，说明真的记牢了。", face: "joy" },
    { text: "停不下来了吧？保持这个速度！", face: "cheer" },
  ],
  wrong: [
    { text: "差一点！一起看看是哪里不一样。", face: "think" },
    { text: "没关系，错的答案也能帮你记住。", face: "smile" },
    { text: "嗯，再仔细看一遍吧。", face: "think" },
    { text: "这个词很多人一开始都会搞混。", face: "worry" },
    { text: "很好的尝试！下次一个字一个字地看。", face: "cheer" },
  ],
  running: [
    { text: "稍等一下，马上就好。", face: "think" },
    { text: "正在准备，请稍候。", face: "smile" },
    { text: "马上就来！", face: "wink" },
  ],
  error: [
    { text: "哎呀，出了点问题。再试一次吧。", face: "surprise" },
    { text: "别担心，重新打开就好了。", face: "smile" },
    { text: "好像卡住了，我们再来一次。", face: "worry" },
  ],
  hint: [
    { text: "给你一个提示，答案还是要你自己找哦。", face: "wink" },
    { text: "先想想这个词是什么意思。", face: "think" },
    { text: "汉字词的读音常常和汉语很像。", face: "smile" },
    { text: "带着这个线索再往前一步。", face: "cheer" },
  ],
  lesson_done: [
    { text: "完成！得到了 {xp} XP。", face: "done" },
    { text: "{name}，坚持到最后了！今天学的词都是你的了。", face: "sparkle" },
    { text: "辛苦啦！又长进了 {xp} XP。", face: "smile" },
    { text: "完成一课！下一课我也准备好了。", face: "cheer" },
  ],
  course_done: [
    { text: "{name}，第一、二册的单词全部学完了！真为你骄傲！", face: "sparkle" },
    { text: "全部课程完成！可以开始用韩语打招呼了。", face: "done" },
    { text: "坚持到最后了。你已经是韩语学习者啦！", face: "cheer" },
  ],
  streak_up: [
    { text: "连续学习 {streak} 天！坚持是最厉害的本领。", face: "sparkle" },
    { text: "{name}，已经 {streak} 天了，习惯在慢慢养成。", face: "joy" },
    { text: "今天的目标完成！一点一点积累起来了。", face: "joy" },
    { text: "今天也做到了。连续 {streak} 天！", face: "cheer" },
  ],
  streak_broken: [
    { text: "我刚才睡着了……我们从第一天重新开始吧！", face: "sleepy" },
    { text: "休息一天也没关系，学过的词都还在。", face: "smile" },
    { text: "记录只是数字，实力没有减少。", face: "sleepy" },
    { text: "{name}，欢迎回来！今天重新开始吧！", face: "joy" },
  ],
  item_bought: [
    { text: "{item}，怎么样？和我配吗？", face: "sparkle" },
    { text: "{item}，我很喜欢！今天就带着它。", face: "joy" },
    { text: "新的传统物品 {item}！眼光真好。", face: "wink" },
    { text: "这些都是韩国的传统物品，名字也可以一起记哦。", face: "smile" },
  ],
  welcome_back: [
    { text: "{name}，好久不见！最近好吗？", face: "surprise" },
    { text: "回来啦。先轻松地复习一下吧？", face: "smile" },
    { text: "一直在等你呢。", face: "wink" },
    { text: "你学到哪里我都记着，接着来吧。", face: "cheer" },
  ],
};

// 모르는 상황일 때 쓰는 중립 대사
export const FALLBACK_LINE = { text: "慢慢来，我一直在这里。", face: "smile" };
