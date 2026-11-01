import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
from zhcheck import to_simplified, is_simplified


def test_to_simplified():
    assert to_simplified("親舊") == "亲旧"
    assert to_simplified("圖書館") == "图书馆"


def test_is_simplified():
    assert is_simplified("朋友") is True
    assert is_simplified("圖書館") is False
