#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

import { fetchRedditPosts } from "./lib/reddit.mjs";
import { fetchAppStoreReviews } from "./lib/appstore.mjs";
import { fetchGooglePlayReviews } from "./lib/googleplay.mjs";
import { fetchTrustpilotReviews } from "./lib/trustpilot.mjs";
import { fetchNewsPosts } from "./lib/news.mjs";
import { fetchXPosts } from "./lib/x.mjs";
import { fetchMastodonPosts } from "./lib/mastodon.mjs";
import { fetchBlueskyPosts } from "./lib/bluesky.mjs";
import { classifyHeuristic, classifyWithClaude } from "./lib/classify.mjs";
import { pickWindow } from "./lib/window.mjs";
import { buildBoardData } from "./lib/aggregate.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(__dirname, "config.json");
const CONFIG_EXAMPLE_PATH = path.join(__dirname, "config.example.json");
const DATA_PATH = path.join(ROOT, "public", "data.json");

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadConfig() {
  const configPath = (await pathExists(CONFIG_PATH)) ? CONFIG_PATH : CONFIG_EXAMPLE_PATH;
  const raw = await fs.readFile(configPath, "utf8");
  return JSON.parse(raw);
}

async function loadPreviousData() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeQuote(text, maxLen = 320) {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const stripped = cleaned.replace(/^[“"']+|[”"']+$/g, "");
  const truncated =
    stripped.length > maxLen ? stripped.slice(0, maxLen - 1).trimEnd() + "…" : stripped;
  return `“${truncated}”`;
}

function dedupe(posts) {
  const seen = new Set();
  return posts.filter((p) => {
    const key = p.id || `${p.source}::${p.quote}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function classifyAll(posts, config) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let claudeResults = null;
  if (config.classification?.useClaude && apiKey) {
    claudeResults = await classifyWithClaude(posts, {
      apiKey,
      model: config.classification.model,
    });
  }
  return posts.map((p, i) => {
    const c = claudeResults?.[i] || classifyHeuristic(p.quote);
    return { ...p, sentiment: c.sentiment, themes: c.themes };
  });
}

async function main() {
  const config = await loadConfig();

  console.log("[fetch-posts] fetching from all sources…");
  const [reddit, appstore, googleplay, trustpilot, news, x, mastodon, bluesky] = await Promise.all([
    fetchRedditPosts(config.reddit).catch((e) => {
      console.warn(`[reddit] ${e.message}`);
      return [];
    }),
    fetchAppStoreReviews(config.appStore).catch((e) => {
      console.warn(`[appstore] ${e.message}`);
      return [];
    }),
    fetchGooglePlayReviews(config.googlePlay).catch((e) => {
      console.warn(`[googleplay] ${e.message}`);
      return [];
    }),
    fetchTrustpilotReviews(config.trustpilot).catch((e) => {
      console.warn(`[trustpilot] ${e.message}`);
      return [];
    }),
    fetchNewsPosts(config.news).catch((e) => {
      console.warn(`[news] ${e.message}`);
      return [];
    }),
    fetchXPosts(config.x).catch((e) => {
      console.warn(`[x] ${e.message}`);
      return [];
    }),
    fetchMastodonPosts(config.mastodon).catch((e) => {
      console.warn(`[mastodon] ${e.message}`);
      return [];
    }),
    fetchBlueskyPosts(config.bluesky).catch((e) => {
      console.warn(`[bluesky] ${e.message}`);
      return [];
    }),
  ]);

  let all = dedupe([
    ...reddit,
    ...appstore,
    ...googleplay,
    ...trustpilot,
    ...news,
    ...x,
    ...mastodon,
    ...bluesky,
  ])
    .map((p) => ({ ...p, quote: normalizeQuote(p.quote) }))
    .filter((p) => p.quote && p.quote.length > 6);

  console.log(
    `[fetch-posts] collected ${all.length} candidate posts ` +
      `(reddit ${reddit.length}, app store ${appstore.length}, google play ${googleplay.length}, trustpilot ${trustpilot.length}, ` +
      `news ${news.length}, x ${x.length}, mastodon ${mastodon.length}, bluesky ${bluesky.length})`
  );

  all = await classifyAll(all, config);

  const { windowLabel, posts: windowed } = pickWindow(all, config.window);

  const previousData = await loadPreviousData();
  const boardData = buildBoardData({
    posts: windowed,
    windowLabel,
    previousData,
    rotateSeconds: config.rotateSeconds,
    allSourceLabels: config.sourceLabels,
  });

  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  const tmpPath = `${DATA_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(boardData, null, 2) + "\n", "utf8");
  await fs.rename(tmpPath, DATA_PATH);

  console.log(
    `[fetch-posts] wrote ${windowed.length} posts (${windowLabel}) to ${path.relative(ROOT, DATA_PATH)}`
  );
}

main().catch((err) => {
  console.error("[fetch-posts] fatal error:", err);
  process.exitCode = 1;
});
