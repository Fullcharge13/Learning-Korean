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


RECHECK = os.path.join(ROOT, "docs", "review", "2026-11-06-재검수-고칠목록.csv")


def _final():
    from make_lessons import load_words
    return {w["entry_id"]: w for w in load_words(VOCABS, REVIEW)}


def test_recheck_list_applied():
    """2026-11-06 1~20장 재검수 236개가 최종 뜻에 들어감"""
    with open(RECHECK, encoding="utf-8-sig", newline="") as f:
        want = {r["entry_id"]: r["고칠 뜻(최종)"] for r in csv.DictReader(f)}
    assert len(want) == 236
    final = _final()
    bad = [(k, final[k]["zh"], v) for k, v in want.items() if final[k]["zh"] != v]
    assert not bad, bad[:10]


def test_recheck_samples():
    final = _final()
    by_ko = {w["ko"]: w for w in final.values()}
    assert by_ko["환전"]["zh"] == "换钱；兑换外币"
    assert by_ko["대출하다"]["zh"] == "借（书），借阅"
    assert final["v01-c07-u04-018"]["zh"] == "车，汽车"
    assert (final["v01-c03-u02-046"]["zh"], final["v01-c03-u02-046"]["pos"]) == ("不，没（否定）", "부사")
    assert final["v01-c02-u03-016"]["zh"] == "里面"


def test_korean_typos_fixed():
    final = _final()
    assert final["v02-c08-u01-008"]["ko"] == "배탈이 나다"
    assert final["v02-c09-u02-007"]["ko"] == "여행 경비"


def test_no_space_separated_senses():
    bad = [(k, w["zh"]) for k, w in _final().items() if re.search(r"[一-鿿] +[一-鿿]", w["zh"])]
    assert not bad, bad[:10]


def test_xreview_2026_11_06():
    """한·중 문학 번역 스킬 교차 검수 반영: 뜻 5, 품사 8"""
    final = _final()
    assert final["v01-c02-u04-006"]["zh"] == "电影院，剧院"
    assert final["v02-c07-u03-009"]["zh"] == "学长，学姐；前辈"
    assert final["v02-c05-u05-007"]["pos"] == "부사"
    assert final["v02-c08-u05-022"]["pos"] == "동사"
    assert final["v02-c01-u02-004"]["pos"] == "명사"
