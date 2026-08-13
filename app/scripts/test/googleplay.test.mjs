import test from "node:test";
import assert from "node:assert/strict";
import { fetchGooglePlayReviews } from "../lib/googleplay.mjs";

test("fetchGooglePlayReviews: never throws, even without network access or the optional dependency installed", async () => {
  // Exercises whichever fallback path applies in this environment: skips
  // cleanly if `google-play-scraper` isn't installed, or if it is installed
  // but the network call fails (e.g. no outbound access).
  const results = await fetchGooglePlayReviews({ appId: "com.voiapp.voi" });
  assert.deepEqual(results, []);
});

test("fetchGooglePlayReviews: returns empty array without an appId", async () => {
  const results = await fetchGooglePlayReviews({});
  assert.deepEqual(results, []);
});
