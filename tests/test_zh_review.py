import csv, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from zhcheck import is_simplified

VOCAB = os.path.join(ROOT, "vendor", "open-yonsei", "vol-01.csv")
REVIEW = os.path.join(ROOT, "data", "zh-review.csv")


def _rows(p):
    with open(p, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def test_every_low_entry_reviewed():
    low = {r["entry_id"] for r in _rows(VOCAB) if r["review_status"] == "low"}
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
    for r in _rows(VOCAB):
        x = rev.get(r["entry_id"])
        if x and x["verdict"] == "hold":
            continue
        final = x["chinese_new"] if x and x["verdict"] == "fix" else r["chinese"]
        if not is_simplified(final):
            bad.append((r["entry_id"], final))
    assert not bad, bad[:10]


def test_hold_note_present():
    assert not [r["entry_id"] for r in _rows(REVIEW) if r["verdict"] == "hold" and not r["note"].strip()]
