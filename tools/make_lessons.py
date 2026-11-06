#!/usr/bin/env python3
"""단어 CSV → 레슨 표(data/lessons/chN.js).

    python3 tools/make_lessons.py            # vendor/open-yonsei/vol-01·02.csv + data/zh-review.csv → data/lessons/

- 앱 장 id = (권 - 1) × 10 + 과: 1권 1~10과 → 1~10장, 2권 1~10과 → 11~20장(제목 「第二册 第N课」).

- 장 = 1권 과(chapter), 레슨 = 단원 단어를 sequence 순 8개씩(남는 4개 이하는 앞 레슨에 붙임), 장 끝에 장 평가.
- 문제: 韩→中, 中→韩(choice), 음절 카드(order), 예문 빈칸(choice + sentence, data/examples.csv에 예문 있는 단어). 일반 레슨 터치 max(6, 단어 수) + check 1(단어마다 한 문제 이상),
  장 평가 터치 8 + check 1.
- 무작위는 random.Random(문자열 시드)만 써서 같은 입력이면 같은 출력.
- 결과물은 CC BY-SA 3.0 (data/LICENSE-data.md).
"""
import csv
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zhcheck import to_simplified  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHUNK, TAIL = 8, 4
TOUCH, EXAM_TOUCH, MIN_ITEMS = 6, 8, 4
KINDS = ("k2z", "z2k", "order")


def _hangul(s):
    return all("가" <= c <= "힣" for c in s)


def _cjk(s):
    return bool(s) and all("一" <= c <= "鿿" for c in s)


def load_words(vocab_csvs, review_csv):
    """단어 CSV(하나 또는 목록) + 검토 표 → 단어 목록. chapter = 앱 장 id((권-1)*10+과)."""
    with open(review_csv, encoding="utf-8", newline="") as f:
        review = {r["entry_id"]: r for r in csv.DictReader(f)}
    rows = []
    for p in [vocab_csvs] if isinstance(vocab_csvs, str) else vocab_csvs:
        with open(p, encoding="utf-8", newline="") as f:
            rows += list(csv.DictReader(f))
    out = []
    for r in rows:
        rv = review.get(r["entry_id"])
        if r["review_status"] == "low" and not rv:
            raise ValueError("unreviewed low entry: " + r["entry_id"])
        if rv and rv["verdict"] == "hold":
            continue
        zh = rv["chinese_new"] if rv and rv["verdict"] == "fix" else r["chinese"]
        # 원본 오타·품사 오류는 검토 표의 korean_new·pos_new로 고친다(비어 있으면 원본)
        ko = (rv or {}).get("korean_new") or r["korean"]
        pos = (rv or {}).get("pos_new") or r["pos"]
        od = r["origin_detail"].strip()
        # 한자 대응은 순한자어이고 한자 수 = 음절 수일 때만(혼종어·표현은 대응 해설 없음)
        hanja = to_simplified(od) if r["origin_type"] == "hanja" and _cjk(od) and _hangul(ko) and len(od) == len(ko) else None
        vol, book_ch = int(r["volume"]), int(r["chapter"])
        out.append({"entry_id": r["entry_id"], "volume": vol, "book_chapter": book_ch, "chapter": (vol - 1) * 10 + book_ch,
                    "unit": int(r["unit"]), "sequence": int(r["sequence"]), "ko": ko, "zh": zh, "pos": pos, "hanja": hanja})
    return out


EX_STATUS = {"cross", "native", "hold"}


