# Rider signal board

A TV-screen dashboard of what riders are publicly saying about Voi — pulled
from Trustpilot, the App Store, Google Play and Reddit, classified by
sentiment and theme, and shown as a rotating carousel. This is the production
implementation of the `Rider Signal Board.dc.html` design exported from
Claude Design (see `../project/` and `../chats/` for the original design
source and brief).

It's two independent pieces:

- **`public/`** — a static, dependency-free board (`index.html` +
  `styles.css` + `board.js`) that reads `public/data.json` and renders the
  carousel. Point any browser (a TV's built-in browser, a kiosk Chrome
  instance, etc.) at `public/index.html`.
- **`scripts/`** — a Node pipeline (`npm run fetch`) that fetches posts from
  each source, classifies them, and writes `public/data.json`. Run it once a
  day (cron, GitHub Actions, whatever you already use) — the board itself
  re-checks `data.json` every 5 minutes and picks up changes without a
  manual reload.

## Quick start

```sh
cd app
npm install            # only needed for the optional Google Play scraper
npm run serve           # serves public/ at http://localhost:8080
```

Open `http://localhost:8080` — it renders against the sample data already
seeded in `public/data.json` (the same posts as the original design mock),
so it works before you've configured any real sources.

To pull real data:

```sh
cp scripts/config.example.json scripts/config.json   # then edit app IDs etc.
cp .env.example .env                                    # then fill in keys you have
npm run fetch
```

Run `npm test` to run the pipeline's unit tests (parsing, classification,
windowing, aggregation) — they run against fixtures, no network needed.

## The board (`public/`)

- Fixed 1920×1080 design, scaled to fit whatever screen it's on (see
  `scaleBoard()` in `board.js`) — safe for any TV resolution.
- Auto-rotates through posts every `rotateSeconds` (from `data.json`,
  default 12s), with a progress bar; Left/Right arrow keys step through
  manually.
- Polls `data.json` every 5 minutes and hot-swaps in new data without a full
  reload; also hard-reloads the page once a day (04:00 local time) so a
  browser tab left open 24/7 doesn't accumulate memory/state drift.
- Renders a plain "No new rider chatter this window" message if `posts` is
  empty, instead of breaking.
