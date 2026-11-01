import { test } from "node:test";
import assert from "node:assert/strict";
import { buy, place } from "../../src/shop.js";
import { ITEMS } from "../../data/items.js";
import { newSave } from "../../src/save.js";

const mk = (over = {}) => ({ ...newSave(), ...over });

test("ITEMS table: 10 traditional items, spec prices", () => {
  assert.equal(ITEMS.length, 10);
  assert.deepEqual(ITEMS.map((x) => x.id), ["none", "maetdol", "janggu", "jige", "buchae", "gat", "bokjumeoni", "yeon", "but", "buk"]);
  assert.equal(ITEMS.reduce((a, x) => a + (x.price || 0), 0), 100 + 180 * 4 + 240 * 2 + 300);
  const buk = ITEMS.find((x) => x.id === "buk");
  assert.equal(buk.unlock, "streak30");
  assert.equal(buk.price, null);
  assert.equal(ITEMS[0].unlock, "start");
  for (const x of ITEMS) assert.ok(x.ko && x.zh, x.id);
  assert.equal(ITEMS.find((x) => x.id === "janggu").zh, "长鼓");
});

test("buy: needs enough bytes, adds the item, takes the price", () => {
  assert.ok(buy(mk({ bytes: 99 }), "maetdol") instanceof Error);
  const s = buy(mk({ bytes: 120 }), "maetdol");
  assert.deepEqual(s.items, ["none", "maetdol"]);
  assert.equal(s.bytes, 20);
  assert.ok(buy(s, "maetdol") instanceof Error, "already owned");
  assert.ok(buy(mk({ bytes: 999 }), "buk") instanceof Error, "not for sale");
  assert.ok(buy(mk({ bytes: 999 }), "pirate") instanceof Error, "unknown");
});

test("place: only an owned item can sit beside haechi", () => {
  assert.ok(place(mk(), "janggu") instanceof Error);
  assert.equal(place(mk({ items: ["none", "janggu"] }), "janggu").item, "janggu");
  assert.equal(place(mk({ items: ["none", "janggu"], item: "janggu" }), "none").item, "none");
});
