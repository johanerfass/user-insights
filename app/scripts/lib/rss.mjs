/**
 * A minimal RSS 2.0 + Atom reader. Node ships no XML parser and this pipeline
 * stays dependency-free, so feeds are read with targeted string/regex
 * extraction rather than a real parse — good enough for the handful of
 * well-formed fields we need (title, link, date, summary, outlet), and it
 * fails soft (empty strings) on anything it doesn't recognise.
 */

// Matches one <item>…</item> (RSS) or <entry>…</entry> (Atom) at a time.
const ITEM_RE = /<(item|entry)\b[\s\S]*?<\/\1\s*>/gi;

// A Map, not an object literal, so that a feed containing "&constructor;" or
// "&toString;" looks up a miss instead of Object.prototype.
const NAMED_ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", " "],
]);

/**
 * Parse a feed document into `{ feedTitle, items }`. Items are normalised
 * across both formats: `published` is whatever date string the feed used
 * (callers decide how to interpret it), `sourceName` is RSS's per-item
 * <source> outlet name (Google News sets it) and is empty otherwise.
 */
export function parseFeed(xml = "") {
  const source = String(xml);
  const blocks = source.match(ITEM_RE) || [];
  // The channel/feed <title> is the one outside the items, so search what's
  // left after the item blocks are removed.
  const header = source.replace(ITEM_RE, "");
  return {
    feedTitle: clean(tagText(header, "title")),
    items: blocks.map(parseItem),
  };
}

/**
 * Turn feed display HTML into plain text. Entities are decoded before tags are
 * stripped, because feeds escape their markup (`&lt;p&gt;`) as often as they
 * wrap it in CDATA — decoding second would leave the tags in the text. The
 * second pass is what unescapes the escaped escapes that come with that: an
 * "&" inside escaped HTML arrives as `&amp;amp;`, and one pass leaves `&amp;`.
 */
export function stripHtml(html) {
  const unescaped = decodeEntities(String(html ?? ""));
  const withoutTags = unescaped
    // Block boundaries become a space so paragraphs don't run together.
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote|tr)\s*>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    // Everything else is inline markup, and must collapse to nothing rather
    // than a space: Mastodon writes hashtags as `#<span>voi</span>` and
    // mentions as `@<span>user</span>`, which would otherwise come out as
    // "# voi" and "@ user" on the board.
    .replace(/<[^>]*>/g, "");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}

function parseItem(block) {
  return {
    title: clean(tagText(block, "title")),
    link: linkOf(block),
    published: clean(
      tagText(block, "pubDate") || tagText(block, "published") || tagText(block, "updated")
    ),
    summary: clean(
      tagText(block, "description") || tagText(block, "summary") || tagText(block, "content")
    ),
    sourceName: clean(tagText(block, "source")),
  };
}

function linkOf(block) {
  const inline = clean(tagText(block, "link"));
  if (inline) return inline;
  // Atom puts the URL in a self-closing <link href="…"/>, often alongside
  // rel="self"/"replies" variants — the canonical one is rel="alternate".
  const candidates = (block.match(/<link\b[^>]*>/gi) || [])
    .map((tag) => ({ rel: attrValue(tag, "rel"), href: attrValue(tag, "href") }))
    .filter((c) => c.href);
  const alternate = candidates.find((c) => !c.rel || c.rel.toLowerCase() === "alternate");
  return decodeEntities((alternate || candidates[0])?.href || "");
}

function tagText(xml, tag) {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}\\s*>`, "i").exec(xml);
  return match ? match[1] : "";
}

function attrValue(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  if (!match) return "";
  return match[1] !== undefined ? match[1] : match[2];
}

function clean(raw) {
  return stripHtml(unwrapCdata(raw));
}

function unwrapCdata(text) {
  return String(text ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

/** Handles the named entities feeds actually use, plus any numeric escape. */
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (match, body) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      return String.fromCodePoint(code);
    }
    const named = NAMED_ENTITIES.get(body.toLowerCase());
    return named === undefined ? match : named;
  });
}
