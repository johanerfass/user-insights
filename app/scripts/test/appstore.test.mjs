import test from "node:test";
import assert from "node:assert/strict";
import { fetchAppStoreReviews } from "../lib/appstore.mjs";

const FIXTURE = {
  feed: {
    entry: [
      // First entry in Apple's RSS feed is app metadata, not a review.
      { "im:name": { label: "Voi Rides" } },
      {
        id: { label: "111" },
        updated: { label: "2026-08-01T00:00:00-07:00" },
        content: { label: "It's actually dangerous how slow the scooters go now." },
        "im:rating": { label: "2" },
      },
    ],
  },
};

test("fetchAppStoreReviews: skips the leading metadata entry and maps reviews", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => FIXTURE });
  try {
    const results = await fetchAppStoreReviews({ appId: "123456789", countries: ["gb"] });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, "appstore-gb-111");
    assert.equal(results[0].source, "App Store");
    assert.equal(results[0].market, "GB");
    assert.equal(results[0].rating, 2);
    assert.match(results[0].quote, /dangerous/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchAppStoreReviews: returns empty array without an appId", async () => {
  const results = await fetchAppStoreReviews({});
  assert.deepEqual(results, []);
});
