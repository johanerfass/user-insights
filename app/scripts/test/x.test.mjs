import test from "node:test";
import assert from "node:assert/strict";
import { fetchXPosts } from "../lib/x.mjs";

const FIXTURE = {
  data: [
    {
      id: "1900000000000000001",
      text: "Voi scooters saved my commute today",
      created_at: "2026-08-02T07:15:00.000Z",
      lang: "en",
      author_id: "42",
    },
    {
      id: "1900000000000000002",
      text: "my voice cracked shouting into the void",
      created_at: "2026-08-02T08:15:00.000Z",
      lang: "en",
      author_id: "43",
    },
  ],
  includes: {
    users: [
      { id: "42", username: "citycyclist" },
      { id: "43", username: "someone" },
    ],
  },
};

test("fetchXPosts: joins authors onto tweets and keeps only whole-word 'voi' matches", async () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.X_BEARER_TOKEN;
  global.fetch = async () => ({ ok: true, json: async () => FIXTURE });
  process.env.X_BEARER_TOKEN = "test-bearer-token";
  try {
    const results = await fetchXPosts({ queries: ["Voi scooter"], maxResults: 10 });
    // The "voice"/"void" tweet is dropped by the word-boundary filter.
    assert.equal(results.length, 1);
    const [post] = results;
    assert.equal(post.id, "x-1900000000000000001");
    assert.equal(post.source, "X");
    assert.equal(post.market, "@citycyclist");
    assert.equal(post.dateRaw, "2026-08-02T07:15:00.000Z");
    assert.equal(post.quote, "Voi scooters saved my commute today");
    assert.equal(post.url, "https://x.com/citycyclist/status/1900000000000000001");
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.X_BEARER_TOKEN;
    else process.env.X_BEARER_TOKEN = originalToken;
  }
});

test("fetchXPosts: returns empty array when no bearer token is configured", async () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.X_BEARER_TOKEN;
  global.fetch = async () => {
    throw new Error("should not be called without a token");
  };
  delete process.env.X_BEARER_TOKEN;
  try {
    const results = await fetchXPosts({ queries: ["Voi scooter"] });
    assert.deepEqual(results, []);
  } finally {
    global.fetch = originalFetch;
    if (originalToken !== undefined) process.env.X_BEARER_TOKEN = originalToken;
  }
});

test("fetchXPosts: returns empty array when disabled", async () => {
  const results = await fetchXPosts({ enabled: false });
  assert.deepEqual(results, []);
});

test("fetchXPosts: swallows per-query fetch failures", async () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.X_BEARER_TOKEN;
  global.fetch = async () => {
    throw new Error("rate limited");
  };
  process.env.X_BEARER_TOKEN = "test-bearer-token";
  try {
    const results = await fetchXPosts({ queries: ["Voi scooter"] });
    assert.deepEqual(results, []);
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.X_BEARER_TOKEN;
    else process.env.X_BEARER_TOKEN = originalToken;
  }
});
