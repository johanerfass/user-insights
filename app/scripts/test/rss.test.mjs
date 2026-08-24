import test from "node:test";
import assert from "node:assert/strict";
import { parseFeed, stripHtml } from "../lib/rss.mjs";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>"Voi scooter" - Google News</title>
    <link>https://news.google.com/</link>
    <item>
      <title>Voi adds 200 e-scooters in Oxford</title>
      <link>https://www.bbc.co.uk/news/voi-oxford?utm=rss&amp;page=1</link>
      <pubDate>Mon, 03 Aug 2026 10:00:00 GMT</pubDate>
      <source url="https://www.bbc.co.uk">BBC</source>
      <description>&lt;p&gt;The council approved 200 more Voi scooters &amp;amp; 30 parking bays.&lt;/p&gt;</description>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title><![CDATA[The Oxford Mail]]></title>
  <link rel="self" href="https://www.oxfordmail.co.uk/feed.atom"/>
  <updated>2026-08-06T08:00:00Z</updated>
  <entry>
    <title>Voi trial extended to 2027</title>
    <link rel="alternate" href="https://www.oxfordmail.co.uk/news/voi-trial"/>
    <link rel="replies" href="https://www.oxfordmail.co.uk/news/voi-trial/comments"/>
    <published>2026-08-05T09:30:00Z</published>
    <updated>2026-08-05T11:00:00Z</updated>
    <summary type="html"><![CDATA[<p>Riders took 40,000 Voi trips &amp; counting &#8212; the council says.</p>]]></summary>
  </entry>
</feed>`;

test("parseFeed: reads an RSS 2.0 channel and its items", () => {
  const { feedTitle, items } = parseFeed(RSS);
  assert.equal(feedTitle, '"Voi scooter" - Google News');
  assert.equal(items.length, 1);
  const [item] = items;
  assert.equal(item.title, "Voi adds 200 e-scooters in Oxford");
  assert.equal(item.link, "https://www.bbc.co.uk/news/voi-oxford?utm=rss&page=1");
  assert.equal(item.published, "Mon, 03 Aug 2026 10:00:00 GMT");
  assert.equal(item.sourceName, "BBC");
  // Escaped HTML in <description>: tags gone, "&amp;amp;" back to a plain "&".
  assert.equal(item.summary, "The council approved 200 more Voi scooters & 30 parking bays.");
});

test("parseFeed: reads Atom entries, CDATA and self-closing <link href>", () => {
  const { feedTitle, items } = parseFeed(ATOM);
  assert.equal(feedTitle, "The Oxford Mail");
  assert.equal(items.length, 1);
  const [item] = items;
  assert.equal(item.title, "Voi trial extended to 2027");
  // rel="alternate" is the canonical link, not rel="self"/rel="replies".
  assert.equal(item.link, "https://www.oxfordmail.co.uk/news/voi-trial");
  assert.equal(item.published, "2026-08-05T09:30:00Z");
  assert.equal(item.summary, "Riders took 40,000 Voi trips & counting — the council says.");
  assert.equal(item.sourceName, "");
});

test("parseFeed: returns an empty result for junk or empty input", () => {
  assert.deepEqual(parseFeed(""), { feedTitle: "", items: [] });
  assert.deepEqual(parseFeed("not xml at all"), { feedTitle: "", items: [] });
});

test("stripHtml: decodes named and numeric entities and drops tags", () => {
  assert.equal(stripHtml("<p>Tom &amp; Jerry</p>"), "Tom & Jerry");
  assert.equal(stripHtml("2 &lt; 3 is &quot;true&quot;"), '2 < 3 is "true"');
  assert.equal(stripHtml("it&#39;s fine &apos;n&apos; dandy"), "it's fine 'n' dandy");
  assert.equal(stripHtml("em&#8212;dash and hex&#x2014;dash"), "em—dash and hex—dash");
  assert.equal(stripHtml("keeps &copy; unknown entities"), "keeps &copy; unknown entities");
  assert.equal(stripHtml("<p>a</p><p>b</p>"), "a b");
});

test("stripHtml: inline tags collapse to nothing, block boundaries to a space", () => {
  // Mastodon marks hashtags up as `#<span>voi</span>` and mentions as
  // `@<span>user</span>`; turning those tags into spaces produced "# voi".
  assert.equal(stripHtml('<a class="hashtag" href="#">#<span>voi</span></a>'), "#voi");
  assert.equal(stripHtml('<a href="/@bob">@<span>bob</span></a> hi'), "@bob hi");
  // Block-level boundaries still separate words.
  assert.equal(stripHtml("x<br>y"), "x y");
  assert.equal(stripHtml("<ul><li>a</li><li>b</li></ul>"), "a b");
});
