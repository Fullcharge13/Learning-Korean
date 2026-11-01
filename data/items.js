// 전통 물건 10개 (설계서 §6). 하나를 골라 해치 옆에 둔다. 그림: src/img/items/<id>.png (tools/cut_sheets.py)
// price: null = 판매 안 함, unlock: 판매 외 얻는 방법
export const ITEMS = [
  { id: "none", ko: "빈손", zh: "空手", price: null, unlock: "start" },
  { id: "maetdol", ko: "맷돌", zh: "石磨", price: 100 },
  { id: "janggu", ko: "장구", zh: "长鼓", price: 180 },
  { id: "jige", ko: "지게", zh: "背架", price: 180 },
  { id: "buchae", ko: "부채", zh: "扇子", price: 180 },
  { id: "gat", ko: "갓", zh: "笠子", price: 180 },
  { id: "bokjumeoni", ko: "복주머니", zh: "福袋", price: 240 },
  { id: "yeon", ko: "방패연", zh: "盾牌风筝", price: 240 },
  { id: "but", ko: "붓과 벼루", zh: "笔和砚", price: 300 },
  { id: "buk", ko: "북", zh: "鼓", price: null, unlock: "streak30" },
];