- Fonts (Sora) and all colors/spacing are copied verbatim from the Claude
  Design export so it's pixel-matched — see `project/Rider Signal
  Board.dc.html` for the original.

## The data contract (`public/data.json`)

This is the interface between the pipeline and the board — anything that
produces a file in this shape can drive the display (you don't have to use
the bundled pipeline).

```ts
{
  generatedAt: string;       // ISO timestamp of the last pipeline run
  checkedLabel: string;      // display label, e.g. "13 Aug 2026"
  windowLabel: string;       // display label, e.g. "Last 6 weeks"
  rotateSeconds: number;     // carousel dwell time per post
  posts: Array<{
    id: string;
    source: string;          // "Trustpilot" | "App Store" | "Google Play" | "Reddit" | ...
    market: string;          // e.g. "London, UK", "r/london", "DE"
    date: string;            // display label, e.g. "3 Aug 2026" or "Recent"
    sentiment: "Positive" | "Negative" | "Mixed";
    quote: string;           // shortened, already quote-wrapped
    themes: string[];        // 1-2 short theme labels
    url: string | null;
  }>;
  sentimentSummary: { negative: number; mixed: number; positive: number };
  themes: Array<{ label: string; count: number; trend: "up" | "down" | "flat"; delta: number }>;
  sources: Array<{ label: string; count: number }>;
}
```

The board computes all bar widths/percentages client-side from these counts
— nothing is pre-baked, so `data.json` is the single source of truth.

## The pipeline (`scripts/`)

`npm run fetch` (`scripts/fetch-posts.mjs`) does, in order:

1. **Fetch** from each source in parallel — one source failing (bad
   credentials, rate limit, network blip) doesn't stop the others.
2. **Dedupe** across sources by id/quote.
3. **Classify** each post's sentiment + themes.
4. **Pick a window**: tries "last week" first, widening to "last month" →
   "last 6 weeks" → "last quarter" until there are enough posts to fill a
   carousel (configurable, see `scripts/config.example.json` →
   `window.minPostsForWindow`) — this is what the original ask ("last
   week/month depending on the amount of posts") described.
5. **Aggregate**: sentiment split, theme counts (with trend vs. the
   *previous* `data.json`), source counts.
6. **Write** `public/data.json` atomically (write to `.tmp`, then rename).

### Sources

| Source | How it's fetched | Auth needed |
|---|---|---|
| Reddit | Public `reddit.com/search.json` endpoint | No — needs a descriptive `User-Agent` only |
| App Store | Apple's public RSS customer-reviews feed | No |
| Google Play | Community `google-play-scraper` package (optional dep) | No, but unofficial — see caveat below |
| Trustpilot | Trustpilot Business API | **Yes** — API key + business unit ID |

Configure all of this in `scripts/config.json` (copy from
`scripts/config.example.json`):

- `reddit.queries` / `reddit.subreddits` — what to search for.
- `appStore.appId` / `appStore.countries` — Voi's App Store id per
  storefront.
- `googlePlay.appId` / `googlePlay.countries` — Voi's Play Store package id.
- `trustpilot.businessUnitId` — from your Trustpilot Business account. Set
  the `TRUSTPILOT_API_KEY` env var (see `.env.example`) to enable it.

**Caveats, on purpose:**

- **Trustpilot has no free/key-less public API.** Scraping its review pages
  directly isn't something this pipeline does, since that's against
  Trustpilot's terms. If you don't have Business API access, export reviews
  to CSV from the Trustpilot dashboard and drop them at
  `data/trustpilot-import.csv` (columns: `id,date,location,stars,text,url` —
  see `scripts/lib/trustpilot.mjs`); the pipeline reads that as a fallback.
- **`google-play-scraper` is a community package**, not an official Google
  API. It reads the same public review data shown on a Play Store listing.
  It's an optional dependency — if it isn't installed, that source is
  skipped rather than failing the run. Its behavior can break if Google
  changes their page structure; treat it as best-effort.
- **Reddit search is keyword-based** (`\bvoi\b`, word-boundary matched so it
  doesn't catch "void"/"voice"). Tune `reddit.queries` if you're getting
  noise or missing relevant posts.

### Sentiment & theme classification (`scripts/lib/classify.mjs`)

By default this is a small, deterministic keyword lexicon — no API key
needed, runs instantly, easy to audit and tune (edit the word lists at the
top of the file). It defaults ambiguous/no-signal text to **"Mixed"** rather
than "Negative" — a neutral report shouldn't read as a complaint just
because it didn't hit a positive-word list.

For better accuracy, set `classification.useClaude: true` in
`scripts/config.json` and provide `ANTHROPIC_API_KEY` — the whole batch of
posts is classified in one Claude call, with an automatic fallback to the
heuristic per-post if that call fails for any reason.

### Trend arrows

Each theme's trend (▲/▼/–) compares its count in this run against its count
in the *previous* `public/data.json` — so the first run after switching on
the pipeline will show every theme trending "up" (nothing to compare
against yet). This self-corrects from the second run onward.

## Scheduling the daily run + hosting

Two workflows, chained:

- **`.github/workflows/daily-fetch.yml`** runs `npm run fetch` once a day via
  GitHub Actions and commits the updated `public/data.json` back to `main`
  (needs `TRUSTPILOT_API_KEY` / `ANTHROPIC_API_KEY` as repo secrets if you use
  them).
- **`.github/workflows/deploy-pages.yml`** deploys `app/public/` to GitHub
  Pages whenever it changes on `main` — including the commit `daily-fetch`
  just made, so a new `data.json` lands and republishes automatically.

Live URL, once Pages is enabled: `https://<owner>.github.io/<repo>/`. Pages
usually needs enabling once per repo: **Settings → Pages → Build and
deployment → Source: "GitHub Actions"** (only needed if the first workflow
run doesn't turn it on automatically). Point the TV's browser at that URL.

If you're hosting elsewhere instead (internal server, S3, etc.), drop the
Pages workflow and swap `daily-fetch.yml`'s last step for however you
actually publish `public/` — the important part is just that `npm run fetch`
runs daily and `public/data.json` ends up wherever the TV's browser loads it
from.

## Testing

```sh
npm test
```

Runs `scripts/test/*.test.mjs` (Node's built-in test runner) against
fixtures for each fetcher's response shape, the classifier, the window
picker, and the aggregator — no network access required.
