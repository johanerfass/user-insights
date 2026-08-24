/*
 * Deciding whether a post is actually about Voi.
 *
 * A bare `\bvoi\b` match is not enough on social platforms. Checked against a
 * live sample of 40 matching Mastodon posts, half were nothing to do with the
 * company:
 *   - "con voi" / "đàn voi" — Vietnamese for elephant
 *   - "voi" — Finnish for butter, Romanian/Italian for "you (plural)"
 *   - voi.id — an unrelated Indonesian news site that posts prolifically
 *
 * So a post qualifies only if it carries an unambiguous Voi marker (a #voi
 * style hashtag or @voi handle), or mentions "voi" *and* something
 * micromobility-shaped. Anything hitting the exclusion list is dropped even
 * if it otherwise matches.
 */

// Unambiguous: nobody writes #voibikes about butter.
const STRONG_MARKERS = [
  /#voi(?:bikes?|scooters?|app|tech(?:nology)?)\b/i,
  /@voi\b/i,
  /\bvoi\s?(?:scooters?|bikes?|technology|app)\b/i,
  /\bvoiapp\b/i,
];

// A bare "#voi" is usually the company — but not in languages where "voi" is
// an everyday word. A live sample turned up Romanian devotional posts tagged
// #voi ("you"), so in those languages it has to clear the context bar too.
const BARE_HASHTAG = /#voi\b/i;
const AMBIGUOUS_LANGUAGES = new Set([
  "ro", // voi = you (plural)
  "it", // voi = you (plural)
  "fi", // voi = butter / can
  "vi", // voi = elephant
]);

// "voi" plus one of these reads as the company rather than a coincidence.
// Multilingual on purpose — Voi operates across Europe.
const CONTEXT_WORDS = [
  // en
  "scooter", "e-scooter", "escooter", "kick scooter", "bike", "e-bike", "ebike",
  "bike share", "bikeshare", "micromobility", "micro-mobility", "ride share",
  // sv / no / da
  "sparkcykel", "elsparkcykel", "cykel", "elcykel", "sykkel", "løbehjul",
  "mikromobilitet", "leiesykkel", "hyrcykel",
  // de
  "roller", "e-roller", "tretroller", "leihrad", "mietrad", "fahrrad",
  "leihradangebot", "gehweg", "radweg",
  // fr
  "trottinette", "vélo", "velo", "vélos",
  // es / pt / it
  "patinete", "bicicleta", "monopattino", "bicicletta",
  // nl / pl / fi
  "deelscooter", "hulajnog", "rower", "potkulauta",
];

// Contexts where "voi" is definitely not the company.
const EXCLUSIONS = [
  /voi\.id/i,               // Indonesian news site
  /\bcon voi\b/i,           // vi: "an elephant"
  /\bđàn voi\b/i,           // vi: "herd of elephants"
  /\bvoi rừng\b/i,          // vi: "wild elephant"
  /\bvoi\s+(?:uống|ngà)\b/i, // vi: elephant drinking / tusk
];

const VOI_WORD = /\bvoi\b/i;

/**
 * True if `text` looks like it's genuinely about Voi.
 *
 * @param {string} text
 * @param {{requireContext?: boolean, language?: string}} [options]
 *   `requireContext: false` keeps the looser bare-word behaviour, for sources
 *   where the upstream query has already constrained the topic (a "Voi
 *   scooter" news search, say). `language` is the post's language tag when the
 *   platform reports one — it decides whether a bare "#voi" can stand alone.
 */
export function mentionsVoi(text, options = {}) {
  const requireContext = options.requireContext !== false;
  const language = String(options.language || "").slice(0, 2).toLowerCase();
  const ambiguous = AMBIGUOUS_LANGUAGES.has(language);
  const raw = String(text || "");
  if (!raw) return false;

  for (const pattern of EXCLUSIONS) {
    if (pattern.test(raw)) return false;
  }
  for (const pattern of STRONG_MARKERS) {
    if (pattern.test(raw)) return true;
  }
  if (!ambiguous && BARE_HASHTAG.test(raw)) return true;
  if (!VOI_WORD.test(raw)) return false;
  if (!requireContext) return true;

  const lower = raw.toLowerCase();
  return CONTEXT_WORDS.some((word) => lower.includes(word));
}

export const VOI_WORD_RE = VOI_WORD;
