import re
import csv, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from zhcheck import is_simplified

VOCABS = [os.path.join(ROOT, "vendor", "open-yonsei", "vol-%02d.csv" % v) for v in (1, 2)]
REVIEW = os.path.join(ROOT, "data", "zh-review.csv")


def _vocab():
    return [r for p in VOCABS for r in _rows(p)]


def _rows(p):
    with open(p, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def test_every_low_entry_reviewed():
    low = {r["entry_id"] for r in _vocab() if r["review_status"] == "low"}
    ids = [r["entry_id"] for r in _rows(REVIEW)]
    assert len(ids) == len(set(ids)), "duplicate review rows"
    assert low <= set(ids), sorted(low - set(ids))[:10]


def test_verdict_values():
    assert {r["verdict"] for r in _rows(REVIEW)} <= {"ok", "fix", "hold"}


def test_fix_has_new_text():
    assert not [r["entry_id"] for r in _rows(REVIEW) if r["verdict"] == "fix" and not r["chinese_new"].strip()]


def test_all_final_meanings_simplified():
    rev = {r["entry_id"]: r for r in _rows(REVIEW)}
    bad = []
    for r in _vocab():
        x = rev.get(r["entry_id"])
        if x and x["verdict"] == "hold":
            continue
        final = x["chinese_new"] if x and x["verdict"] == "fix" else r["chinese"]
        if not is_simplified(final):
            bad.append((r["entry_id"], final))
    assert not bad, bad[:10]


def test_hold_note_present():
    assert not [r["entry_id"] for r in _rows(REVIEW) if r["verdict"] == "hold" and not r["note"].strip()]


def test_snow_in_weather_unit():
    """9과 날씨 단원의 눈은 '雪'(사용자 확인)"""
    r = next(r for r in _rows(REVIEW) if r["entry_id"] == "v01-c09-u03-008")
    assert (r["verdict"], r["chinese_new"]) == ("fix", "雪")


def test_no_hangul_or_broken_brackets_in_meanings():
    """화면에 보이는 중국어 뜻에 한글이 섞이거나 반각·전각 괄호가 어긋나지 않음(1·2권 전체)"""
    rev = {r["entry_id"]: r for r in _rows(REVIEW)}
    bad = []
    for r in _vocab():
        x = rev.get(r["entry_id"])
        if x and x["verdict"] == "hold":
            continue
        final = x["chinese_new"] if x and x["verdict"] == "fix" else r["chinese"]
        outside = re.sub("“[^”]*”", "", final)  # 문법 설명의 “에” 같은 인용은 괜찮음
        if re.search("[가-힣]", outside) or final.count("（") != final.count("）") or "(" in final or ")" in final:
            bad.append((r["entry_id"], final))
    assert not bad, bad
