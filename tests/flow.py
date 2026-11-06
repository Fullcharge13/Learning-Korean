"""화면 순회 시험.

실행: python3 tests/flow.py [시험 이름 …]

- 배포와 같은 한 장짜리 HTML을 시험용으로 빌드한다(python3 build.py --out tests/out/flow/dist).
- WebKit이 없어 Chromium에 Playwright 기기 설정(아이폰·아이패드)을 적용한다.
  사파리 고유 동작(홈 화면 추가, 저장 7일 규칙)은 docs/device-checklist.md에서 실기기로 본다.
- 캡처: tests/out/flow/*.png

시험
- test_no_overflow: 화면 8개 × 기기 5종(아이폰 3·아이패드 세로/가로) — 가로 스크롤 0, 화면 밖 버튼 0, 콘솔 오류 0
- test_touch_targets: 화면마다 보이는 버튼 44×44 CSS px 이상
- test_ipad_zoomed: 아이패드(폭 700px 이상)는 html zoom 1.3, 아이폰은 1
- test_no_text_inputs: 레슨 화면에 입력창(input·textarea·contenteditable)이 하나도 없음
- test_longest_meaning_fits: 가장 긴 중국어 뜻이 보기 카드 안에서 줄바꿈되고 넘치지 않음
- test_ria_save_coexists: 같은 주소의 리아와 파이썬 저장(ria-python.save)을 읽지도 바꾸지도 않음
- test_first_lesson: 새 저장 → 1-1 전부 정답 → 완료 화면 XP +15, completed_lessons ["1-1"]
- test_wrong_then_retry: 한 문제 틀림 → 본 문제 끝에 다시 나옴 → 완료 화면은 실수 없음 아님
- test_status_after_milestone: 연속 6일(어제 달성) → 레슨 완료로 7일 축하 창이 떠 있는 동안 상태 줄 7일
"""

import atexit
import datetime
import functools
import http.server
import json
import os
import socketserver
import subprocess
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tests", "out", "flow")
DIST = os.path.join(OUT, "dist")
SAVE_KEY = "haechi-korean.save"
RIA_KEY = "ria-python.save"
GUARD_WAIT = 450          # 결과 창 입력 보호(400ms)보다 조금 길게

DEVICES = ["iPhone 17", "iPhone 17e", "iPhone 17 Pro Max", "iPad Pro 11", "iPad Pro 11 landscape"]
SCREENS = ["splash", "home", "lesson-card", "touch-item", "done", "badges", "closet", "settings"]

# 터치 영역 예외(근거가 있는 것만). 비어 있으면 예외 없음.
TOUCH_EXCEPTIONS = {}


# ---------------------------------------------------------------- 서버·브라우저

class _Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
        ".json": "application/json", ".webmanifest": "application/manifest+json",
        ".zip": "application/zip",
    }

    def log_message(self, *a):
        pass


class _Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        # 창을 닫을 때 끊긴 내려받기(ConnectionResetError 등)는 시험과 무관
        if not isinstance(sys.exc_info()[1], (ConnectionError, BrokenPipeError)):
            super().handle_error(request, client_address)


_env = {}


def env():
    """빌드 한 번 + 서버 + Chromium 하나를 시험 전체가 같이 쓴다."""
    if _env:
        return _env
    os.makedirs(OUT, exist_ok=True)
    r = subprocess.run([sys.executable, os.path.join(ROOT, "build.py"), "--out", DIST],
                       cwd=ROOT, capture_output=True, text=True)
    assert r.returncode == 0, "build.py failed:\n" + r.stdout + r.stderr
    httpd = _Server(("127.0.0.1", 0), functools.partial(_Handler, directory=DIST))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start()
    browser = pw.chromium.launch()
    _env.update(httpd=httpd, pw=pw, browser=browser, url="http://127.0.0.1:%d/" % httpd.server_address[1],
                build=r.stdout.strip())

    def stop():
        try:
            browser.close()
            pw.stop()
        finally:
            httpd.shutdown()
    atexit.register(stop)
    return _env


def device_opts(name):
    if name.startswith("PC"):
        return {"viewport": {"width": 1280, "height": 800}}
    d = dict(env()["pw"].devices[name])
    d.pop("default_browser_type", None)
    return d


def slug(name):
    return name.lower().replace(" ", "-")


def today(n=0):
    return (datetime.date.today() - datetime.timedelta(days=n)).isoformat()


