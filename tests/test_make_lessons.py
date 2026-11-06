import csv, json, os, shutil, sys, tempfile
import pytest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from make_lessons import load_words, build_chapter

FX = os.path.join(ROOT, "tests", "fixtures")
VOCAB = os.path.join(FX, "vocab-mini.csv")
VOCAB2 = os.path.join(FX, "vocab2-mini.csv")
REVIEW = os.path.join(FX, "zh-review-mini.csv")


def _ch(n=1):
    return build_chapter(load_words(VOCAB, REVIEW), n)


def _all_items(ch):
    return [it for l in ch["LESSONS"] for it in l["items"]]


def _texts(ch):
    out = []
    for l in ch["LESSONS"]:
        for c in l["cards"]:
            out += [w["ko"] for w in c["words"]]
        for it in l["items"]:
            out += [it["q"], it.get("explain", "")] + it.get("options", []) + it.get("lines", [])
    return out


def test_deterministic():
    assert json.dumps(_ch(), ensure_ascii=False) == json.dumps(_ch(), ensure_ascii=False)


def test_unreviewed_low_fails(tmp_path):
    rows = open(REVIEW, encoding="utf-8").read().splitlines()
    p = tmp_path / "r.csv"
    p.write_text("\n".join(r for r in rows if "v01-c01-u01-010" not in r) + "\n", encoding="utf-8")
    with pytest.raises(ValueError, match="unreviewed low entry: v01-c01-u01-010"):
        load_words(VOCAB, str(p))


def test_fix_applied_and_hold_excluded():
    words = {w["entry_id"]: w for w in load_words(VOCAB, REVIEW)}
    assert words["v01-c01-u01-010"]["zh"] == "人，人们"
    assert "v01-c01-u02-005" not in words
    ch = _ch()
    assert "眼睛" not in " ".join(_texts(ch))
    assert not [it for it in _all_items(ch) if it["concept"] == "v01-c01-u02-005"]


def test_chunk_8_and_merge_small_tail():
    ch = _ch()
    normal = [l for l in ch["LESSONS"] if not l.get("isExam")]
    sizes = [sum(len(c["words"]) for c in l["cards"]) for l in normal]
    # 단원1 12개 → 8 + 4 → 붙여서 12, 단원2 8개(보류 1개 뺌 → 7) → 7
    assert sizes == [12, 7], sizes


def test_chunk_13_splits_8_5(tmp_path):
    words = [dict(w, unit=1) for w in load_words(VOCAB, REVIEW) if w["chapter"] == 1]
    words = words[:13]
    for i, w in enumerate(words):
        w["sequence"] = i + 1
    ch = build_chapter(words, 1)
    sizes = [sum(len(c["words"]) for c in l["cards"]) for l in ch["LESSONS"] if not l.get("isExam")]
    assert sizes == [8, 5], sizes


def test_item_counts_and_exam_last():
    ch = _ch()
    *normal, exam = ch["LESSONS"]
    assert exam["isExam"] is True
    assert exam["id"] == "1-%d" % len(ch["LESSONS"])
    for l in normal:
        n_words = sum(len(c["words"]) for c in l["cards"])
        assert [it["type"] for it in l["items"]][-1] == "check"
        assert len([it for it in l["items"] if it["type"] != "check"]) == max(6, n_words)
    assert len([it for it in exam["items"] if it["type"] != "check"]) == 8
    assert ch["CHAPTER"] == {"id": 1, "title": "第1课"}


def test_choice_has_4_unique_options_one_answer():
    for it in _all_items(_ch()):
        if it["type"] in ("choice", "check"):
            assert len(it["options"]) == 4 and len(set(it["options"])) == 4, it
            assert it["answer"] == 0


def test_order_excludes_spaces():
    for it in _all_items(_ch()):
        if it["type"] == "order":
            assert 2 <= len(it["lines"]) <= 5, it
            assert all(len(s) == 1 and "가" <= s <= "힣" for s in it["lines"]), it
            assert it["concept"] != "v01-c01-u01-005"


def test_no_hanja_note_when_counts_differ():
    items = _all_items(_ch())
    hybrid = [it for it in items if it["concept"] == "v01-c01-u01-004"]  # 공부하다 = 工夫 + 하다
    assert hybrid and all("·" not in it["explain"] for it in hybrid)
    friend = [it for it in items if it["concept"] == "v01-c01-u01-001"]  # 친구 = 親舊
    assert friend and all("亲旧 = 친·구" in it["explain"] for it in friend)


def test_too_few_items_fails():
    words = [w for w in load_words(VOCAB, REVIEW) if w["chapter"] == 2][:1]
    with pytest.raises(ValueError, match="too few"):
        build_chapter(words, 2)


def test_every_word_asked_in_its_lesson():
    for l in _ch()["LESSONS"]:
        if l.get("isExam"):
            continue
        asked = {it["concept"] for it in l["items"]}
        n_words = sum(len(c["words"]) for c in l["cards"])
        assert len(asked) == n_words, l["id"]


def test_main_writes_concept_names(tmp_path):
    from make_lessons import main
    concepts = tmp_path / "concepts.js"
    main(str(tmp_path / "lessons"), VOCAB, REVIEW, str(concepts))
    text = concepts.read_text(encoding="utf-8")
    assert '"id": "v01-c01-u01-001", "name": "친구 · 朋友", "chapter": 1' in text
    assert "v01-c01-u02-005" not in text  # 보류 단어
    assert (tmp_path / "lessons" / "ch1.js").exists()


