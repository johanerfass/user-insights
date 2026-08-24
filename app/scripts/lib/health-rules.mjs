/*
 * The rules behind `npm run health`.
 *
 * Every one exists because the pipeline reported success while quietly
 * publishing something wrong: Google Play reviews duplicated five times over,
 * Reddit silently returning 403, Vietnamese posts about elephants on the
 * board. A green workflow run is not evidence the data is any good.
 *
 * Kept free of filesystem and network access so the tests can drive it.
 *
 * Two severities:
 *   - FAIL: bad enough that publishing is worse than skipping a day. The CLI
 *     exits non-zero, failing the workflow step so GitHub emails the owner.
 *   - WARN: worth a human look, but not worth blocking the refresh.
 */
const MAX_DATA_AGE_HOURS = 48;
const MIN_POSTS = 5;
// Below this, the same handful of posts is being repeated — the Google Play
// country-prefix bug produced a ratio of 0.2 (14 unique out of 70).
const MIN_UNIQUE_RATIO = 0.6;

// Text that means a post is not about Voi at all. Kept in step with the
// exclusion list in lib/relevance.mjs.
const OFF_TOPIC = [
  { pattern: /voi\.id/i, why: "voi.id is an unrelated Indonesian news site" },
  { pattern: /\bcon voi\b|\bđàn voi\b|\bvoi rừng\b/i, why: "Vietnamese for elephant" },
];

// `#<span>voi</span>` markup collapsing to "# voi" — a stripHtml regression.
const SPACING_ARTIFACT = /(?:^|\s)[#@]\s+\w/;


async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function loadConfig() {
  try {
    return await readJson(CONFIG_PATH);
  } catch {
    return await readJson(CONFIG_EXAMPLE_PATH);
  }
}

function checkFreshness(data, fail, warn) {
  if (!data.generatedAt) {
    fail("no generatedAt — can't tell how old this data is");
    return;
  }
  const ageMs = Date.now() - Date.parse(data.generatedAt);
  if (Number.isNaN(ageMs)) {
    fail(`generatedAt is not a valid date: ${data.generatedAt}`);
    return;
  }
  const ageHours = ageMs / 3_600_000;
  if (ageHours > MAX_DATA_AGE_HOURS) {
    fail(
      `data is ${Math.round(ageHours)}h old (limit ${MAX_DATA_AGE_HOURS}h) — ` +
        `the scheduled fetch has probably stopped running`
    );
  }
}

function checkShape(data, fail, warn) {
  const posts = data.posts || [];
  if (posts.length < MIN_POSTS) {
    fail(`only ${posts.length} posts (minimum ${MIN_POSTS})`);
  }
  const required = ["id", "source", "market", "date", "sentiment", "quote", "themes"];
  const malformed = posts.filter((p) => required.some((k) => p[k] === undefined));
  if (malformed.length) {
    fail(`${malformed.length} posts missing required fields (e.g. ${malformed[0].id})`);
  }
  // Guarded: URL is global in Node but absent in some minimal runtimes, and
  // "every url is broken" would be a very misleading failure.
  if (typeof URL === "function") {
    const badUrls = posts.filter((p) => {
      if (!p.url) return false;
      try {
        new URL(p.url);
        return false;
      } catch {
        return true;
      }
    });
    if (badUrls.length) fail(`${badUrls.length} posts have an unparseable url`);
  }

  const summed =
    (data.sentimentSummary?.negative || 0) +
    (data.sentimentSummary?.mixed || 0) +
    (data.sentimentSummary?.positive || 0);
  if (posts.length && summed !== posts.length) {
    warn(`sentimentSummary totals ${summed} but there are ${posts.length} posts`);
  }
}

function checkDuplication(data, fail, warn) {
  const posts = data.posts || [];
  if (!posts.length) return;
  const unique = new Set(posts.map((p) => p.quote)).size;
  const ratio = unique / posts.length;
  if (ratio < MIN_UNIQUE_RATIO) {
    fail(
      `only ${unique} unique quotes across ${posts.length} posts ` +
        `(${Math.round(ratio * 100)}%) — posts are being duplicated`
    );
  }
  // Per source, so one noisy source can't hide behind the others.
  const bySource = new Map();
  for (const p of posts) {
    if (!bySource.has(p.source)) bySource.set(p.source, []);
    bySource.get(p.source).push(p.quote);
  }
  for (const [source, quotes] of bySource) {
    if (quotes.length < 5) continue;
    const u = new Set(quotes).size;
    if (u / quotes.length < MIN_UNIQUE_RATIO) {
      fail(`${source}: ${u} unique quotes out of ${quotes.length} — duplicated`);
    }
  }
}

function checkRelevance(data, fail, warn) {
  for (const post of data.posts || []) {
    for (const { pattern, why } of OFF_TOPIC) {
      if (pattern.test(post.quote)) {
        fail(`off-topic post from ${post.source} (${why}): ${post.quote.slice(0, 60)}`);
      }
    }
    if (SPACING_ARTIFACT.test(post.quote)) {
      warn(
        `"# word" spacing artifact in a ${post.source} quote — stripHtml regression? ` +
          post.quote.slice(0, 60)
      );
    }
  }
}

function checkSources(data, config, fail, warn) {
  const counts = new Map((data.sources || []).map((s) => [s.label, s.count || 0]));
  // Sources the config has switched on, and the label each reports as.
  const enabled = [
    ["Reddit", config.reddit],
    ["App Store", config.appStore],
    ["Google Play", config.googlePlay],
    ["Trustpilot", config.trustpilot],
    ["News", config.news],
    ["X", config.x],
    ["Mastodon", config.mastodon],
    ["Bluesky", config.bluesky],
  ].filter(([, cfg]) => cfg && cfg.enabled !== false);

  const silent = enabled
    .map(([label]) => label)
    .filter((label) => (counts.get(label) || 0) === 0);

  if (silent.length) {
    warn(
      `enabled but contributed nothing: ${silent.join(", ")}. ` +
        `Expected for sources without credentials; investigate any that used to work.`
    );
  }
  if (silent.length === enabled.length) {
    fail("every enabled source returned zero posts");
  }
}

/**
 * Run every rule against a board-data object. Pure — no filesystem, no clock
 * beyond Date.now() for the freshness rule — so the tests can drive it.
 *
 * @returns {{fails: string[], warns: string[]}}
 */
export function runChecks(data, config = {}) {
  const fails = [];
  const warns = [];
  const fail = (m) => fails.push(m);
  const warn = (m) => warns.push(m);
  checkFreshness(data, fail, warn);
  checkShape(data, fail, warn);
  checkDuplication(data, fail, warn);
  checkRelevance(data, fail, warn);
  checkSources(data, config, fail, warn);
  return { fails, warns };
}