class App:
    """기기 하나 + 새 저장소의 앱 한 판."""

    def __init__(self, device="iPhone 17", save=None, reduced=False, url=None, extra=None, locale=None):
        e = env()
        opts = device_opts(device)
        if reduced:
            opts["reduced_motion"] = "reduce"
        if locale:
            opts["locale"] = locale
        # sw.js가 옛 빌드를 저장해 두지 않도록 서비스 작업자는 막는다(오프라인은 build_test.py가 시험)
        self.context = e["browser"].new_context(service_workers="block", **opts)
        self.page = self.context.new_page()
        self.device = device
        self.errors = []
        self.page.on("pageerror", lambda x: self.errors.append("pageerror: " + str(x)))
        self.page.on("console", lambda m: self.errors.append("console.error: " + m.text) if m.type == "error" else None)
        if save is not None:
            self.page.add_init_script(
                "if (!sessionStorage.getItem('flow-seeded')) { localStorage.setItem(%s, %s); sessionStorage.setItem('flow-seeded', '1'); }"
                % (json.dumps(SAVE_KEY), json.dumps(json.dumps(save))))
        for k, v in (extra or {}).items():
            self.page.add_init_script("if (!localStorage.getItem(%s)) localStorage.setItem(%s, %s);" % (json.dumps(k), json.dumps(k), json.dumps(v)))
        self.page.goto(url or e["url"])
        self.page.wait_for_selector(".screen.splash #go", timeout=20_000)

    def close(self):
        self.context.close()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()

    # -- 공용 동작 --
    def shot(self, name, full=False):
        path = os.path.join(OUT, name)
        self.page.screenshot(path=path, full_page=full)
        return path

    def js(self, expr, arg=None):
        return self.page.evaluate(expr, arg)

    def save(self):
        return self.js("() => JSON.parse(localStorage.getItem(%s))" % json.dumps(SAVE_KEY))

    def dismiss(self):
        """홈 화면 추가 안내(iOS 사파리 흉내 UA라서 뜰 수 있음)·확인되지 않은 창을 닫는다. 닫은 이름 목록."""
        closed = []
        for _ in range(3):
            if self.page.is_visible("#ins-ok"):
                self.page.wait_for_timeout(100)
                self.page.click("#ins-ok")
                self.page.wait_for_selector(".modal.install", state="detached")
                closed.append("install")
                continue
            break
        return closed

    def start(self):
        self.page.click("#go")
        self.page.wait_for_selector("#app[data-screen=home] .screen.home")
        self.page.wait_for_timeout(200)
        self.dismiss()

    def lesson(self, lid):
        # 레슨 목록(index.html)에는 문제가 없어 장 파일에서 받는다(v0.3 작업 1)
        return self.js("(id) => window.__ria.ctx.getLesson(id)", lid)

    def which_item(self, items):
        """지금 화면의 문제가 레슨 items의 몇 번인지 (보기 순서가 섞여 있어도 글자 묶음으로 찾음)"""
        norm = lambda v: " ".join(str(v or "").split())
        q = self.page.inner_text("h1.q")
        shown = sorted(t.strip() for t in self.page.eval_on_selector_all(
            ".opt .opt-text, .chip, #op .line", "es => es.map(e => e.innerText)"))
        code = self.page.eval_on_selector_all("article.item > pre.code", "es => es.map(e => e.innerText).join('')")

        def keyset(x):
            return sorted(str(v).strip() for v in (x.get("options") or x.get("chips") or x.get("lines") or []))
        cands = [i for i, x in enumerate(items) if norm(x.get("q")) == norm(q) and keyset(x) == shown]
        if len(cands) > 1:
            cands = [i for i in cands if norm(items[i].get("code")) == norm(code)] or cands
        assert cands, "unknown item on screen: %r %r" % (q, shown)
        return cands[0]

    def answer_touch(self, it, correct=True):
        t = it["type"]
        if t in ("choice", "check"):
            right = it["options"][it["answer"]]
            target = right if correct else next(o for o in it["options"] if o != right)
            for b in self.page.query_selector_all(".opt"):
                if b.query_selector(".opt-text").inner_text().strip() == target:
                    b.click()
                    break
        elif t == "order":
            lines = list(it["lines"]) if correct else list(it["lines"][1:]) + [it["lines"][0]]
            for line in lines:
                for b in self.page.query_selector_all("#op .line:not([disabled])"):
                    if b.inner_text().strip() == line.strip():
                        b.click()
                        break
        self.page.click("#act")

    def cont(self):
        """결과 창의 「계속」 (입력 보호 시간 뒤)"""
        ok = "ok" in (self.page.get_attribute("#result", "class") or "")
        self.page.wait_for_timeout(GUARD_WAIT)
        self.page.click("#cont")
        return ok

    def play(self, lid, wrong=(), hook=None):
        """레슨 lid를 끝까지 푼다. wrong: 처음 한 번 틀릴 문제 번호들. hook(name, app): 화면별로 부름.
        돌려줌: 본 문제 순서 ["0", "1", ..., "0r", ...]"""
        items = self.lesson(lid)["items"]
        seq = []
        wrong_left = set(wrong)
        first_card = first_touch = True
        for _ in range(60):
            self.page.wait_for_timeout(80)
            if self.page.query_selector(".screen.done"):
                break
            if self.page.query_selector(".card-view"):
                if first_card and hook:
                    hook("lesson-card", self)
                first_card = False
                self.page.click("#act")
                continue
            if not self.page.query_selector("article.item"):
                continue
            idx = self.which_item(items)
            retry = self.page.query_selector(".tag.retry") is not None
            seq.append(str(idx) + ("r" if retry else ""))
            it = items[idx]
            bad = False
            if first_touch and hook:
                hook("touch-item", self)
            first_touch = False
            bad = idx in wrong_left
            wrong_left.discard(idx)
            self.answer_touch(it, correct=not bad)
            self.page.wait_for_selector("#result:not([hidden])")
            ok = self.cont()
            assert ok == (not bad), "item %d (%s) judged ok=%s, expected %s" % (idx, it["type"], ok, not bad)
        self.page.wait_for_selector(".screen.done", timeout=10_000)
        self.page.wait_for_timeout(300)
        return seq

    def result(self):
        return self.js("() => window.__ria.app.params && window.__ria.app.params.result")


