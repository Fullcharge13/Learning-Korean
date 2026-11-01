// 전통 물건 사기·두기. 성공하면 새 Save, 실패하면 Error
import { ITEMS } from "../data/items.js";

export function buy(save, id) {
  const o = ITEMS.find((x) => x.id === id);
  if (!o) return new Error(`没有这个物品: ${id}`);
  if ((save.items || []).includes(id)) return new Error("已经有这个物品了");
  if (o.price == null) return new Error("这个物品不出售");
  const bytes = save.bytes || 0;
  if (bytes < o.price) return new Error(`字节不够 (${bytes}/${o.price})`);
  return { ...save, bytes: bytes - o.price, items: [...(save.items || []), id] };
}

/** 가진 물건 하나를 해치 옆에 둔다("none"은 빈손) */
export function place(save, id) {
  if (!(save.items || []).includes(id)) return new Error("还没有这个物品");
  return { ...save, item: id };
}
