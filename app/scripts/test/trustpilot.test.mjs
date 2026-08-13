import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fetchTrustpilotReviews, parseCsv } from "../lib/trustpilot.mjs";

test("parseCsv: parses quoted fields containing commas", () => {
  const rows = parseCsv('id,text\n1,"hello, world"\n2,plain\n');
  assert.deepEqual(rows, [
    ["id", "text"],
    ["1", "hello, world"],
    ["2", "plain"],
  ]);
});

test("fetchTrustpilotReviews: falls back to CSV import when no API key configured", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "trustpilot-test-"));
  const csvPath = path.join(dir, "import.csv");
  await fs.writeFile(
    csvPath,
    'id,date,location,stars,text,url\n' +
      '1,2026-08-01,"London, UK",1,"Basic bikes are clunky.",https://example.invalid/r/1\n'
  );

  const originalKey = process.env.TRUSTPILOT_API_KEY;
  delete process.env.TRUSTPILOT_API_KEY;
  try {
    const results = await fetchTrustpilotReviews({ csvImportPath: csvPath });
    assert.equal(results.length, 1);
    assert.equal(results[0].source, "Trustpilot");
    assert.equal(results[0].market, "London, UK");
    assert.match(results[0].quote, /clunky/);
  } finally {
    if (originalKey !== undefined) process.env.TRUSTPILOT_API_KEY = originalKey;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("fetchTrustpilotReviews: returns empty array when disabled", async () => {
  const results = await fetchTrustpilotReviews({ enabled: false });
  assert.deepEqual(results, []);
});

test("fetchTrustpilotReviews: returns empty array when nothing is configured", async () => {
  const originalKey = process.env.TRUSTPILOT_API_KEY;
  delete process.env.TRUSTPILOT_API_KEY;
  try {
    const results = await fetchTrustpilotReviews({});
    assert.deepEqual(results, []);
  } finally {
    if (originalKey !== undefined) process.env.TRUSTPILOT_API_KEY = originalKey;
  }
});
