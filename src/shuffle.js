// 보기·칩·줄 섞기 (판정 C23·C26)와 코드 조건(require) 이름의 한국어 표기. 순수 함수.

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function perm(n, seed) {
  const rng = mulberry32(seed >>> 0);
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

/** 보기 섞기. order[k] = 원래 번호. answer는 섞인 배열 안의 정답 번호 */
export function shuffleChoices(options, answer, seed) {
  const order = perm(options.length, seed);
  return { order, options: order.map((i) => options[i]), answer: order.indexOf(answer) };
}

/** 순서 문제 줄 섞기: 저장된(정답) 순서와 글자가 다른 순서를 돌려줌 */
export function shuffleOrder(lines, seed) {
  const n = lines.length;
  if (n < 2) return Array.from({ length: n }, (_, i) => i);
  const same = (p) => p.every((v, i) => lines[v] === lines[i]);
  for (let t = 0; t < 20; t++) {
    const p = perm(n, (seed + t * 7919) >>> 0);
    if (!same(p)) return p;
  }
  return Array.from({ length: n }, (_, i) => (i + 1) % n); // 한 칸 돌리기
}

/** 새 씨앗 (한 번의 풀이 동안 고정해서 씀) */
export function newSeed() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
