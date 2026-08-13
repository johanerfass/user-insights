const DEFAULT_SOURCE_LABELS = ["Trustpilot", "App Store", "Google Play", "Reddit"];

export function formatDateLabel(date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatPostDateLabel(dateRaw, now) {
  if (!dateRaw) return "Recent";
  const d = new Date(dateRaw);
  if (Number.isNaN(d.getTime())) return "Recent";
  const days = (now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000);
  if (days <= 3) return "Recent";
  return formatDateLabel(d);
}

/**
 * Builds the board's data.json contract from classified, windowed posts.
 * `previousData` (the prior run's output) is used only to compute theme
 * trend deltas — everything else is derived fresh from `posts`.
 */
export function buildBoardData({ posts, windowLabel, previousData, rotateSeconds, now, allSourceLabels }) {
  const nowDate = now ? new Date(now) : new Date();

  const sorted = [...posts].sort((a, b) => {
    const ta = a.dateRaw ? Date.parse(a.dateRaw) : 0;
    const tb = b.dateRaw ? Date.parse(b.dateRaw) : 0;
    return tb - ta;
  });

  const sentimentSummary = { negative: 0, mixed: 0, positive: 0 };
  for (const p of sorted) {
    if (p.sentiment === "Negative") sentimentSummary.negative++;
    else if (p.sentiment === "Positive") sentimentSummary.positive++;
    else sentimentSummary.mixed++;
  }

  const themeCounts = new Map();
  for (const p of sorted) {
    for (const theme of p.themes || []) {
      themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
    }
  }
  const previousThemeCounts = new Map((previousData?.themes || []).map((t) => [t.label, t.count]));
  const themes = [...themeCounts.entries()]
    .map(([label, count]) => {
      const prev = previousThemeCounts.get(label) ?? 0;
      const delta = count - prev;
      const trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
      return { label, count, trend, delta };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const sourceCounts = new Map();
  for (const p of sorted) sourceCounts.set(p.source, (sourceCounts.get(p.source) || 0) + 1);
  const labels = allSourceLabels?.length ? allSourceLabels : DEFAULT_SOURCE_LABELS;
  const sources = labels.map((label) => ({ label, count: sourceCounts.get(label) || 0 }));

  return {
    generatedAt: nowDate.toISOString(),
    checkedLabel: formatDateLabel(nowDate),
    windowLabel,
    rotateSeconds: rotateSeconds || 12,
    posts: sorted.map((p) => ({
      id: p.id,
      source: p.source,
      market: p.market || "—",
      date: formatPostDateLabel(p.dateRaw, nowDate),
      sentiment: p.sentiment,
      quote: p.quote,
      themes: p.themes,
      url: p.url || null,
    })),
    sentimentSummary,
    themes,
    sources,
  };
}
