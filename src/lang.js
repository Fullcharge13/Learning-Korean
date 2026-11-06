// 간체판(/)과 대만식 번체판(/zh-hant/) 중 어느 쪽을 열지 정한다. 앱보다 먼저, 머리에서 도는 일반 스크립트.
// 빌드가 이 파일을 index.html에 그대로 넣고, 번체판은 OpenCC로 통째로 변환한다.
// 지금 판은 <html lang>으로 안다. 그래서 이 파일에는 간체 언어 표기를 글자로 쓰지 않는다(빌드가 번체판에서 바꿈).
(function () {
  var KEY = "haechi-korean.lang";
  var TRAD = /^zh-(tw|hk|mo|hant)\b/i;

  function readSaved() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function pickLang(o) {
    var saved = o && o.saved;
    if (saved === "hans" || saved === "hant") return saved;
    var list = (o && o.languages) || [];
    for (var i = 0; i < list.length; i++) {
      if (/^zh\b/i.test(list[i])) return TRAD.test(list[i]) ? "hant" : "hans";
    }
    return "hans";
  }

  function currentLang(doc) {
    return /^zh-hant/i.test(String((doc && doc.documentElement && doc.documentElement.lang) || "")) ? "hant" : "hans";
  }

  // 주소로 본 판과 그 판의 주소(절대 경로). 상대 주소(zh-hant/, ../)는 잘못 받은 페이지에서 zh-hant/zh-hant/… 고리를 만든다.
  function pathLang(path) { return /\/zh-hant\//.test(path) ? "hant" : "hans"; }
  function target(to) {
    var base = String(window.location.pathname).replace(/zh-hant\/.*$|[^\/]*$/, "");
    return to === "hant" ? base + "zh-hant/" : base;
  }

  function switchLang(to) {
    try { window.localStorage.setItem(KEY, to); } catch (e) { /* 기억 못 해도 이번엔 넘어감 */ }
    if (to !== currentLang(document)) window.location.href = target(to);
  }

  window.haechiLang = { pickLang: pickLang, currentLang: currentLang, switchLang: switchLang };

  // 배포판(ria-version 표시가 있는 빌드)에서만 넘어간다. 개발 서버엔 다른 판이 없다.
  if (document.querySelector('meta[name="ria-version"]')) {
    var want = pickLang({ saved: readSaved(), languages: window.navigator.languages });
    // 주소가 이미 원하는 판인데 글자판이 다르면 저장본이 다른 판 페이지를 준 것: 넘어가도 소용없으니 그대로 둔다
    if (want !== currentLang(document) && want !== pathLang(window.location.pathname)) window.location.replace(target(want));
  }
})();
