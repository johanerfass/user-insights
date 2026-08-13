const DEFAULT_CANDIDATES = [
  { label: "Last week", days: 7 },
  { label: "Last month", days: 30 },
  { label: "Last 6 weeks", days: 42 },
  { label: "Last quarter", days: 90 },
];

/**
 * Picks the narrowest lookback window that still has enough posts to be
 * worth a carousel — widening from "last week" up to "last quarter" as
 * volume requires, per the original ask ("last week/month depending on the
 * amount of posts").
 */
export function pickWindow(posts, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const minPosts = options.minPostsForWindow ?? 5;
  const candidates = options.candidates?.length ? options.candidates : DEFAULT_CANDIDATES;

  for (let i = 0; i < candidates.length; i++) {
    const { label, days } = candidates[i];
    const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
    const filtered = posts.filter((p) => {
      const t = p.dateRaw ? Date.parse(p.dateRaw) : NaN;
      return Number.isNaN(t) ? true : t >= cutoff; // keep undated posts rather than silently dropping them
    });
    const isLast = i === candidates.length - 1;
    if (filtered.length >= minPosts || isLast) {
      return { windowLabel: label, posts: filtered };
    }
  }
  return { windowLabel: candidates[candidates.length - 1].label, posts };
}
