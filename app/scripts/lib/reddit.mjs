import { fetchJson } from "./http.mjs";

// Word-boundary match so "voi" doesn't hit inside "void"/"voice" etc.
const VOI_WORD_RE = /\bvoi\b/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch candidate posts from Reddit's public, unauthenticated search JSON
 * endpoint. Requires a descriptive User-Agent (Reddit throttles/blocks the
 * default one) but no API key.
 */
export async function fetchRedditPosts(config = {}) {
  if (config.enabled === false) return [];
  const queries = config.queries?.length ? config.queries : ["Voi scooter", "Voi ebike"];
  const limit = config.limit || 50;
  const userAgent = config.userAgent || "voi-rider-signal-bot/1.0";
  const subreddits = config.subreddits?.length ? config.subreddits : [null];

  const results = [];
  for (const sub of subreddits) {
    for (const q of queries) {
      const base = sub
        ? `https://www.reddit.com/r/${encodeURIComponent(sub)}/search.json`
        : `https://www.reddit.com/search.json`;
      const params = new URLSearchParams({
        q,
        sort: "new",
        limit: String(limit),
        restrict_sr: sub ? "on" : "off",
      });
      try {
        const json = await fetchJson(`${base}?${params}`, {
          headers: { "User-Agent": userAgent },
        });
        const children = json?.data?.children || [];
        for (const c of children) {
          const d = c.data;
          if (!d) continue;
          const text = `${d.title || ""}\n${d.selftext || ""}`;
          if (!VOI_WORD_RE.test(text)) continue;
          results.push({
            id: `reddit-${d.id}`,
            source: "Reddit",
            market: d.subreddit ? `r/${d.subreddit}` : "Reddit",
            dateRaw: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
            quote: (d.selftext && d.selftext.trim()) || d.title || "",
            url: d.permalink ? `https://www.reddit.com${d.permalink}` : null,
          });
        }
      } catch (err) {
        console.warn(
          `[reddit] query "${q}"${sub ? ` in r/${sub}` : ""} failed: ${err.message}`
        );
      }
      await sleep(300); // be polite to Reddit's rate limits across queries
    }
  }
  return dedupeById(results);
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
