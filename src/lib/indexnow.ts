// IndexNow lets Bing/Yandex/Seznam (and other participating search engines)
// crawl a changed URL within minutes instead of waiting for their next
// scheduled sitemap crawl. The key just proves we own the domain — it's
// meant to be public, served at /{INDEXNOW_KEY}.txt (see public/ folder).
// Google doesn't consume IndexNow submissions; for Google, freshness comes
// from the sitemap + fast server responses + proper structured data instead.
const INDEXNOW_KEY = "f0d7e5c4e370c19474aeb0bfcc0846e8";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function submitToIndexNow(paths: string | string[]) {
  const list = Array.isArray(paths) ? paths : [paths];
  const urlList = list.map((path) => `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`);

  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(siteUrl).host,
        key: INDEXNOW_KEY,
        keyLocation: `${siteUrl}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });
  } catch {
    // Best-effort ping — must never block or fail the actual admin action.
  }
}