def load_examples(path, words):
    """예문 표 → {entry_id: {pre, form, post, zh}}. hold는 뺀다. 잘못된 줄은 ValueError로 멈춘다."""
    from zhcheck import is_simplified
    ids = {w["entry_id"] for w in words}
    out = {}
    with open(path, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            eid, s, zh, st = r["entry_id"], r["sentence_ko"], r["zh"].strip(), r["status"]
            parts = s.split("[[")
            if st not in EX_STATUS:
                raise ValueError("example %s: unknown status %r" % (eid, st))
            if eid not in ids:
                raise ValueError("example %s: no such word" % eid)
            if len(parts) != 2 or parts[1].count("]]") != 1 or "]]" in parts[0]:
                raise ValueError("example %s: needs exactly one [[...]]" % eid)
            if not zh or not is_simplified(zh):
                raise ValueError("example %s: zh must be simplified Chinese" % eid)
            if st == "hold":
                continue
            form, post = parts[1].split("]]")
            out[eid] = {"pre": parts[0], "form": form, "post": post, "zh": zh,
                        "avoid": [x for x in (r.get("avoid") or "").split("|") if x]}
    return out


def _chunks(words):
    parts = [words[i:i + CHUNK] for i in range(0, len(words), CHUNK)]
    if len(parts) > 1 and len(parts[-1]) <= TAIL:
        tail = parts.pop()
        parts[-1] += tail
    return parts


def _explain(w):
    note = " · %s = %s" % (w["hanja"], "·".join(w["ko"])) if w["hanja"] else ""
    return "%s = %s%s" % (w["ko"], w["zh"], note)


def _options(w, pool, field, seed, ok=None, avoid=()):
    """정답 + 같은 품사 오답 3개(모자라면 같은 장 아무 품사). 못 채우면 None.
    표시 글자가 겹치는 후보, 정답과 뜻(zh)이나 한국어(ko)가 같은 단어(비가 오다·비가 내리다 = 下雨)는 뺀다 — 정답이 둘로 보임."""
    used = {w[field]}
    picked = []
    rng = random.Random(seed)
    same_ko = {x["ko"] for x in pool if x["zh"] == w["zh"]} | {w["ko"]}
    same_zh = {x["zh"] for x in pool if x["ko"] == w["ko"]} | {w["zh"]}
    clash = lambda x: x["zh"] in same_zh or x["ko"] in same_ko or x["ko"] in avoid or (ok and not ok(x[field]))
    for same_pos in (True, False):
        cands = sorted({x[field] for x in pool if (not same_pos or x["pos"] == w["pos"]) and not clash(x)} - used)
        rng.shuffle(cands)
        for c in cands:
            if len(picked) == 3:
                break
            picked.append(c)
            used.add(c)
    return [w[field]] + picked if len(picked) == 3 else None


# 받침 유무로 꼴이 바뀌는 조사: (조사, 앞말 끝 받침). ㄹ 받침은 으로 대신 로를 받는다.
_PARTICLES = (("이에요", "other"), ("예요", "none"), ("으로", "other"), ("로", "none_or_l"), ("이", "other"), ("가", "none"),
              ("을", "other"), ("를", "none"), ("은", "other"), ("는", "none"), ("과", "other"), ("와", "none"))


def _final(word):
    c = word.rstrip("?.!")[-1:]
    if not ("가" <= c <= "힣"):
        return None
    f = (ord(c) - 0xAC00) % 28
    return "none" if f == 0 else ("l" if f == 8 else "other")


def _particle_ok(card, after):
    """빈칸 뒤 조사(after 맨 앞)와 카드 끝 받침이 맞는지. 그런 조사가 아니면 늘 True"""
    for p, need in _PARTICLES:
        if after.startswith(p) and (len(after) == len(p) or not ("가" <= after[len(p)] <= "힣")):
            f = _final(card)
            return (f is None or f == need or (need == "none_or_l" and f in ("none", "l"))
                    or (need == "other" and f == "l" and p != "으로"))
    return True


def _item(w, kind, pool, examples=None):
    seed = w["entry_id"] + ":" + kind
    if kind == "fill":
        ex = (examples or {}).get(w["entry_id"])
        # 오답 카드: 예문에 들어가도 말이 되는 단어(avoid)와, 빈칸 뒤 조사 꼴(이/가 …)과 안 맞아 바로 지워지는 단어는 뺀다
        opts = ex and _options(w, pool, "ko", seed, ok=lambda ko: _particle_ok(ko, ex["post"]), avoid=ex["avoid"])
        if not opts:
            return None
        return {"type": "choice", "concept": w["entry_id"], "q": "选出填入空白处的单词",
                "sentence": {"ko": ex["pre"] + "＿＿" + ex["post"], "zh": ex["zh"]}, "options": opts, "answer": 0,
                "explain": "%s%s%s · %s" % (ex["pre"], ex["form"], ex["post"], _explain(w))}
    if kind == "order":
        if not (_hangul(w["ko"]) and 2 <= len(w["ko"]) <= 5):
            return None
        return {"type": "order", "concept": w["entry_id"], "q": "按顺序点音节：「%s」" % w["zh"],
                "lines": list(w["ko"]), "explain": _explain(w)}
    field, q = ("zh", "「%s」是什么意思？" % w["ko"]) if kind == "k2z" else ("ko", "「%s」用韩语怎么说？" % w["zh"])
    opts = _options(w, pool, field, seed)
    if not opts:
        return None
    return {"type": "choice", "concept": w["entry_id"], "q": q, "options": opts, "answer": 0, "explain": _explain(w)}


def _items(words, pool, n, seed, examples=None):
    """단어마다 문제 종류를 돌려 쓰고, 안 맞는 종류는 다음 종류로. 단어가 모자라면 다른 종류로 한 바퀴 더.
    예문이 있는 단어는 첫 바퀴에서 빈칸 문제(fill)를 먼저 시도한다."""
    examples = examples or {}
    items, done = [], set()
    for rnd in range(len(KINDS)):
        for i, w in enumerate(words):
            if len(items) == n:
                break
            kinds = [KINDS[(i + rnd + k) % len(KINDS)] for k in range(len(KINDS))]
            if rnd == 0 and w["entry_id"] in examples:
                kinds.insert(0, "fill")
            for kind in kinds:
                if (w["entry_id"], kind) in done:
                    continue
                it = _item(w, kind, pool, examples)
                if it:
                    done.add((w["entry_id"], kind))
                    items.append(it)
                    break
    if len(items) < MIN_ITEMS:
        raise ValueError("too few items for lesson %s: %d" % (seed, len(items)))
    # 이해도 확인: 이 레슨에서 아직 안 낸 (단어, 종류) 중에서. 다 냈으면 이미 낸 것 중 하나
    check = None
    order = random.Random(seed + ":check").sample(words, len(words))
    for fresh in (True, False):
        for w in order:
            for kind in ("k2z", "z2k"):
                if fresh and (w["entry_id"], kind) in done:
                    continue
                check = _item(w, kind, pool)
                if check:
                    break
            if check:
                break
        if check:
            break
    if check:
        items.append(dict(check, type="check"))
    return items


def _cards(words):
    return [{"say": "来认识新单词吧！", "words": [{k: w[k] for k in ("ko", "zh", "hanja") if w[k]} for w in words[i:i + 4]]}
            for i in range(0, len(words), 4)]


def _chapter_title(w):
    return ("第%d课" if w["volume"] == 1 else "第二册 第%d课") % w["book_chapter"]


def build_chapter(words, chapter, examples=None):
    pool = sorted((w for w in words if w["chapter"] == chapter), key=lambda w: (w["unit"], w["sequence"]))
    ch_title = _chapter_title(pool[0])
    lessons = []
    units = sorted({w["unit"] for w in pool})
    for u in units:
        parts = _chunks([w for w in pool if w["unit"] == u])
        for k, part in enumerate(parts, 1):
            lid = "%d-%d" % (chapter, len(lessons) + 1)
            title = "第%d单元" % u + (" (%d)" % k if len(parts) > 1 else "")
            lessons.append({"id": lid, "chapter": chapter, "title": title, "goal": "认识 %d 个新单词" % len(part),
                            "summary": ["%s = %s" % (w["ko"], w["zh"]) for w in part[:4]],
                            "cards": _cards(part), "items": _items(part, pool, max(TOUCH, len(part)), lid, examples)})
    eid = "%d-%d" % (chapter, len(lessons) + 1)
    exam_words = random.Random("exam:%d" % chapter).sample(pool, min(len(pool), EXAM_TOUCH))
    lessons.append({"id": eid, "chapter": chapter, "title": ch_title + " 测验", "goal": "复习本课单词",
                    "summary": [], "isExam": True, "cards": [], "items": _items(exam_words, pool, EXAM_TOUCH, eid, examples)})
    return {"CHAPTER": {"id": chapter, "title": ch_title}, "LESSONS": lessons}


def main(out_dir=None, vocab=None, review=None, concepts_file=None, examples_file=None):
    out_dir = out_dir or os.path.join(ROOT, "data", "lessons")
    concepts_file = concepts_file or os.path.join(ROOT, "data", "concepts.js")
    words = load_words(vocab or [os.path.join(ROOT, "vendor", "open-yonsei", "vol-%02d.csv" % v) for v in (1, 2)],
                       review or os.path.join(ROOT, "data", "zh-review.csv"))
    # 예문 표는 실제 단어 자료와 짝. 시험이 단어 자료만 바꾸면 예문 없이 만든다
    if examples_file is None and vocab is None:
        examples_file = os.path.join(ROOT, "data", "examples.csv")
    examples = load_examples(examples_file, words) if examples_file else {}
    os.makedirs(out_dir, exist_ok=True)
    total = 0
    for ch in sorted({w["chapter"] for w in words}):
        data = build_chapter(words, ch, examples)
        total += len(data["LESSONS"])
        with open(os.path.join(out_dir, "ch%d.js" % ch), "w", encoding="utf-8") as f:
            f.write("// 자동 생성: tools/make_lessons.py — 고치지 말고 다시 만드세요. 데이터 라이선스 CC BY-SA 3.0 (data/LICENSE-data.md)\n")
            f.write("export const CHAPTER = %s;\n\n" % json.dumps(data["CHAPTER"], ensure_ascii=False))
            f.write("export const LESSONS = %s;\n" % json.dumps(data["LESSONS"], ensure_ascii=False, indent=1))
    # 복습·취약 단어 이름표(홈·배지 화면): concept id = entry_id
    with open(concepts_file, "w", encoding="utf-8") as f:
        f.write("// 자동 생성: tools/make_lessons.py — 단어 이름표(복습·취약 단어 표시). CC BY-SA 3.0 (data/LICENSE-data.md)\n")
        f.write("export const CONCEPTS = [\n%s\n];\n" % ",\n".join(
            "  " + json.dumps({"id": w["entry_id"], "name": "%s · %s" % (w["ko"], w["zh"]), "chapter": w["chapter"]}, ensure_ascii=False)
            for w in words))
    print("%d words, %d lessons" % (len(words), total))


if __name__ == "__main__":
    main()