def test_check_is_not_a_repeat():
    for l in _ch()["LESSONS"]:
        *body, check = l["items"]
        assert check["type"] == "check"
        assert all(not (it["q"] == check["q"] and it.get("options") == check.get("options")) for it in body), l["id"]


def test_no_same_meaning_distractor():
    """뜻이 같은 단어(비가 오다·비가 내리다 = 下雨)는 서로의 오답 보기가 되지 않음 — 정답이 둘로 보임"""
    words = load_words(VOCAB, REVIEW)
    zh_of = {}
    for w in words:
        zh_of.setdefault(w["ko"], set()).add(w["zh"])
    ko_of = {}
    for w in words:
        ko_of.setdefault(w["zh"], set()).add(w["ko"])
    by_id = {w["entry_id"]: w for w in words}
    for l in _ch(2)["LESSONS"]:
        for it in l["items"]:
            if it["type"] not in ("choice", "check"):
                continue
            w = by_id[it["concept"]]
            for o in it["options"][1:]:
                if it["q"].endswith("用韩语怎么说？"):
                    assert w["zh"] not in zh_of[o], (it["q"], o)
                else:
                    assert w["ko"] not in ko_of[o], (it["q"], o)



def _both():
    return load_words([VOCAB, VOCAB2], REVIEW)


def test_vol2_chapter_ids_and_titles():
    ch = build_chapter(_both(), 11)
    assert ch["CHAPTER"] == {"id": 11, "title": "第二册 第1课"}
    assert ch["LESSONS"][0]["id"] == "11-1"
    assert ch["LESSONS"][-1]["title"] == "第二册 第1课 测验"
    assert all(l["chapter"] == 11 for l in ch["LESSONS"])


def test_vol1_unchanged():
    one = json.dumps(build_chapter(load_words(VOCAB, REVIEW), 1), ensure_ascii=False)
    assert json.dumps(build_chapter(_both(), 1), ensure_ascii=False) == one


def test_distractors_stay_in_app_chapter():
    vol2 = {w["ko"] for w in _both() if w["chapter"] == 11} | {w["zh"] for w in _both() if w["chapter"] == 11}
    for l in build_chapter(_both(), 11)["LESSONS"]:
        for it in l["items"]:
            for o in it.get("options", []):
                assert o in vol2, (l["id"], o)


def test_main_writes_vol2_concepts(tmp_path):
    from make_lessons import main
    concepts = tmp_path / "concepts.js"
    main(str(tmp_path / "lessons"), [VOCAB, VOCAB2], REVIEW, str(concepts))
    text = concepts.read_text(encoding="utf-8")
    assert '"id": "v02-c01-u01-001", "name": "친구 · 朋友", "chapter": 11' in text
    assert (tmp_path / "lessons" / "ch11.js").exists()


def test_korean_and_pos_override(tmp_path):
    rows = list(csv.DictReader(open(REVIEW, encoding="utf-8", newline="")))
    for r in rows:
        r["korean_new"] = r["pos_new"] = ""
        if r["entry_id"] == "v01-c01-u01-010":
            r["korean_new"], r["pos_new"] = "사람들", "대명사"
    p = tmp_path / "review.csv"
    with open(p, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    words = {w["entry_id"]: w for w in load_words(VOCAB, str(p))}
    assert (words["v01-c01-u01-010"]["ko"], words["v01-c01-u01-010"]["pos"]) == ("사람들", "대명사")
    plain = {w["entry_id"]: w for w in load_words(VOCAB, REVIEW)}
    other = next(k for k in words if k != "v01-c01-u01-010")
    assert (words[other]["ko"], words[other]["pos"]) == (plain[other]["ko"], plain[other]["pos"])


EX_HEAD = "entry_id,sentence_ko,zh,status,note\n"


def _ex(tmp_path, *rows, name="ex.csv"):
    p = tmp_path / name
    p.write_text(EX_HEAD + "".join(r + "\n" for r in rows), encoding="utf-8")
    return str(p)


def test_load_examples_splits_blank(tmp_path):
    from make_lessons import load_examples
    ex = load_examples(_ex(tmp_path, "v01-c01-u01-010,저 [[사람]]은 학생이에요.,那个人是学生。,cross,"), load_words(VOCAB, REVIEW))
    assert ex == {"v01-c01-u01-010": {"pre": "저 ", "form": "사람", "post": "은 학생이에요.", "zh": "那个人是学生。"}}


def test_load_examples_skips_hold(tmp_path):
    from make_lessons import load_examples
    ex = load_examples(_ex(tmp_path, "v01-c01-u01-010,저 [[사람]]은 학생이에요.,那个人是学生。,hold,x"), load_words(VOCAB, REVIEW))
    assert ex == {}


@pytest.mark.parametrize("row", [
    "v01-c01-u01-010,저 사람은 학생이에요.,那个人是学生。,cross,",
    "v01-c01-u01-010,[[저]] [[사람]]은 학생이에요.,那个人是学生。,cross,",
    "v09-c09-u09-999,저 [[사람]]은 학생이에요.,那个人是学生。,cross,",
    "v01-c01-u01-010,저 [[사람]]은 학생이에요.,這個人是學生。,cross,",
    "v01-c01-u01-010,저 [[사람]]은 학생이에요.,,cross,",
    "v01-c01-u01-010,저 [[사람]]은 학생이에요.,那个人是学生。,x,",
])
def test_load_examples_rejects_bad_rows(tmp_path, row):
    from make_lessons import load_examples
    with pytest.raises(ValueError):
        load_examples(_ex(tmp_path, row), load_words(VOCAB, REVIEW))
