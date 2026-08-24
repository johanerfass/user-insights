import test from "node:test";
import assert from "node:assert/strict";
import { runChecks } from "../lib/health-rules.mjs";

const CONFIG = {
  reddit: { enabled: true },
  googlePlay: { enabled: true },
  news: { enabled: true },
  mastodon: { enabled: false },
};

function post(overrides = {}) {
  return {
    id: `googleplay-${Math.random().toString(36).slice(2)}`,
    source: "Google Play",
    market: "GB",
    date: "24 Aug 2026",
    sentiment: "Mixed",
    quote: `“${Math.random().toString(36).slice(2)} decent ride”`,
    themes: ["General feedback"],
    url: "https://play.google.com/store/apps/details?id=io.voiapp.voi",
    ...overrides,
  };
}

function board(posts, overrides = {}) {
  const counts = { negative: 0, mixed: 0, positive: 0 };
  for (const p of posts) counts[p.sentiment.toLowerCase()]++;
  return {
    generatedAt: new Date().toISOString(),
    checkedLabel: "24 Aug 2026",
    windowLabel: "Last week",
    rotateSeconds: 12,
    posts,
    sentimentSummary: counts,
    themes: [{ label: "General feedback", count: posts.length, trend: "flat", delta: 0 }],
    sources: [
      { label: "Google Play", count: posts.filter((p) => p.source === "Google Play").length },
      { label: "Reddit", count: posts.filter((p) => p.source === "Reddit").length },
      { label: "News", count: posts.filter((p) => p.source === "News").length },
    ],
    ...overrides,
  };
}

const healthy = () => {
  const posts = Array.from({ length: 10 }, () => post());
  posts.push(post({ source: "Reddit", id: "reddit-1", market: "r/london" }));
  posts.push(post({ source: "News", id: "news-1", market: "BBC" }));
  return board(posts);
};

test("runChecks: clean data produces no failures", () => {
  const { fails } = runChecks(healthy(), CONFIG);
  assert.deepEqual(fails, []);
});

test("runChecks: catches posts duplicated across storefronts", () => {
  // The real bug: google-play-scraper returns the same review per country and
  // the country-prefixed id defeated the dedupe, so each appeared five times.
  const posts = [];
  for (const country of ["gb", "se", "de", "fr", "es"]) {
    for (const n of [1, 2, 3]) {
      posts.push(post({ id: `googleplay-${country}-${n}`, quote: `“review ${n}”` }));
    }
  }
  const { fails } = runChecks(board(posts), CONFIG);
  assert.ok(
    fails.some((f) => /unique quotes across/.test(f)),
    `expected a duplication failure, got ${JSON.stringify(fails)}`
  );
  assert.ok(fails.some((f) => /Google Play: 3 unique quotes out of 15/.test(f)));
});

test("runChecks: catches off-topic posts that slipped the relevance filter", () => {
  const withVoiId = healthy();
  withVoiId.posts.push(
    post({ source: "Mastodon", id: "m-1", quote: "“China tests 6G - VOI.id https://voi.id/x”" })
  );
  const { fails } = runChecks(withVoiId, CONFIG);
  assert.ok(fails.some((f) => /voi\.id/.test(f)));

  const withElephant = healthy();
  withElephant.posts.push(post({ source: "Mastodon", id: "m-2", quote: "“gặp một con voi lớn”" }));
  assert.ok(runChecks(withElephant, CONFIG).fails.some((f) => /elephant/.test(f)));
});

test("runChecks: warns about '# word' markup artifacts", () => {
  const data = healthy();
  data.posts.push(post({ source: "Mastodon", id: "m-3", quote: "“# Technologie # VOI”" }));
  const { warns } = runChecks(data, CONFIG);
  assert.ok(warns.some((w) => /spacing artifact/.test(w)));
});

test("runChecks: fails on stale data", () => {
  const staleAt = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
  const stale = board(
    Array.from({ length: 10 }, () => post()),
    { generatedAt: staleAt }
  );
  const { fails } = runChecks(stale, CONFIG);
  assert.ok(
    fails.some((f) => /old \(limit/.test(f)),
    `expected a staleness failure, got ${JSON.stringify(fails)}`
  );
});

test("runChecks: fails when there is almost nothing to show", () => {
  const { fails } = runChecks(board([post(), post()]), CONFIG);
  assert.ok(fails.some((f) => /only 2 posts/.test(f)));
});

test("runChecks: warns per silent source, fails only when all are silent", () => {
  // Reddit enabled but contributing nothing — the 403 case.
  const posts = Array.from({ length: 10 }, () => post());
  const { fails, warns } = runChecks(board(posts), CONFIG);
  assert.ok(warns.some((w) => /contributed nothing: Reddit/.test(w)));
  assert.deepEqual(fails, []);

  const empty = board([]);
  empty.posts = Array.from({ length: 6 }, () => post({ source: "Unknown" }));
  empty.sources = [
    { label: "Google Play", count: 0 },
    { label: "Reddit", count: 0 },
    { label: "News", count: 0 },
  ];
  assert.ok(runChecks(empty, CONFIG).fails.some((f) => /every enabled source/.test(f)));
});

test("runChecks: flags posts missing required fields", () => {
  const data = healthy();
  delete data.posts[0].sentiment;
  assert.ok(runChecks(data, CONFIG).fails.some((f) => /missing required fields/.test(f)));
});
