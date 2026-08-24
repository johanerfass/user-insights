import { fetchJson } from "./http.mjs";

import { mentionsVoi } from "./relevance.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch posts from Bluesky's search. The public AppView answers searchPosts
 * with 403 unless the request carries a session, so log in first and search
 * with the returned JWT. Use an app password (Settings → App Passwords), not
 * the account password — it's scoped and revocable.
 */
export async function fetchBlueskyPosts(config = {}) {
  if (config.enabled === false) return [];
  const identifierEnvVar = config.identifierEnvVar || "BLUESKY_IDENTIFIER";
  const appPasswordEnvVar = config.appPasswordEnvVar || "BLUESKY_APP_PASSWORD";
  const identifier = process.env[identifierEnvVar];
  const appPassword = process.env[appPasswordEnvVar];
  if (!identifier || !appPassword) {
    console.warn(
      `[bluesky] no ${identifierEnvVar}/${appPasswordEnvVar} set — search returns 403 without a session, so this source is skipped.`
    );
    return [];
  }

  let accessJwt;
  try {
    const session = await fetchJson(
      "https://bsky.social/xrpc/com.atproto.server.createSession",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password: appPassword }),
      }
    );
    accessJwt = session?.accessJwt;
  } catch (err) {
    console.warn(`[bluesky] login failed: ${err.message}`);
    return [];
  }
  if (!accessJwt) {
    console.warn("[bluesky] login returned no access token — skipping this source.");
    return [];
  }

  const queries = config.queries?.length ? config.queries : ["Voi scooter"];
  const limit = config.limit || 25;

  const results = [];
  for (const q of queries) {
    const params = new URLSearchParams({ q, limit: String(limit) });
    try {
      const json = await fetchJson(
        `https://bsky.social/xrpc/app.bsky.feed.searchPosts?${params}`,
        { headers: { Authorization: `Bearer ${accessJwt}` } }
      );
      for (const p of json?.posts || []) {
        const text = (p?.record?.text || "").trim();
        if (!mentionsVoi(text, { language: p?.record?.langs?.[0] })) continue;
        const handle = p.author?.handle;
        // The web URL uses the record key — the last segment of the at:// URI.
        const rkey = (p.uri || "").split("/").pop();
        results.push({
          id: `bluesky-${p.cid || p.uri}`,
          source: "Bluesky",
          market: handle ? `@${handle}` : "Bluesky",
          dateRaw: p.record?.createdAt || null,
          quote: text,
          url: handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : null,
        });
      }
    } catch (err) {
      console.warn(`[bluesky] query "${q}" failed: ${err.message}`);
    }
    await sleep(300);
  }
  return dedupeById(results);
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
