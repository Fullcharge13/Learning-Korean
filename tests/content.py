#!/usr/bin/env python3
"""단어 레슨 표 점검: python3 tests/content.py [--lessons-dir DIR]

- 레슨 칸 모양, 문제 종류는 choice·order·check만(입력 칸 write·blank 없음)
- choice·check: 보기 4개, 보기 글자 중복 없음, 정답 번호가 범위 안,
  오답 보기의 단어가 정답과 뜻(中→韩)이나 한국어(韩→中)가 같지 않음(정답이 둘로 보이지 않게)
- order: 2~5개 한글 음절 카드
- 보류(hold) 단어는 어디에도 없음
- 성공 기준 1: 보류 아닌 1·2권 단어가 모두 한 번 이상 문제에 나옴
- 예문 빈칸 문제: 빈칸 하나·번역 있음·정답이 그 단어, 예문 있는(보류 아닌) 단어는 모두 빈칸으로 한 번 이상
- 화면에 보이는 중국어는 모두 간체
"""
import argparse
import csv
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from zhcheck import is_simplified  # noqa: E402

DUMP = r"""
const fs = await import("node:fs"); const path = await import("node:path"); const url = await import("node:url");
const dir = process.argv[1]; const out = {};
for (const f of fs.readdirSync(dir).filter((f) => /^ch\d+\.js$/.test(f)).sort()) {
  const m = await import(url.pathToFileURL(path.join(dir, f)).href);
  out[f] = { CHAPTER: m.CHAPTER, LESSONS: m.LESSONS };
}
process.stdout.write(JSON.stringify(out));
"""
LESSON_KEYS = {"id", "chapter", "title", "goal", "summary", "cards", "items"}
TYPES = {"choice", "order", "check"}


