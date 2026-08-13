import test from "node:test";
import assert from "node:assert/strict";
import { classifyHeuristic, extractThemes } from "../lib/classify.mjs";

test("classifyHeuristic: negative-only text", () => {
  const { sentiment } = classifyHeuristic(
    "The scooter was broken and they charged me for it anyway, terrible experience."
  );
  assert.equal(sentiment, "Negative");
});

test("classifyHeuristic: positive-only text", () => {
  const { sentiment } = classifyHeuristic(
    "Great experience, the support team was so helpful and friendly, thank you!"
  );
  assert.equal(sentiment, "Positive");
});

test("classifyHeuristic: mixed signals text", () => {
  const { sentiment } = classifyHeuristic(
    "The team were helpful, but the final position was that the holder is used at your own risk."
  );
  assert.equal(sentiment, "Mixed");
});

test("classifyHeuristic: no-signal text defaults to Mixed, not Negative", () => {
  const { sentiment } = classifyHeuristic(
    "Took a Voi from Covent Garden to King's Cross today."
  );
  assert.equal(sentiment, "Mixed");
});

test("extractThemes: billing keywords map to Billing theme", () => {
  const themes = extractThemes("i have been charged for scooters i did not use, billing is a mess");
  assert.ok(themes.includes("Billing"));
});

test("extractThemes: competitor mention produces a vs. theme", () => {
  const themes = extractThemes("basic bikes are clunky, worse condition than lime");
  assert.ok(themes.some((t) => t === "vs. Lime"));
});

test("extractThemes: falls back to General feedback when nothing matches", () => {
  const themes = extractThemes("just a completely unrelated sentence about the weather");
  assert.deepEqual(themes, ["General feedback"]);
});

test("extractThemes: caps at 2 themes", () => {
  const themes = extractThemes(
    "broken bike, billing charged me, parking fine penalty, dangerous unsafe, geofence gps issue"
  );
  assert.ok(themes.length <= 2);
});
