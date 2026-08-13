const NEGATIVE_WORDS = [
  "broken", "unsafe", "clunky", "overcharged", "scam", "rip off", "ripoff", "penalty",
  "danger", "dangerous", "awful", "terrible", "worst", "disappointed", "let down", "failed",
  "rude", "ignored", "never again", "waste of money", "faulty", "damaged", "dirty",
  "annoying", "frustrat", "complain", "issue", "problem", "bug", "glitch", "crash", "lag",
  "won't unlock", "wont unlock", "won't start", "wont start", "overpriced", "hidden fee",
  "no response", "charged for", "charged me", "at your own risk", "at your own",
];

const POSITIVE_WORDS = [
  "great", "love", "amazing", "fantastic", "excellent", "helpful", "convenient", "easy",
  "reliable", "smooth", "recommend", "thank you", "thanks", "shout out", "shoutout",
  "refunded", "resolved", "fixed quickly", "friendly", "responsive", "good experience",
  "saved me", "lifesaver", "perfect", "impressed",
];

const COMPETITORS = ["Lime", "Bird", "Tier", "Dott", "Bolt", "Superpedestrian", "Spin"];

const THEME_RULES = [
  { label: "Vehicle condition", patterns: ["clunky", "condition", "worn", "feel unsafe", "beat up", "shabby"] },
  { label: "Broken vehicles", patterns: ["broken", "wouldn't start", "wont start", "didn't work", "malfunction"] },
  { label: "Billing", patterns: ["charged", "billing", "overcharg", "invoice", "double charge"] },
  { label: "Refunds", patterns: ["refund"] },
  { label: "Parking data", patterns: ["parking spot", "p location", "parking info", "outdated info"] },
  { label: "Parking fines", patterns: ["parking fine", "penalty", "fined"] },
  { label: "Geofencing", patterns: ["geofence", "gps", "go-slow zone", "slow zone"] },
  { label: "App reliability", patterns: ["app crash", "app freeze", "app bug", "app won't", "app wont", "login issue", "log in"] },
  { label: "App performance", patterns: ["slow app", "laggy", "loading forever"] },
  { label: "QR scanning", patterns: ["qr code", "scan the code", "camera"] },
  { label: "Street clutter", patterns: ["blocking the pavement", "curb", "sidewalk", "clutter"] },
  { label: "Slow zones", patterns: ["too slow", "speed limit", "capped at"] },
  { label: "Safety", patterns: ["dangerous", "unsafe", "helmet", "accident", "injur"] },
  { label: "Transit backup", patterns: ["underground", "tube was", "train delayed", "bus was late"] },
  { label: "Phone holder", patterns: ["phone holder", "phone mount"] },
  { label: "Claims", patterns: ["at your own risk", "liability", "insurance claim"] },
  { label: "Promo codes", patterns: ["promo code", "discount code", "voucher"] },
  { label: "First ride", patterns: ["first ride", "free ride"] },
  { label: "Support", patterns: ["customer service", "support team", "helpdesk"] },
  { label: "Recovery", patterns: ["resolved", "made it right", "fixed the issue"] },
  { label: "Trust", patterns: ["scam", "misleading", "untrustworthy", "dishonest"] },
];

function countHits(text, words) {
  let n = 0;
  for (const w of words) if (text.includes(w)) n++;
  return n;
}

export function extractThemes(text) {
  const scored = [];
  for (const rule of THEME_RULES) {
    const hits = rule.patterns.reduce((n, p) => n + (text.includes(p) ? 1 : 0), 0);
    if (hits > 0) scored.push({ label: rule.label, hits });
  }
  for (const name of COMPETITORS) {
    const re = new RegExp(`\\b${name.toLowerCase()}\\b`);
    if (re.test(text)) scored.push({ label: `vs. ${name}`, hits: 2 });
  }
  scored.sort((a, b) => b.hits - a.hits);
  const top = scored.slice(0, 2).map((s) => s.label);
  return top.length ? top : ["General feedback"];
}

/**
 * Deterministic, dependency-free sentiment classification. Deliberately
 * defaults ambiguous/no-signal text to "Mixed" rather than "Negative" — a
 * neutral report ("took a Voi to the station today") shouldn't read as a
 * complaint just because it didn't hit a positive-word list.
 */
export function classifyHeuristic(text) {
  const t = (text || "").toLowerCase();
  const negHits = countHits(t, NEGATIVE_WORDS);
  const posHits = countHits(t, POSITIVE_WORDS);
  let sentiment;
  if (negHits > 0 && posHits > 0) sentiment = "Mixed";
  else if (negHits > posHits) sentiment = "Negative";
  else if (posHits > negHits) sentiment = "Positive";
  else sentiment = "Mixed";
  return { sentiment, themes: extractThemes(t) };
}

/**
 * Optional higher-quality classification via the Claude API, used when
 * ANTHROPIC_API_KEY is configured and classification.useClaude is on.
 * Classifies the whole batch in one call; returns null (triggering a
 * heuristic fallback per-post) on any failure.
 */
export async function classifyWithClaude(posts, { apiKey, model = "claude-haiku-4-5-20251001" } = {}) {
  if (!apiKey || !posts.length) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        messages: [{ role: "user", content: buildPrompt(posts) }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API HTTP ${res.status}`);
    const json = await res.json();
    const text = json?.content?.[0]?.text || "";
    const parsed = JSON.parse(extractJsonBlock(text));
    if (!Array.isArray(parsed) || parsed.length !== posts.length) {
      throw new Error("unexpected classification response shape");
    }
    return parsed.map((p) => ({
      sentiment: ["Positive", "Negative", "Mixed"].includes(p.sentiment) ? p.sentiment : "Mixed",
      themes: Array.isArray(p.themes) && p.themes.length ? p.themes.slice(0, 2) : ["General feedback"],
    }));
  } catch (err) {
    console.warn(`[classify] Claude classification failed, falling back to heuristic: ${err.message}`);
    return null;
  }
}

function buildPrompt(posts) {
  const numbered = posts.map((p, i) => `${i + 1}. ${p.quote}`).join("\n");
  return `You are labeling short rider reviews of a shared e-scooter/e-bike company (Voi) for an internal feedback dashboard.
For each numbered review below, return its sentiment as exactly one of "Positive", "Negative", or "Mixed" (use "Mixed" when there is no clear signal either way), and 1-2 short theme labels (2-4 words, sentence case, e.g. "Billing & charges", "Vehicle condition").
Respond with ONLY a JSON array of ${posts.length} objects like {"sentiment": "...", "themes": ["..."]}, in the same order as the reviews, no other text.

${numbered}`;
}

function extractJsonBlock(text) {
  const match = text.match(/\[[\s\S]*\]/);
  return match ? match[0] : text;
}
