# 獬豸老师教韩语 (해치와 한국어) v0.1.0

중국어(简体)를 쓰는 사람이 휴대폰·아이패드 브라우저에서 하루 5~10분, 《延世韩国语》 1권 단어를 **카드만 눌러서** 익히는 듀오링고식 학습 웹앱이에요. 타이핑도 듣기도 없어요. 선생님은 해치(獬豸)예요.

- 내용: 1권 10과 · 레슨 139개(장 평가 10개 포함) · 단어 1,064개
- 문제 3종: 韩→中 고르기, 中→韩 고르기(한자어는 한자·음 대응 해설), 음절 카드 순서 맞추기
- 게임 장치: XP, 하루 목표와 연속 기록, 일일 퀘스트, 배지 11개, 전통 물건 보관함(맷돌·장구·지게·부채·갓·복주머니·방패연·붓과 벼루, 30일 보상 북)
- 서버 없음: 진도는 기기 안(`localStorage`, 키 `haechi-korean.*`)에 저장, 오프라인에서도 동작
- 기기: 아이폰, 아이패드(폭 700px 이상이면 같은 화면을 1.3배로)

> 바탕은 [리아와 파이썬!](https://github.com/Fullcharge13/Learning-Python) v0.7.2예요. Python 실행·코드 입력을 걷어내고 단어 학습으로 바꿨어요. 같은 github.io 주소에 올라가도 저장과 오프라인 저장본이 서로 섞이지 않아요.

## 실행 방법

처음 한 번: `npm install`, `pip install -r requirements-dev.txt`

| 하고 싶은 일 | 명령 |
|---|---|
| 개발하면서 열어 보기 | `python3 tools/dev.py` → `http://127.0.0.1:8765/dev/` |
| 배포 파일 만들기 | `python3 build.py` → `dist/` 폴더를 그대로 웹(GitHub Pages 등)에 올림 |
| 단어 표에서 레슨 다시 만들기 | `python3 tools/make_lessons.py` (단어 뜻을 고친 뒤) |
| 그림 시트에서 그림 다시 자르기 | `python3 tools/cut_sheets.py` |

## 시험

| 명령 | 확인하는 것 |
|---|---|
| `npm test` | 저장·연속 기록·XP·퀘스트·배지·상점·레슨 흐름·대사, 화면 글자가 간체인지, 저장 키가 이 앱 것인지 |
| `python3 -m pytest tests/test_make_lessons.py tests/test_zhcheck.py tests/test_zh_review.py -q` | 레슨 생성 규칙, 간체 검사, 단어 검토 표 |
| `python3 tests/content.py` | 레슨 139개 점검: 보기 4개·중복 없음, 보류 단어 없음, 모든 단어가 한 번 이상 출제, 중국어가 모두 간체 |
| `python3 tests/build_test.py` | 배포 파일: 한 장 HTML, 크기, 오프라인, 장 파일 따로 받기, 출처 표시 |
| `python3 tests/flow.py` | 아이폰 3종·아이패드 세로/가로 화면 순회: 넘침·터치 크기·입력창 0개·긴 뜻·리아 저장과 공존 |

실제 아이폰·아이패드 사파리에서 볼 것은 `docs/device-checklist.md`에 있어요.

## 폴더 구조

```
src/                화면·규칙 코드, src/img/ 해치·물건 그림(PNG)
data/lessons/       1~10과 레슨 표(자동 생성)
data/zh-review.csv  단어 뜻 검토 결과(고침 36, 보류 0)
data/items.js       전통 물건 표
vendor/open-yonsei/ 원본 단어 자료(고치지 않음)
tools/              레슨 생성, 그림 자르기, 개발 서버, 아이콘
docs/superpowers/   설계서와 작업 계획
docs/img/ref/       해치·물건 참고 그림 시트
```

## 출처와 라이선스

- **단어**: [Open Yonsei Korean Vocabulary](https://github.com/Amulopapa67/open-yonsei-korean-vocabulary) 1권(CC BY-SA 3.0). 뜻 일부를 고쳤고(`data/zh-review.csv`), 이를 바탕으로 만든 `data/zh-review.csv`, `data/lessons/`, `data/concepts.js`도 **CC BY-SA 3.0**이에요(`data/LICENSE-data.md`). 이 앱은 연세대학교와 관련이 없어요.
- **코드**: MIT (`LICENSE`).
- **해치·물건 그림**: 사용자 제공 그림 시트(`docs/img/ref/`)를 잘라 썼어요.

## 알려진 한계

- 단어 뜻 검토(low 414개)는 사람 검수가 아니라 Claude가 했어요. 9과 「눈」은 사용자 확인으로 「雪」로 고쳤어요.
- 오답 보기는 같은 과·같은 품사에서 고르기 때문에, 표현·조사가 섞인 과에서는 어색한 보기가 나올 수 있어요.
- 화면 시험은 Chromium으로 아이폰·아이패드 크기를 흉내 낸 것이라, 실제 사파리에서 다를 수 있어요.
- 리아와 파이썬 저장 파일도 「导入存档」에서 받아들여져요(같은 칸 이름). 다른 앱 파일을 고르지 않도록 주의.
