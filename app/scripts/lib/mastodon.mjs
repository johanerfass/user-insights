import { fetchJson } from "./http.mjs";
import { stripHtml } from "./rss.mjs";

// Word-boundary match so "voi" doesn't hit inside "void"/"voice" etc.
const VOI_WORD_RE = /\bvoi\b/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch public posts from Mastodon's per-instance hashtag timelines. The
 * search API (/api/v2/search) is not usable here: unauthenticated it returns
 * an empty status list, whereas tag timelines are public and key-less. The
 * trade-off is that we only see posts that were actually tagged, so cast a
 * wide net with `hashtags` and let the Voi filter below do the narrowing.
 */
export async function fetchMastodonPosts(config = {}) {
  if (config.enabled === false) return [];
  const instances = config.instances?.length ? config.instances : ["mastodon.social"];
  const hashtags = config.hashtags?.length
    ? config.hashtags
    : ["escooter", "voi", "micromobility"];
  const limit = config.limit || 40;

  const results = [];
  for (const instance of instances) {
    for (const tag of hashtags) {
      const url = `https://${instance}/api/v1/timelines/tag/${encodeURIComponent(
        tag
      )}?limit=${limit}`;
      try {
        const statuses = await fetchJson(url);
        for (const s of Array.isArray(statuses) ? statuses : []) {
          if (!s?.id) continue;
          const text = stripHtml(s.content || "");
          if (!VOI_WORD_RE.test(text)) continue;
          results.push({
            // Status ids are only unique within an instance.
            id: `mastodon-${instance}-${s.id}`,
            source: "Mastodon",
            market: s.account?.acct ? `@${s.account.acct}` : instance,
            dateRaw: s.created_at || null,
            quote: text,
            url: s.url || null,
          });
        }
      } catch (err) {
        console.warn(`[mastodon] #${tag} on ${instance} failed: ${err.message}`);
      }
      await sleep(300); // instances are volunteer-run; don't hammer them
    }
  }
  return dedupeById(results);
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
