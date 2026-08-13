import test from "node:test";
import assert from "node:assert/strict";
import { fetchMastodonPosts } from "../lib/mastodon.mjs";

const FIXTURE = [
  {
    id: "112233",
    created_at: "2026-08-04T12:00:00.000Z",
    url: "https://mastodon.social/@rider/112233",
    content:
      '<p>Rode a <a href="https://mastodon.social/tags/voi">#Voi</a> scooter across town &amp; it just worked</p>',
    account: { acct: "rider@mastodon.social" },
  },
  {
    id: "445566",
    created_at: "2026-08-04T13:00:00.000Z",
    url: "https://mastodon.social/@someone/445566",
    content: "<p>My voice assistant is shouting into the void again</p>",
    account: { acct: "someone" },
  },
];

test("fetchMastodonPosts: strips HTML and keeps only whole-word 'voi' matches", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => FIXTURE });
  try {
    const results = await fetchMastodonPosts({
      instances: ["mastodon.social"],
      hashtags: ["voi"],
      limit: 10,
    });
    // The "voice"/"void" status is dropped by the word-boundary filter.
    assert.equal(results.length, 1);
    const [post] = results;
    assert.equal(post.id, "mastodon-mastodon.social-112233");
    assert.equal(post.source, "Mastodon");
    assert.equal(post.market, "@rider@mastodon.social");
    assert.equal(post.dateRaw, "2026-08-04T12:00:00.000Z");
    assert.equal(post.quote, "Rode a #Voi scooter across town & it just worked");
    assert.equal(post.url, "https://mastodon.social/@rider/112233");
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchMastodonPosts: returns empty array when disabled", async () => {
  const results = await fetchMastodonPosts({ enabled: false });
  assert.deepEqual(results, []);
});

test("fetchMastodonPosts: swallows per-hashtag fetch failures", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("instance unreachable");
  };
  try {
    const results = await fetchMastodonPosts({
      instances: ["mastodon.social"],
      hashtags: ["voi"],
    });
    assert.deepEqual(results, []);
  } finally {
    global.fetch = originalFetch;
  }
});
