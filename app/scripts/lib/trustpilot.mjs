import fs from "node:fs/promises";
import { fetchJson } from "./http.mjs";

/**
 * Trustpilot has no free, key-less public API. The legitimate path is the
 * Trustpilot Business API (requires a business account + API key, scoped to
 * your own business unit). If that isn't configured, fall back to a
 * manually-exported CSV (Trustpilot's dashboard supports exporting reviews)
 * rather than scraping the public review pages, which their ToS restricts.
 */
export async function fetchTrustpilotReviews(config = {}) {
  if (config.enabled === false) return [];
  const apiKey = process.env[config.apiKeyEnvVar || "TRUSTPILOT_API_KEY"];

  if (apiKey && config.businessUnitId) {
    try {
      return await fetchViaApi(config.businessUnitId, apiKey, config);
    } catch (err) {
      console.warn(
        `[trustpilot] API fetch failed (${err.message}); falling back to CSV import if configured.`
      );
    }
  } else {
    console.warn(
      "[trustpilot] no API key/business unit configured — set TRUSTPILOT_API_KEY and config.trustpilot.businessUnitId, or provide a CSV export via config.trustpilot.csvImportPath."
    );
  }

  if (config.csvImportPath) return fetchViaCsv(config.csvImportPath);
  return [];
}

async function fetchViaApi(businessUnitId, apiKey, config) {
  const perPage = config.perPage || 100;
  const url = `https://api.trustpilot.com/v1/business-units/${businessUnitId}/reviews?apikey=${encodeURIComponent(
    apiKey
  )}&perPage=${perPage}`;
  const json = await fetchJson(url);
  const reviews = json?.reviews || [];
  return reviews.map((r) => ({
    id: `trustpilot-${r.id}`,
    source: "Trustpilot",
    market: r.consumer?.displayLocation || "—",
    dateRaw: r.createdAt || null,
    quote: (r.text || "").trim(),
    rating: r.stars ?? null,
    url: r.links?.find((l) => l.rel === "review")?.href || null,
  }));
}

/**
 * Reads a CSV exported from Trustpilot's business dashboard. Expected
 * (case-insensitive) columns: id, date, location, stars, text, url — extra
 * columns are ignored, and any of them may be missing.
 */
async function fetchViaCsv(path) {
  let raw;
  try {
    raw = await fs.readFile(path, "utf8");
  } catch {
    return [];
  }
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  const iId = idx("id");
  const iDate = idx("date");
  const iLocation = idx("location");
  const iStars = idx("stars");
  const iText = idx("text");
  const iUrl = idx("url");

  return rows
    .slice(1)
    .filter((r) => r.some((cell) => cell.trim() !== ""))
    .map((r, i) => ({
      id: `trustpilot-csv-${iId >= 0 ? r[iId] : i}`,
      source: "Trustpilot",
      market: iLocation >= 0 ? r[iLocation] || "—" : "—",
      dateRaw: iDate >= 0 ? r[iDate] : null,
      quote: (iText >= 0 ? r[iText] || "" : "").trim(),
      rating: iStars >= 0 && r[iStars] !== "" ? Number(r[iStars]) : null,
      url: iUrl >= 0 ? r[iUrl] || null : null,
    }));
}

/** Minimal RFC 4180 CSV parser (handles quoted fields with commas/newlines). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
