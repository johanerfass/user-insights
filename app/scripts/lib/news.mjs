import { fetchText } from "./http.mjs";
import { parseFeed } from "./rss.mjs";

import { mentionsVoi } from "./relevance.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch press coverage two key-less ways: Google News' RSS search (broad, one
 * pass per language edition) and any specific newspaper RSS/Atom feeds the
 * team wants watched. Both are public XML endpoints — no API key, no scraping.
 */
export async function fetchNewsPosts(config = {}) {
  if (config.enabled === false) return [];

  const results = [];
  const googleNews = config.googleNews || {};
  if (googleNews.enabled !== false) results.push(...(await fetchGoogleNews(googleNews)));
  const feeds = config.feeds || {};
  if (feeds.enabled !== false) results.push(...(await fetchFeeds(feeds)));

  return dedupeById(results);
}

async function fetchGoogleNews(config) {
  const queries = config.queries?.length ? config.queries : ["Voi scooter"];
  const editions = config.editions?.length
    ? config.editions
    : [{ hl: "en-GB", gl: "GB", lang: "en" }];

  const results = [];
  for (const edition of editions) {
    for (const q of queries) {
      const params = new URLSearchParams({
        q,
        hl: edition.hl,
        gl: edition.gl,
        ceid: `${edition.gl}:${edition.lang}`,
      });
      try {
        const xml = await fetchText(`https://news.google.com/rss/search?${params}`);
        for (const item of parseFeed(xml).items) {
          if (!isAboutVoi(item)) continue;
          // Google News names the originating outlet in <source>; the link is
          // its own redirector, so the hostname is only a last resort.
          results.push(toPost(item, item.sourceName || hostOf(item.link) || "News"));
        }
      } catch (err) {
        console.warn(`[news] google news "${q}" (${edition.gl}) failed: ${err.message}`);
      }
      await sleep(300); // be polite across editions/queries
    }
  }
  return results;
}

async function fetchFeeds(config) {
  const urls = config.urls?.length ? config.urls : [];
  const results = [];
  for (const feedUrl of urls) {
    try {
      const xml = await fetchText(feedUrl);
      const { feedTitle, items } = parseFeed(xml);
      for (const item of items) {
        if (!isAboutVoi(item)) continue;
        results.push(toPost(item, feedTitle || hostOf(item.link) || hostOf(feedUrl) || "News"));
      }
    } catch (err) {
      console.warn(`[news] feed ${feedUrl} failed: ${err.message}`);
    }
    await sleep(300);
  }
  return results;
}

function isAboutVoi(item) {
  // The feed query is already Voi-specific, so a bare mention is
  // enough here — but the exclusion list still drops voi.id et al.
  return mentionsVoi(`${item.title}\n${item.summary}`, { requireContext: false });
}

function toPost(item, market) {
  return {
    id: `news-${stableId(item)}`,
    source: "News",
    market,
    dateRaw: toIso(item.published),
    // Many feeds (Google News especially) set the description to the headline
    // plus the outlet name, which reads worse than the headline alone.
    quote: item.summary.length > item.title.length ? item.summary : item.title,
    url: item.link || null,
  };
}

/** Feeds carry no stable numeric id, so derive one from the article link. */
function stableId(item) {
  const basis = item.link || item.title;
  let hash = 0;
  for (let i = 0; i < basis.length; i++) hash = (hash * 31 + basis.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

function toIso(raw) {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hostOf(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