# ---------------------------------------------------------------- 화면 측정

MEASURE_JS = r"""() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const sel = 'button, a[href], input:not([type=hidden]), select, textarea, label.btn, [role=button], [role=radio], [role=switch], [role=tab]';
  const items = [];
  for (const e of document.querySelectorAll(sel)) {
    if (e.closest('[hidden]')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;          // .sr로 숨긴 파일 입력 등
    let fixed = false, scroller = false;
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.position === 'fixed' || ps.position === 'sticky') fixed = true;
      if (p !== e && /(auto|scroll)/.test(ps.overflowX) && p.scrollWidth > p.clientWidth + 1) scroller = true;
    }
    const text = (e.getAttribute('aria-label') || e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    const name = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].join('.') : '') + ' "' + text + '"';
    items.push({ name, l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, fixed, scroller });
  }
  return { vw, vh, sw: document.documentElement.scrollWidth, bsw: document.body.scrollWidth, items };
}"""


def measure(app, screen):
    m = app.js(MEASURE_JS)
    problems = []
    if max(m["sw"], m["bsw"]) > m["vw"]:
        problems.append("horizontal scroll: scrollWidth %d > %d" % (max(m["sw"], m["bsw"]), m["vw"]))
    # 가로 스크롤을 시도해서 실제로 움직이는지도 확인
    sx = app.js("() => { window.scrollTo(200, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY); return x; }")
    if sx:
        problems.append("page scrolls horizontally by %dpx" % sx)
    offscreen, small, scrolled = [], [], []
    for it in m["items"]:
        out_h = it["l"] < -1 or it["r"] > m["vw"] + 1
        out_v = it["fixed"] and (it["t"] < -1 or it["b"] > m["vh"] + 1)
        if out_h or out_v:
            (scrolled if it["scroller"] and not out_v else offscreen).append(
                "%s [%d,%d..%d,%d]" % (it["name"], it["l"], it["t"], it["r"], it["b"]))
        if (it["w"] < 43.5 or it["h"] < 43.5) and it["name"] not in TOUCH_EXCEPTIONS:
            small.append("%s %dx%d" % (it["name"], round(it["w"]), round(it["h"])))
    problems += ["offscreen: " + x for x in offscreen]
    return {"screen": screen, "problems": problems, "small": small, "in_scroller": scrolled,
            "errors": list(app.errors), "count": len(m["items"])}