def load(lessons_dir):
    r = subprocess.run(["node", "--input-type=module", "-e", DUMP, lessons_dir], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(r.stderr)
    return json.loads(r.stdout)


def rows(p):
    with open(p, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


# 빈칸 뒤 조사가 받침 유무로 꼴이 바뀌면(이/가 …) 모든 카드가 그 꼴과 맞아야 함(조사만 보고 고르지 못하게)
PARTICLES = (("이에요", "other"), ("예요", "none"), ("으로", "other"), ("로", "none_or_l"), ("이", "other"), ("가", "none"),
             ("을", "other"), ("를", "none"), ("은", "other"), ("는", "none"), ("과", "other"), ("와", "none"))


def _final(word):
    c = word.rstrip("?.!")[-1:]
    if not ("가" <= c <= "힣"):
        return None
    f = (ord(c) - 0xAC00) % 28
    return "none" if f == 0 else ("l" if f == 8 else "other")


def particle_fits(card, after):
    for p, need in PARTICLES:
        if after.startswith(p) and (len(after) == len(p) or not ("가" <= after[len(p)] <= "힣")):
            f = _final(card)
            if f is None:
                return True
            return f == need or (need == "none_or_l" and f in ("none", "l")) or (need == "other" and f == "l" and p != "으로")
    return True


def check(mods, vocab, review, examples=()):
    errs = []
    avoid_of = {r["entry_id"]: {x for x in (r.get("avoid") or "").split("|") if x} for r in examples}
    hold = {r["entry_id"] for r in review if r["verdict"] == "hold"}
    fix = {r["entry_id"]: r["chinese_new"] for r in review if r["verdict"] == "fix"}
    final = {r["entry_id"]: (r["korean"], fix.get(r["entry_id"], r["chinese"])) for r in vocab if r["entry_id"] not in hold}
    zh_of, ko_of = {}, {}
    for ko, zh in final.values():
        zh_of.setdefault(ko, set()).add(zh)
        ko_of.setdefault(zh, set()).add(ko)
    want = {r["entry_id"] for r in vocab} - hold
    seen, filled = set(), set()
    for fname, m in mods.items():
        for l in m["LESSONS"]:
            where = "%s %s" % (fname, l.get("id"))
            if not LESSON_KEYS <= set(l):
                errs.append("%s: missing keys %s" % (where, sorted(LESSON_KEYS - set(l))))
                continue
            texts = [l["title"], l["goal"], *l["summary"]]
            for c in l["cards"]:
                texts.append(c.get("say", ""))
                for w in c.get("words", []):
                    texts += [w.get("zh", ""), w.get("hanja", "")]
            for i, it in enumerate(l["items"]):
                at = "%s item %d" % (where, i)
                t = it.get("type")
                if t not in TYPES:
                    errs.append("%s: type %r not allowed" % (at, t))
                    continue
                seen.add(it.get("concept"))
                texts += [it.get("q", ""), it.get("explain", "")]
                if t in ("choice", "check"):
                    o = it.get("options", [])
                    if len(o) != 4 or len(set(o)) != 4:
                        errs.append("%s: options must be 4 distinct texts: %r" % (at, o))
                    if not (isinstance(it.get("answer"), int) and 0 <= it["answer"] < len(o)):
                        errs.append("%s: bad answer %r" % (at, it.get("answer")))
                    texts += o
                    ans = final.get(it.get("concept"))
                    sent = it.get("sentence")
                    if sent is not None:
                        filled.add(it.get("concept"))
                        texts.append(sent.get("zh", ""))
                        if sent.get("ko", "").count("＿＿") != 1 or "[[" in sent.get("ko", "") or not sent.get("zh"):
                            errs.append("%s: fill sentence needs one blank and a translation: %r" % (at, sent))
                        if ans and o and o[it["answer"]] != ans[0]:
                            errs.append("%s: fill answer %r is not the word %r" % (at, o[it["answer"]], ans[0]))
                        bad_p = [x for x in o if not particle_fits(x, sent.get("ko", "").split("＿＿")[-1])]
                        if bad_p:
                            errs.append("%s: particle after the blank gives the answer away, cards %r" % (at, bad_p))
                        avoid = avoid_of.get(it.get("concept"), set()) & set(o)
                        if avoid:
                            errs.append("%s: card(s) %r also fit this sentence (examples.csv avoid)" % (at, sorted(avoid)))
                    # 빈칸 문제는 한국어 카드를 고르므로 中→韩처럼 같은 뜻 오답을 막는다
                    z2k = it.get("q", "").endswith("用韩语怎么说？") or sent is not None
                    for d in (o[:it["answer"]] + o[it["answer"] + 1:]) if ans else []:
                        if (z2k and ans[1] in zh_of.get(d, ())) or (not z2k and ans[0] in ko_of.get(d, ())):
                            errs.append("%s: distractor %r means the same as the answer %r" % (at, d, ans))
                else:
                    ln = it.get("lines", [])
                    if not (2 <= len(ln) <= 5 and all(len(s) == 1 and "가" <= s <= "힣" for s in ln)):
                        errs.append("%s: order lines must be 2-5 Hangul syllables: %r" % (at, ln))
            bad = [x for x in texts if x and not is_simplified(x)]
            if bad:
                errs.append("%s: not simplified: %r" % (where, bad[:3]))
    leaked = seen & hold
    if leaked:
        errs.append("hold words used: %s" % sorted(leaked))
    no_fill = {r["entry_id"] for r in examples if r["status"] != "hold"} - hold - filled
    if no_fill:
        errs.append("%d example words never asked as fill, e.g. %s" % (len(no_fill), sorted(no_fill)[:5]))
    missing = want - seen
    if missing:
        errs.append("%d words never asked (success criterion 1), e.g. %s" % (len(missing), sorted(missing)[:5]))
    return errs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lessons-dir", default=os.path.join(ROOT, "data", "lessons"))
    a = ap.parse_args()
    mods = load(os.path.abspath(a.lessons_dir))
    errs = check(mods, [r for v in (1, 2) for r in rows(os.path.join(ROOT, "vendor", "open-yonsei", "vol-%02d.csv" % v))],
                 rows(os.path.join(ROOT, "data", "zh-review.csv")), rows(os.path.join(ROOT, "data", "examples.csv")))
    n = sum(len(m["LESSONS"]) for m in mods.values())
    for e in errs:
        print("FAIL", e)
    print("%d chapters, %d lessons: %s" % (len(mods), n, "OK" if not errs else "%d problems" % len(errs)))
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
