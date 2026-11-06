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

  function other(cur) { return cur === "hans" ? "zh-hant/" : "../"; }

  function switchLang(to) {
    try { window.localStorage.setItem(KEY, to); } catch (e) { /* 기억 못 해도 이번엔 넘어감 */ }
    var cur = currentLang(document);
    if (to !== cur) window.location.href = other(cur);
  }

  window.haechiLang = { pickLang: pickLang, currentLang: currentLang, switchLang: switchLang };

  // 배포판(ria-version 표시가 있는 빌드)에서만 넘어간다. 개발 서버엔 다른 판이 없다.
  if (document.querySelector('meta[name="ria-version"]')) {
    var want = pickLang({ saved: readSaved(), languages: window.navigator.languages });
    var cur = currentLang(document);
    if (want !== cur) window.location.replace(other(cur));
  }
})();