_traversals = {}


def traverse(device):
    """새 저장으로 화면을 차례로 열어 측정하고 캡처한다(기기마다 한 번, 결과는 다시 씀)."""
    if device in _traversals:
        return _traversals[device]
    res = {}
    tag = slug(device)
    with App(device) as a:
        def at(name, app, full=False):
            app.page.wait_for_timeout(150)
            res[name] = measure(app, name)
            app.shot("%s-%s.png" % (tag, name), full=full)
            app.errors.clear()

        at("splash", a)
        a.start()
        at("home", a)
        a.page.click("#continue")
        a.page.wait_for_selector(".screen.lesson")
        a.play("1-1", hook=lambda n, app: at(n, app))
        if a.page.is_visible("#ins-ok"):
            at("install-sheet", a)
            a.dismiss()
        at("done", a, full=False)
        a.page.click("#home")
        a.page.wait_for_selector(".screen.home")
        if a.page.is_visible("#ins-ok"):
            at("install-sheet", a)
            a.dismiss()
        for name in ("badges", "closet", "settings"):
            a.page.click('[data-go="%s"]' % name)
            a.page.wait_for_selector(".screen.%s" % name)
            at(name, a)
        res["_errors_left"] = list(a.errors)
    _traversals[device] = res
    return res


# ---------------------------------------------------------------- 시험

def test_no_overflow():
    fails = []
    for dev in DEVICES:
        res = traverse(dev)
        missing = [s for s in SCREENS if s not in res]
        if missing:
            fails.append("%s: screens not reached %s" % (dev, missing))
        for s, r in res.items():
            if s.startswith("_"):
                if r:
                    fails.append("%s: console errors %s" % (dev, r))
                continue
            for p in r["problems"]:
                fails.append("%s/%s: %s" % (dev, s, p))
            for e in r["errors"]:
                fails.append("%s/%s: %s" % (dev, s, e))
            if r["in_scroller"]:
                print("    note %s/%s: inside horizontal scroller (partly hidden by design): %s" % (dev, s, r["in_scroller"]))
        print("    %s: %s" % (dev, ", ".join("%s(%d)" % (s, r["count"]) for s, r in res.items() if not s.startswith("_"))))
    assert not fails, "\n".join(fails)


def test_touch_targets():
    fails = []
    for dev in DEVICES:
        res = traverse(dev)
        for s, r in res.items():
            if not s.startswith("_") and r["small"]:
                fails.append("%s/%s: %s" % (dev, s, "; ".join(r["small"])))
    assert not fails, "touch targets < 44x44:\n" + "\n".join(fails)


def _n_items(a, lid):
    return len(a.lesson(lid)["items"])


def test_first_lesson():
    with App("iPhone 17") as a:
        a.start()
        assert "开始第一课" in a.page.inner_text("#continue")
        a.page.click("#continue")
        seq = a.play("1-1")
        n = _n_items(a, "1-1")
        assert seq == [str(i) for i in range(n)], seq
        xp_tile = a.page.inner_text(".tile.xp b")
        a.shot("first-lesson-done.png", full=True)
        r = a.result()
        s = a.save()
        print("    done tiles: %s | result xp=%s bytes=%s perfect=%s" % (
            a.page.inner_text(".tiles").replace("\n", " "), r["xp"], r["totalBytes"], r["perfect"]))
        assert xp_tile == "+15", xp_tile
        assert r["xp"] == 15 and r["perfect"] and r["firstTime"], r
        assert s["completed_lessons"] == ["1-1"], s["completed_lessons"]
        a.dismiss()
        assert not a.errors, a.errors


def test_wrong_then_retry():
    with App("iPhone 17") as a:
        a.start()
        a.page.click("#continue")
        seq = a.play("1-1", wrong=(0,))
        r = a.result()
        a.shot("retry-done.png", full=True)
        acc = a.page.inner_text(".tile.acc b")
        print("    sequence %s, accuracy tile %s, perfect %s" % (seq, acc, r["perfect"]))
        n = _n_items(a, "1-1")
        # 0번을 틀림 → 본 문제 뒤에 0번을 다시, 그다음 이해도 확인(마지막)
        assert seq == [str(i) for i in range(n - 1)] + ["0r", str(n - 1)], seq
        assert r["perfect"] is False and r["xp"] == 10, r
        assert acc != "100%", acc
        assert "无失误完成" not in a.page.inner_text(".screen.done")
        s = a.save()
        assert s["grading_results"]["1-1"]["perfect"] is False, s["grading_results"]
        a.dismiss()
        assert not a.errors, a.errors


