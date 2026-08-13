import { fetchJson } from "./http.mjs";

// Word-boundary match so "voi" doesn't hit inside "void"/"voice" etc.
const VOI_WORD_RE = /\bvoi\b/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch posts from X's official v2 recent-search endpoint. Unlike every other
 * source here there is no key-less path — X retired free search access, so
 * this needs a bearer token from a paid API plan and skips itself entirely
 * when one isn't configured.
 */
export async function fetchXPosts(config = {}) {
  if (config.enabled === false) return [];
  const tokenEnvVar = config.bearerTokenEnvVar || "X_BEARER_TOKEN";
  const token = process.env[tokenEnvVar];
  if (!token) {
    console.warn(
      `[x] no ${tokenEnvVar} set — X search has no free tier, so this source is skipped until a paid-plan bearer token is provided.`
    );
    return [];
  }

  const queries = config.queries?.length ? config.queries : ["Voi scooter"];
  const maxResults = config.maxResults || 25;

  const results = [];
  for (const q of queries) {
    const params = new URLSearchParams({
      query: q,
      max_results: String(maxResults),
      "tweet.fields": "created_at,lang",
      expansions: "author_id",
      "user.fields": "username",
    });
    try {
      const json = await fetchJson(
        `https://api.twitter.com/2/tweets/search/recent?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Authors come back once each in `includes`, keyed by the id the tweets
      // reference — join them back so we can show a handle, not a numeric id.
      const usernames = new Map(
        (json?.includes?.users || []).map((u) => [u.id, u.username])
      );
      for (const t of json?.data || []) {
        if (!t?.id) continue;
        const text = (t.text || "").trim();
        if (!VOI_WORD_RE.test(text)) continue;
        const username = usernames.get(t.author_id);
        results.push({
          id: `x-${t.id}`,
          source: "X",
          market: username ? `@${username}` : "X",
          dateRaw: t.created_at || null,
          quote: text,
          url: username ? `https://x.com/${username}/status/${t.id}` : null,
        });
      }
    } catch (err) {
      console.warn(`[x] query "${q}" failed: ${err.message}`);
    }
    await sleep(300); // paid tiers still rate-limit per 15-minute window
  }
  return dedupeById(results);
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
