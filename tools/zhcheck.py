"""간체 확인 도구(빌드·시험 때만 씀, 앱에는 들어가지 않음)."""
import opencc

_T2S = opencc.OpenCC("t2s")


def to_simplified(text: str) -> str:
    return _T2S.convert(text)


def is_simplified(text: str) -> bool:
    return to_simplified(text) == text