def test_status_after_milestone():
    seed = {"saveVer": 1, "xp": 100, "bytes": 0, "completed_lessons": [],
            "streak": {"days": 6, "best": 6, "lastGoalDate": today(1), "todayDate": today(), "todayXp": 0},
            "settings": {"sound": True, "dailyGoal": 10, "name": ""}}
    fails = []
    # 가) 레슨 완료로 7일 → 축하 창
    with App("iPhone 17", save=seed) as a:
        a.start()
        assert a.page.inner_text(".status .stat.flame b") == "6"
        a.page.click("#continue")
        a.play("1-1")
        a.page.wait_for_selector(".celebrate", timeout=3000)
        bars = a.js("() => [...document.querySelectorAll('.status .stat.flame b')].map(e => e.textContent)")
        tile = a.page.inner_text(".tile.flame b")
        a.shot("milestone-lesson.png")
        print("    lesson path: status bars behind overlay %s, done tile %s, overlay %r" % (
            bars, tile, a.page.inner_text(".celebrate .cel-title")))
        if any(b != "7" for b in bars):
            fails.append("lesson path: status bar shows %s while overlay open" % bars)
        if tile != "7":
            fails.append("lesson path: done tile %s" % tile)
        a.page.wait_for_timeout(GUARD_WAIT)
        a.page.click("#cel-ok")
        a.page.wait_for_selector(".celebrate", state="detached")
        a.dismiss()
        a.page.click("#home")
        a.page.wait_for_selector(".screen.home")
        a.dismiss()
        home = a.page.inner_text(".status .stat.flame b")
        if home != "7":
            fails.append("lesson path: home shows %s" % home)
        if a.errors:
            fails.append("lesson path errors: %s" % a.errors)
    # 나) 설정에서 목표를 낮춰 7일 → 축하 창 (상태 줄이 같은 화면에 있음; 실행 기록 작업 9 남은 경미)
    seed2 = dict(seed, streak=dict(seed["streak"], todayXp=12), settings=dict(seed["settings"], dailyGoal=20))
    with App("iPhone 17", save=seed2) as a:
        a.start()
        a.page.click('[data-go="settings"]')
        a.page.wait_for_selector(".screen.settings")
        a.page.click('[data-g="10"]')
        a.page.wait_for_selector(".celebrate", timeout=3000)
        a.page.wait_for_timeout(100)
        bars = a.js("() => [...document.querySelectorAll('.status .stat.flame b')].map(e => e.textContent)")
        a.shot("milestone-settings.png")
        print("    settings path: status bars behind overlay %s" % bars)
        if not bars or any(b != "7" for b in bars):
            fails.append("settings path: status bar shows %s while overlay open" % bars)
        a.page.wait_for_timeout(GUARD_WAIT)
        a.page.click("#cel-ok")
        a.page.wait_for_selector(".celebrate", state="detached")
        after = a.page.inner_text(".status .stat.flame b")
        if after != "7":
            fails.append("settings path: after closing shows %s" % after)
        if a.errors:
            fails.append("settings path errors: %s" % a.errors)
    assert not fails, "\n".join(fails)


# ---------------------------------------------------------------- 해치와 한국어 v0.1

def test_ipad_zoomed():
    zoom = "() => getComputedStyle(document.documentElement).zoom"
    for dev, want in (("iPad Pro 11", "1.3"), ("iPad Pro 11 landscape", "1.3"), ("iPhone 17", "1")):
        with App(dev) as a:
            got = a.js(zoom)
            print("    %s: zoom %s" % (dev, got))
            assert got == want, (dev, got)


def test_no_text_inputs():
    q = "() => document.querySelectorAll('input:not([type=hidden]):not([type=file]), textarea, [contenteditable]').length"
    with App("iPhone 17") as a:
        a.start()
        a.page.click("#continue")
        seen = []
        a.play("1-1", hook=lambda n, app: seen.append((n, app.js(q))))
        seen.append(("done", a.js(q)))
        print("    inputs per screen: %s" % seen)
        assert all(n == 0 for _, n in seen), seen


