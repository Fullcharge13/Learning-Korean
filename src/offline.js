// 오프라인 준비 판정: 서비스 작업자가 다루고, 이 앱의 게임 저장본에 장 파일이 모두 있으면 준비.
// 리아와 파이썬과 같은 주소(github.io)에 올라가므로 저장본 이름 접두를 따로 둔다.

export const GAME_CACHE_PREFIX = "haechi-game-";

// 저장된 주소가 장 파일 이름(lessons/chN-xxxxxxxx.json)으로 끝나는지. 앞 글자가 /여야 같은 파일
function endsWithFile(url, rel) {
  const path = String(url).split(/[?#]/)[0];
  return path === rel || path.endsWith("/" + rel);
}

/**
 * @param {{ controlled: boolean, cacheNames: string[] | null, urlsByCache: Record<string, string[]> | null,
 *           chapterFiles?: string[] }} o
 * @returns {{ ready: boolean, missing: string[], reason: "ok" | "no-controller" | "no-caches" | "missing-chapters" }}
 */
export function offlineStatus({ controlled, cacheNames, urlsByCache, chapterFiles = [] }) {
  if (!controlled) return { ready: false, missing: chapterFiles.slice(), reason: "no-controller" };
  const games = Array.isArray(cacheNames) && urlsByCache ? cacheNames.filter((n) => String(n).startsWith(GAME_CACHE_PREFIX)) : [];
  if (!games.length) return { ready: false, missing: chapterFiles.slice(), reason: "no-caches" };
  const urls = games.flatMap((n) => urlsByCache[n] || []);
  const missing = chapterFiles.filter((rel) => !urls.some((u) => endsWithFile(u, rel)));
  return { ready: missing.length === 0, missing, reason: missing.length ? "missing-chapters" : "ok" };
}

/** 브라우저에서 판정에 필요한 값을 모은다. caches가 없거나 막혀 있으면 「준비 안 됨」 쪽으로 */
export async function collectOfflineStatus(chapterFiles = []) {
  const controlled = !!(typeof navigator !== "undefined" && navigator.serviceWorker && navigator.serviceWorker.controller);
  if (typeof caches === "undefined") return offlineStatus({ controlled, cacheNames: null, urlsByCache: null, chapterFiles });
  try {
    const cacheNames = (await caches.keys()).filter((n) => n.startsWith(GAME_CACHE_PREFIX));
    const urlsByCache = {};
    for (const name of cacheNames) urlsByCache[name] = (await (await caches.open(name)).keys()).map((r) => r.url);
    return offlineStatus({ controlled, cacheNames, urlsByCache, chapterFiles });
  } catch {
    return offlineStatus({ controlled, cacheNames: null, urlsByCache: null, chapterFiles });
  }
}
