import { fetchJson } from "./http.mjs";

/**
 * Fetch App Store reviews via Apple's public, unauthenticated RSS customer
 * reviews feed. No API key needed, but it's scoped per storefront (country)
 * and only returns a limited number of the most recent reviews per page.
 */
export async function fetchAppStoreReviews(config = {}) {
  if (config.enabled === false || !config.appId) return [];
  const countries = config.countries?.length ? config.countries : ["us"];
  const pages = config.pages || 1;
  const results = [];

  for (const country of countries) {
    for (let page = 1; page <= pages; page++) {
      const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${config.appId}/sortby=mostrecent/json`;
      try {
        const json = await fetchJson(url);
        const entries = json?.feed?.entry;
        if (!Array.isArray(entries)) continue;
        for (const e of entries) {
          // The first entry in the feed is the app's own metadata, not a
          // review — it has no `content`/`id` review fields.
          if (!e?.content?.label || !e?.id?.label) continue;
          results.push({
            id: `appstore-${country}-${e.id.label}`,
            source: "App Store",
            market: country.toUpperCase(),
            dateRaw: e.updated?.label || null,
            quote: e.content.label.trim(),
            rating: e["im:rating"]?.label ? Number(e["im:rating"].label) : null,
            url: null,
          });
        }
      } catch (err) {
        console.warn(`[appstore] ${country} page ${page} failed: ${err.message}`);
      }
    }
  }
  return results;
}