def _longest_meaning_lesson():
    """가장 긴 중국어 보기가 든 레슨 id와 그 보기"""
    best = (0, None, None)
    for f in sorted(os.listdir(os.path.join(ROOT, "data", "lessons"))):
        text = open(os.path.join(ROOT, "data", "lessons", f), encoding="utf-8").read()
        data = json.loads(text.split("export const LESSONS = ", 1)[1].rstrip().rstrip(";"))
        for l in data:
            for it in l["items"]:
                for o in it.get("options", []):
                    if len(o) > best[0]:
                        best = (len(o), l["id"], o)
    return best[1], best[2]


def test_longest_meaning_fits():
    lid, text = _longest_meaning_lesson()
    fits = """(t) => [...document.querySelectorAll('.opt')].filter(b => b.innerText.includes(t))
        .map(b => ({ sw: b.scrollWidth, cw: b.clientWidth, right: b.getBoundingClientRect().right, vw: innerWidth }))"""
    with App("iPhone 17e") as a:
        a.start()
        a.js("(id) => window.__ria.ctx.show('lesson', { id })", lid)
        found = []
        items = a.lesson(lid)["items"]
        for _ in range(40):
            a.page.wait_for_timeout(80)
            if a.page.query_selector(".screen.done"):
                break
            if a.page.query_selector(".card-view"):
                a.page.click("#act")
                continue
            if not a.page.query_selector("article.item"):
                continue
            found += a.js(fits, text)
            if found:
                a.shot("longest-meaning.png")
                break
            a.answer_touch(items[a.which_item(items)])
            a.page.wait_for_selector("#result:not([hidden])")
            a.cont()
        print("    %s %r: %s" % (lid, text, found))
        assert found, "longest meaning not shown as an option in " + lid
        assert all(f["sw"] <= f["cw"] + 1 and f["right"] <= f["vw"] + 1 for f in found), found
        assert not a.errors, a.errors


def test_no_code_font():
    """음절 카드·보기에 코드(고정폭) 글꼴이 쓰이지 않음"""
    q = "() => [...document.querySelectorAll('.mono')].filter(e => e.offsetParent).length"
    with App("iPhone 17") as a:
        a.start()
        a.page.click("#continue")
        seen = []
        items = a.lesson("1-1")["items"]
        for _ in range(40):
            a.page.wait_for_timeout(80)
            if a.page.query_selector(".screen.done"):
                break
            if a.page.query_selector(".card-view"):
                a.page.click("#act")
                continue
            if not a.page.query_selector("article.item"):
                continue
            it = items[a.which_item(items)]
            seen.append((it["type"], a.js(q)))
            a.answer_touch(it)
            a.page.wait_for_selector("#result:not([hidden])")
            a.cont()
        print("    mono per item: %s" % seen)
        assert any(t == "order" for t, _ in seen), seen
        assert all(n == 0 for _, n in seen), seen


def test_exam_done_has_no_empty_summary():
    with App("iPhone 17") as a:
        a.start()
        exam = a.js("() => window.__ria.ctx.chapters[0].lessons.find((l) => l.isExam).id")
        a.js("(id) => window.__ria.ctx.show('lesson', { id })", exam)
        a.page.wait_for_selector("article.item, .card-view")
        a.play(exam)
        n = a.js("() => document.querySelectorAll('.panel.summary').length")
        print("    %s done: summary panels %d" % (exam, n))
        assert n == 0


def _lesson_ids(chapters):
    ids = []
    for n in chapters:
        text = open(os.path.join(ROOT, "data", "lessons", "ch%d.js" % n), encoding="utf-8").read()
        ids += [l["id"] for l in json.loads(text.split("export const LESSONS = ", 1)[1].rstrip().rstrip(";"))]
    return ids


def test_vol2_opens_after_vol1():
    done = _lesson_ids(range(1, 11))
    seed = {"saveVer": 2, "xp": 3000, "completed_lessons": done, "current_lesson": "11-1", "current_chapter": 11}
    with App("iPhone 17", save=seed) as a:
        a.start()
        btn = a.page.inner_text("#continue")
        titles = a.js("() => [...document.querySelectorAll('.chapter-title')].map(e => e.innerText)")
        print("    continue %r, chapter titles shown %s" % (btn, titles))
        assert "11-1" in btn and "继续学习" in btn, btn
        assert any("第二册 第1课" in t for t in titles), titles
        a.page.click("#continue")
        a.play("11-1")
        assert "11-1" in a.save()["completed_lessons"]
        a.dismiss()
        assert not a.errors, a.errors


