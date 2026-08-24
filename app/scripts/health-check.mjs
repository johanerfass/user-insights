#!/usr/bin/env node
/* Thin CLI around lib/health-rules.mjs — reads the data the pipeline wrote. */
import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import { runChecks } from "./lib/health-rules.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public", "data.json");
const CONFIG_PATH = path.join(__dirname, "config.json");
const CONFIG_EXAMPLE_PATH = path.join(__dirname, "config.example.json");

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function loadConfig() {
  try {
    return await readJson(CONFIG_PATH);
  } catch {
    return await readJson(CONFIG_EXAMPLE_PATH);
  }
}

async function main() {
  let data;
  try {
    data = await readJson(DATA_PATH);
  } catch (err) {
    console.error(`[health] cannot read ${DATA_PATH}: ${err.message}`);
    process.exitCode = 1;
    return;
  }
  const config = await loadConfig();
  const { fails, warns } = runChecks(data, config);

  const posts = data.posts || [];
  const contributing = (data.sources || []).filter((s) => s.count > 0);
  console.log(
    `[health] ${posts.length} posts, ${new Set(posts.map((p) => p.quote)).size} unique, ` +
      `from ${contributing.map((s) => `${s.label}:${s.count}`).join(" ") || "nothing"} ` +
      `(${data.windowLabel || "?"}, generated ${data.generatedAt || "?"})`
  );
  for (const w of warns) console.warn(`[health] WARN ${w}`);
  for (const f of fails) console.error(`[health] FAIL ${f}`);

  if (fails.length) {
    console.error(
      `[health] ${fails.length} failure(s) — not publishing this refresh. ` +
        `Fix the pipeline, or widen the rule if the data is genuinely fine.`
    );
    process.exitCode = 1;
  } else {
    console.log(`[health] ok${warns.length ? ` (${warns.length} warning(s))` : ""}`);
  }
}

main().catch((err) => {
  console.error("[health] fatal error:", err);
  process.exitCode = 1;
});
