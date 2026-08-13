import test from "node:test";
import assert from "node:assert/strict";
import { fetchRedditPosts } from "../lib/reddit.mjs";

const FIXTURE = {
  data: {
    children: [
      {
        data: {
          id: "abc123",
          title: "Voi scooter parked outside my flat again",
          selftext: "Every day there's a Voi scooter blocking the pavement.",
          subreddit: "london",
          created_utc: 1691000000,
          permalink: "/r/london/comments/abc123/voi/",
        },
      },
      {
        data: {
          id: "def456",
          title: "My voice assistant is broken",
          selftext: "Nothing to do with scooters.",
          subreddit: "technology",
          created_utc: 1691000000,
          permalink: "/r/technology/comments/def456/x/",
        },
      },
    ],
  },
};

test("fetchRedditPosts: keeps whole-word 'voi' matches and drops others (e.g. 'voice')", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => FIXTURE });
  try {
    const results = await fetchRedditPosts({
      queries: ["Voi scooter"],
      limit: 10,
      userAgent: "test-agent",
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, "reddit-abc123");
    assert.equal(results[0].source, "Reddit");
    assert.equal(results[0].market, "r/london");
    assert.equal(results[0].url, "https://www.reddit.com/r/london/comments/abc123/voi/");
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchRedditPosts: returns empty array when disabled", async () => {
  const results = await fetchRedditPosts({ enabled: false });
  assert.deepEqual(results, []);
});

test("fetchRedditPosts: swallows per-query fetch failures and returns what it can", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("network down");
  };
  try {
    const results = await fetchRedditPosts({ queries: ["Voi"], limit: 5 });
    assert.deepEqual(results, []);
  } finally {
    global.fetch = originalFetch;
  }
});