def test_ria_save_coexists():
    ria = json.dumps({"saveVer": 2, "xp": 777, "completed_lessons": ["1-1", "1-2"]})
    with App("iPhone 17", extra={RIA_KEY: ria}) as a:
        a.start()
        assert a.page.inner_text(".status .stat.xp b") == "0", "Ria XP leaked into haechi app"
        a.page.click("#continue")
        a.play("1-1")
        a.dismiss()
        a.page.click("#home")
        a.page.wait_for_selector(".screen.home")
        after = a.js("(k) => localStorage.getItem(k)", RIA_KEY)
        assert after == ria, after
        assert a.save()["completed_lessons"] == ["1-1"]


def _to_settings(a):
    a.page.click('[data-go="settings"]')
    a.page.wait_for_selector(".screen.settings")


def test_zh_tw_opens_hant():
    with App("iPhone 17", locale="zh-TW") as a:
        assert a.page.url.endswith("/zh-hant/"), a.page.url
        assert a.js("document.documentElement.lang") == "zh-Hant"
        a.start()
        assert "開始第一課" in a.page.inner_text("#continue"), a.page.inner_text("#continue")
        a.shot("hant-home.png")
        assert not a.errors, a.errors


def test_lang_buttons():
    with App("iPhone 17", locale="zh-TW") as a:
        a.start()
        _to_settings(a)
        btns = a.js("""() => [...document.querySelectorAll('[role=radiogroup] [data-lang]')].map(b => {
            const r = b.getBoundingClientRect();
            return { lang: b.dataset.lang, text: b.innerText.trim(), on: b.getAttribute('aria-checked'), w: r.width, h: r.height }; })""")
        print("    lang buttons %s" % btns)
        assert [b["lang"] for b in btns] == ["hans", "hant"], btns
        assert [b["text"] for b in btns] == ["簡體", "繁體"], btns  # 번체판은 빌드 변환으로 简体→簡體
        assert [b["on"] for b in btns] == ["false", "true"], btns
        assert all(b["w"] >= 44 and b["h"] >= 44 for b in btns), btns
        a.shot("hant-settings.png")


def test_switch_back_to_hans_keeps_progress():
    seed = {"saveVer": 2, "xp": 120, "completed_lessons": _lesson_ids([1]), "current_lesson": "2-1", "current_chapter": 2}
    with App("iPhone 17", save=seed, locale="zh-TW") as a:
        base = env()["url"]
        assert a.page.url.endswith("/zh-hant/"), a.page.url
        a.start()
        assert a.page.inner_text(".status .stat.xp b") == "120"
        _to_settings(a)
        a.page.click('[data-lang="hans"]')
        a.page.wait_for_url(base)
        a.page.wait_for_selector(".screen.splash #go")
        a.start()
        assert a.js("document.documentElement.lang") == "zh-Hans"
        btn = a.page.inner_text("#continue")
        assert "继续学习" in btn and "2-1" in btn, btn
        assert a.page.inner_text(".status .stat.xp b") == "120"
        a.page.goto(base)
        a.page.wait_for_selector(".screen.splash #go")
        assert a.page.url == base and a.js("document.documentElement.lang") == "zh-Hans", a.page.url
        assert not a.errors, a.errors


def test_hant_lesson_playable():
    with App("iPhone 17", locale="zh-TW") as a:
        assert a.page.url.endswith("/zh-hant/"), a.page.url
        a.start()
        a.page.click("#continue")
        a.play("1-1")
        assert a.save()["completed_lessons"] == ["1-1"]
        a.dismiss()
        assert not a.errors, a.errors


def main():
    only = sys.argv[1:]
    tests = [(n, f) for n, f in globals().items() if n.startswith("test_") and callable(f) and (not only or n in only)]
    t0 = time.time()
    env()
    print("build: " + _env["build"].replace("\n", " | "))
    fails = 0
    for name, f in tests:
        t = time.time()
        try:
            f()
            print("PASS %s (%.0fs)" % (name, time.time() - t))
        except Exception as e:  # noqa: BLE001
            fails += 1
            print("FAIL %s (%.0fs) - %s: %s" % (name, time.time() - t, type(e).__name__, str(e)[:3000]))
    print("%d passed, %d failed (%.0fs). screenshots: %s" % (len(tests) - fails, fails, time.time() - t0, OUT))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
