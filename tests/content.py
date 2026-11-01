#!/usr/bin/env python3
"""단어 레슨 표 점검: python3 tests/content.py [--lessons-dir DIR]

- 레슨 칸 모양, 문제 종류는 choice·order·check만(입력 칸 write·blank 없음)
- choice·check: 보기 4개, 보기 글자 중복 없음, 정답 번호가 범위 안
- order: 2~5개 한글 음절 카드
- 보류(hold) 단어는 어디에도 없음
- 성공 기준 1: 보류 아닌 1권 단어가 모두 한 번 이상 문제에 나옴
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


def check(mods, vocab, review):
    errs = []
    hold = {r["entry_id"] for r in review if r["verdict"] == "hold"}
    want = {r["entry_id"] for r in vocab} - hold
    seen = set()
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
    missing = want - seen
    if missing:
        errs.append("%d words never asked (success criterion 1), e.g. %s" % (len(missing), sorted(missing)[:5]))
    return errs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lessons-dir", default=os.path.join(ROOT, "data", "lessons"))
    a = ap.parse_args()
    mods = load(os.path.abspath(a.lessons_dir))
    errs = check(mods, rows(os.path.join(ROOT, "vendor", "open-yonsei", "vol-01.csv")),
                 rows(os.path.join(ROOT, "data", "zh-review.csv")))
    n = sum(len(m["LESSONS"]) for m in mods.values())
    for e in errs:
        print("FAIL", e)
    print("%d chapters, %d lessons: %s" % (len(mods), n, "OK" if not errs else "%d problems" % len(errs)))
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
