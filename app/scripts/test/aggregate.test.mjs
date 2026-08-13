import test from "node:test";
import assert from "node:assert/strict";
import { buildBoardData, formatPostDateLabel } from "../lib/aggregate.mjs";

const NOW = "2026-08-13T06:00:00Z";

function post(overrides) {
  return {
    id: "p1",
    source: "Trustpilot",
    market: "UK",
    dateRaw: "2026-08-01T00:00:00Z",
    quote: "“test”",
    sentiment: "Negative",
    themes: ["Billing"],
    url: null,
    ...overrides,
  };
}

test("buildBoardData: computes sentiment summary counts", () => {
  const data = buildBoardData({
    posts: [
      post({ id: "a", sentiment: "Negative" }),
      post({ id: "b", sentiment: "Negative" }),
      post({ id: "c", sentiment: "Positive" }),
      post({ id: "d", sentiment: "Mixed" }),
    ],
    windowLabel: "Last month",
    previousData: null,
    now: NOW,
  });
  assert.deepEqual(data.sentimentSummary, { negative: 2, mixed: 1, positive: 1 });
});

test("buildBoardData: sorts posts newest first", () => {
  const data = buildBoardData({
    posts: [
      post({ id: "old", dateRaw: "2026-01-01T00:00:00Z" }),
      post({ id: "new", dateRaw: "2026-08-01T00:00:00Z" }),
    ],
    windowLabel: "Last month",
    previousData: null,
    now: NOW,
  });
  assert.deepEqual(data.posts.map((p) => p.id), ["new", "old"]);
});

test("buildBoardData: theme trend reflects delta vs previous run", () => {
  const previousData = { themes: [{ label: "Billing", count: 2 }] };
  const data = buildBoardData({
    posts: [
      post({ id: "a", themes: ["Billing"] }),
      post({ id: "b", themes: ["Billing"] }),
      post({ id: "c", themes: ["Billing"] }),
    ],
    windowLabel: "Last month",
    previousData,
    now: NOW,
  });
  const billing = data.themes.find((t) => t.label === "Billing");
  assert.equal(billing.count, 3);
  assert.equal(billing.delta, 1);
  assert.equal(billing.trend, "up");
});

test("buildBoardData: always includes configured source labels, even at zero", () => {
  const data = buildBoardData({
    posts: [post({ source: "Trustpilot" })],
    windowLabel: "Last month",
    previousData: null,
    now: NOW,
    allSourceLabels: ["Trustpilot", "Reddit"],
  });
  const reddit = data.sources.find((s) => s.label === "Reddit");
  assert.equal(reddit.count, 0);
});

test("formatPostDateLabel: recent posts (<=3 days) render as 'Recent'", () => {
  assert.equal(formatPostDateLabel("2026-08-12T00:00:00Z", new Date(NOW)), "Recent");
});

test("formatPostDateLabel: older posts render a formatted date", () => {
  assert.equal(formatPostDateLabel("2026-07-01T00:00:00Z", new Date(NOW)), "1 Jul 2026");
});

test("formatPostDateLabel: missing date falls back to 'Recent'", () => {
  assert.equal(formatPostDateLabel(null, new Date(NOW)), "Recent");
});
