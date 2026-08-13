import test from "node:test";
import assert from "node:assert/strict";
import { fetchBlueskyPosts } from "../lib/bluesky.mjs";

const SEARCH_FIXTURE = {
  posts: [
    {
      uri: "at://did:plc:abc123/app.bsky.feed.post/3kxyzrkey",
      cid: "bafyreiaaa",
      author: { handle: "rider.bsky.social" },
      record: {
        text: "The Voi app finally shows the right battery level",
        createdAt: "2026-08-06T18:20:00.000Z",
      },
    },
    {
      uri: "at://did:plc:def456/app.bsky.feed.post/3kabcrkey",
      cid: "bafyreibbb",
      author: { handle: "someone.bsky.social" },
      record: {
        text: "avoiding the void, losing my voice",
        createdAt: "2026-08-06T19:20:00.000Z",
      },
    },
  ],
};

function stubAuthenticatedFetch() {
  return async (url) => {
    if (String(url).includes("createSession")) {
      return { ok: true, json: async () => ({ accessJwt: "test-jwt" }) };
    }
    return { ok: true, json: async () => SEARCH_FIXTURE };
  };
}

function setCredentials() {
  process.env.BLUESKY_IDENTIFIER = "board.bsky.social";
  process.env.BLUESKY_APP_PASSWORD = "test-app-password";
}

function restoreEnv(identifier, appPassword) {
  if (identifier === undefined) delete process.env.BLUESKY_IDENTIFIER;
  else process.env.BLUESKY_IDENTIFIER = identifier;
  if (appPassword === undefined) delete process.env.BLUESKY_APP_PASSWORD;
  else process.env.BLUESKY_APP_PASSWORD = appPassword;
}

test("fetchBlueskyPosts: logs in, searches, and keeps only whole-word 'voi' matches", async () => {
  const originalFetch = global.fetch;
  const originalId = process.env.BLUESKY_IDENTIFIER;
  const originalPassword = process.env.BLUESKY_APP_PASSWORD;
  global.fetch = stubAuthenticatedFetch();
  setCredentials();
  try {
    const results = await fetchBlueskyPosts({ queries: ["Voi scooter"], limit: 10 });
    // "avoiding"/"void"/"voice" are dropped by the word-boundary filter.
    assert.equal(results.length, 1);
    const [post] = results;
    assert.equal(post.id, "bluesky-bafyreiaaa");
    assert.equal(post.source, "Bluesky");
    assert.equal(post.market, "@rider.bsky.social");
    assert.equal(post.dateRaw, "2026-08-06T18:20:00.000Z");
    assert.equal(post.quote, "The Voi app finally shows the right battery level");
    assert.equal(post.url, "https://bsky.app/profile/rider.bsky.social/post/3kxyzrkey");
  } finally {
    global.fetch = originalFetch;
    restoreEnv(originalId, originalPassword);
  }
});

test("fetchBlueskyPosts: returns empty array when credentials are missing", async () => {
  const originalFetch = global.fetch;
  const originalId = process.env.BLUESKY_IDENTIFIER;
  const originalPassword = process.env.BLUESKY_APP_PASSWORD;
  global.fetch = async () => {
    throw new Error("should not be called without credentials");
  };
  delete process.env.BLUESKY_IDENTIFIER;
  delete process.env.BLUESKY_APP_PASSWORD;
  try {
    const results = await fetchBlueskyPosts({ queries: ["Voi scooter"] });
    assert.deepEqual(results, []);
  } finally {
    global.fetch = originalFetch;
    restoreEnv(originalId, originalPassword);
  }
});

test("fetchBlueskyPosts: returns empty array when disabled", async () => {
  const results = await fetchBlueskyPosts({ enabled: false });
  assert.deepEqual(results, []);
});

test("fetchBlueskyPosts: returns empty array when the login call fails", async () => {
  const originalFetch = global.fetch;
  const originalId = process.env.BLUESKY_IDENTIFIER;
  const originalPassword = process.env.BLUESKY_APP_PASSWORD;
  global.fetch = async () => {
    throw new Error("network down");
  };
  setCredentials();
  try {
    const results = await fetchBlueskyPosts({ queries: ["Voi scooter"] });
    assert.deepEqual(results, []);
  } finally {
    global.fetch = originalFetch;
    restoreEnv(originalId, originalPassword);
  }
});
