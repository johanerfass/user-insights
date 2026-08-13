import test from "node:test";
import assert from "node:assert/strict";
import { fetchNewsPosts } from "../lib/news.mjs";

const GOOGLE_NEWS_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>"Voi scooter" - Google News</title>
    <item>
      <title>Voi adds 200 e-scooters in Oxford</title>
      <link>https://news.google.com/rss/articles/abc123</link>
      <pubDate>Mon, 03 Aug 2026 10:00:00 GMT</pubDate>
      <source url="https://www.bbc.co.uk">BBC</source>
      <description>&lt;p&gt;The council approved 200 more Voi scooters &amp;amp; 30 parking bays.&lt;/p&gt;</description>
    </item>
    <item>
      <title>Voice assistants keep getting worse</title>
      <link>https://news.google.com/rss/articles/def456</link>
      <pubDate>Mon, 03 Aug 2026 11:00:00 GMT</pubDate>
      <source url="https://example.com">Example Times</source>
      <description>Nothing about scooters here, just a void.</description>
    </item>
  </channel>
</rss>`;

const NEWSPAPER_ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title><![CDATA[The Oxford Mail]]></title>
  <link rel="self" href="https://www.oxfordmail.co.uk/feed.atom"/>
  <entry>
    <title>Voi trial extended to 2027</title>
    <link rel="alternate" href="https://www.oxfordmail.co.uk/news/voi-trial"/>
    <published>2026-08-05T09:30:00Z</published>
    <summary type="html"><![CDATA[<p>Riders took 40,000 Voi trips &amp; counting, the council says.</p>]]></summary>
  </entry>
</feed>`;

test("fetchNewsPosts: maps Google News items and uses <source> as the market", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => GOOGLE_NEWS_RSS });
  try {
    const results = await fetchNewsPosts({
      googleNews: { queries: ["Voi scooter"], editions: [{ hl: "en-GB", gl: "GB", lang: "en" }] },
      feeds: { enabled: false },
    });
    // The "Voice"/"void" item is dropped by the word-boundary filter.
    assert.equal(results.length, 1);
    const [post] = results;
    assert.ok(post.id.startsWith("news-"));
    assert.equal(post.source, "News");
    assert.equal(post.market, "BBC");
    assert.equal(post.dateRaw, "2026-08-03T10:00:00.000Z");
    assert.equal(post.quote, "The council approved 200 more Voi scooters & 30 parking bays.");
    assert.equal(post.url, "https://news.google.com/rss/articles/abc123");
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchNewsPosts: reads Atom newspaper feeds and uses the feed title as the market", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => NEWSPAPER_ATOM });
  try {
    const results = await fetchNewsPosts({
      googleNews: { enabled: false },
      feeds: { urls: ["https://www.oxfordmail.co.uk/feed.atom"] },
    });
    assert.equal(results.length, 1);
    const [post] = results;
    assert.equal(post.source, "News");
    assert.equal(post.market, "The Oxford Mail");
    assert.equal(post.dateRaw, "2026-08-05T09:30:00.000Z");
    assert.equal(post.quote, "Riders took 40,000 Voi trips & counting, the council says.");
    assert.equal(post.url, "https://www.oxfordmail.co.uk/news/voi-trial");
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchNewsPosts: returns empty array when disabled", async () => {
  const results = await fetchNewsPosts({ enabled: false });
  assert.deepEqual(results, []);
});

test("fetchNewsPosts: swallows feed failures and returns what it can", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("network down");
  };
  try {
    const results = await fetchNewsPosts({
      googleNews: { queries: ["Voi"], editions: [{ hl: "en-GB", gl: "GB", lang: "en" }] },
      feeds: { urls: ["https://www.oxfordmail.co.uk/feed.atom"] },
    });
    assert.deepEqual(results, []);
  } finally {
    global.fetch = originalFetch;
  }
});
