function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, parse) {
  const { headers = {}, timeoutMs = 15000, retries = 2, method = "GET", body } = options;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers, body, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await parse(res);
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

export function fetchJson(url, options = {}) {
  return fetchWithRetry(url, options, (res) => res.json());
}

/** Same timeout/retry behavior as fetchJson, for feeds that serve raw XML. */
export function fetchText(url, options = {}) {
  return fetchWithRetry(url, options, (res) => res.text());
}
