import test from "node:test";
import assert from "node:assert/strict";
import { pickWindow } from "../lib/window.mjs";

const NOW = "2026-08-13T06:00:00Z";
const daysAgo = (n) => new Date(new Date(NOW).getTime() - n * 24 * 60 * 60 * 1000).toISOString();

function makePosts(offsets) {
  return offsets.map((days, i) => ({ id: `p${i}`, dateRaw: daysAgo(days) }));
}

test("pickWindow: uses 'Last week' when enough posts fall within it", () => {
  const posts = makePosts([1, 2, 3, 4, 5]);
  const { windowLabel, posts: result } = pickWindow(posts, { now: NOW, minPostsForWindow: 5 });
  assert.equal(windowLabel, "Last week");
  assert.equal(result.length, 5);
});

test("pickWindow: widens to 'Last month' when the week is too sparse", () => {
  const posts = makePosts([1, 10, 15, 20, 25]);
  const { windowLabel, posts: result } = pickWindow(posts, { now: NOW, minPostsForWindow: 5 });
  assert.equal(windowLabel, "Last month");
  assert.equal(result.length, 5);
});

test("pickWindow: falls back to the widest candidate even if still sparse", () => {
  const posts = makePosts([1]);
  const { windowLabel, posts: result } = pickWindow(posts, { now: NOW, minPostsForWindow: 5 });
  assert.equal(windowLabel, "Last quarter");
  assert.equal(result.length, 1);
});

test("pickWindow: keeps undated posts rather than dropping them", () => {
  const posts = [{ id: "a", dateRaw: null }, ...makePosts([1, 2, 3, 4])];
  const { posts: result } = pickWindow(posts, { now: NOW, minPostsForWindow: 5 });
  assert.ok(result.some((p) => p.id === "a"));
});
