/**
 * Fetch Google Play reviews. There is no free official Google Play reviews
 * API, so this uses the community-maintained `google-play-scraper` package,
 * which reads the same public review data shown on a Play Store listing
 * page. It's an optional dependency: if it isn't installed, this source is
 * skipped rather than failing the whole run.
 */
export async function fetchGooglePlayReviews(config = {}) {
  if (config.enabled === false || !config.appId) return [];

  let gplay;
  try {
    const mod = await import("google-play-scraper");
    gplay = mod.default || mod;
  } catch {
    console.warn(
      "[googleplay] optional dependency 'google-play-scraper' is not installed — skipping this source. Run `npm install google-play-scraper` to enable it."
    );
    return [];
  }

  const countries = config.countries?.length ? config.countries : ["us"];
  const results = [];
  for (const country of countries) {
    try {
      const res = await gplay.reviews({
        appId: config.appId,
        country,
        sort: gplay.sort?.NEWEST,
        num: config.num || 50,
      });
      const list = res?.data || res || [];
      for (const r of list) {
        results.push({
          id: `googleplay-${country}-${r.id}`,
          source: "Google Play",
          market: country.toUpperCase(),
          dateRaw: r.date ? new Date(r.date).toISOString() : null,
          quote: (r.text || "").trim(),
          rating: r.score ?? null,
          url: r.url || null,
        });
      }
    } catch (err) {
      console.warn(`[googleplay] ${country} failed: ${err.message}`);
    }
  }
  return results;
}
