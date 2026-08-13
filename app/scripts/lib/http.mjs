function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson(url, { headers = {}, timeoutMs = 15000, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}
