# Reef Design System — Voi

This is **Reef**, Voi's internal design system. Voi is a European shared-micromobility company (e-scooters and e-bikes) that operates in cities across Europe. Reef powers Voi's rider mobile apps, operations tooling and marketing surfaces.

> **One brand rule before anything else.** Voi Coral is a **brand-only** colour. Use it for logos, brand moments, hero illustrations and celebratory marketing — **never for primary CTAs**. Primary buttons are **Tire (#282425)**, a soft near-black. When in doubt: rounded corners, soft surfaces, warm neutrals, Sora type.

> **Default aesthetic — light, soft, modern.** Closer to Apple.com or Ultrahuman than a colourful consumer app. Almost entirely white and near-neutral with a single restrained accent. The full palette exists for edge cases; everyday output is white, Pearl, or the signature **soft mesh gradient** (warm coral-peach in one corner, cool sky in the opposite, fading through off-white). One screen = one accent. If a second colour block creeps in, remove one. The full ruleset is in `CLAUDE.md` §1b — read it before building.

---

## Sources

- **Figma (attached):** *Reef — Design System (v.1.3.2).fig* — 27 pages, 295 frames. Mounted as virtual FS. Core references:
  - `/Foundation/Colour-Palette`, `/Foundation/Colour-Themes`
  - `/Foundation/Typography`, `/Foundation/Font-Info`
  - `/Foundation/Shadows`, `/Foundation/Spacing`
  - `/Buttons`, `/Cards`, `/Chips`, `/Dialog`, `/Input`, `/List`, `/Navigation`, `/Sheets`, `/Search`
  - `/Icons` (filled + outline sets, payment methods, animated loops)
  - `/Logotype` (9 lockups)
  - `/basic-screens-For-designers` (home, map, keyboard, on-scroll, with-fade)
- **Brand assets (uploaded):** Voi wordmarks / symbols / lockups in black / coral / white + Sora TTF family.

No codebase was provided — all guidance below is extracted from the Figma file and uploaded brand assets.

---

## Index (what's in this folder)

```
README.md                 ← this file
CLAUDE.md                 ← canonical project rules — auto-applied to every chat
SKILL.md                  ← in-project skill mirror (points to CLAUDE.md)
voi-reef-skill/SKILL.md   ← portable downloadable skill (CSS inlined, works anywhere)
colors_and_type.css       ← CSS variables — palette, theme layers, sizing, shadows, radii
fonts/                    ← Sora TTFs (Light/Regular/Medium/SemiBold/Bold/ExtraBold + Variable)
assets/
  logos/                  ← Voi wordmarks, symbols and lockups (black / coral / white)
preview/                  ← design-system cards (registered to the Design System tab)
  aesthetic.html          ← signature mesh-gradient surface + restraint rules
  theme-tokens.html       ← Light/Dark playground for content/surface/fill tokens
ui_kits/
  rider-app/              ← iOS rider app UI kit: map home, ride-in-progress, end-ride, profile
```

### Web components

In addition to the mobile-first core, Reef ships a full set of **web components** (for the Business dashboard, Ops console and marketing surfaces). These live under `preview/` and match the phone kit's vocabulary — Sora, pill corners, Tire-dark primary, warm neutrals.

- `preview/web-toolbar.html` — top app bar: default 72 px, compact 56 px, search-open, dark + user menu
- `preview/side-nav.html` — full 260 px rail with sections, badges, user footer; plus a collapsed 72 px rail
- `preview/breadcrumbs.html` — standard, home-anchor, pill, overflow, dark
- `preview/pagination.html` — numbered, prev/next pills, simple page-size selector
- `preview/tabs.html` — underline, segmented, filter pills, vertical settings
- `preview/accordion.html` — flat FAQ, card with icons, plus-toggle marketing
- `preview/tooltip.html` — dark + light, four placements, keyboard-hint and rich variants
- `preview/avatar.html` — 6 sizes × 6 tones, status dots, stacked groups, square/brand
- `preview/table.html` — sortable columns, multi-select with action bar, status pills, inline progress, footer pagination

All use the same tokens in `colors_and_type.css` and the Reef focus ring (`#0075DB`).

---

## Content fundamentals

Voi's voice is **warm, human, urban, confident, concise.** Product copy reads like a friend who moves through the city — playful without being cute, technical without being cold.

**Tone & register**
- **You / your** (never "the user"). Direct address.
- **We** for Voi as a team ("We'll send you a receipt").
- Sentence case across the board — headlines, buttons, labels. Not Title Case, not UPPER.
- Short sentences. Verbs up front. Example button labels: *Start ride*, *End ride*, *Report a problem*, *See how it works*.
- Commands are friendly, not barky: *End ride* (not "Submit"), *Let's go* (not "Continue"), *Scan to unlock* (not "Unlock scooter").
- Brand catchphrase flavour: **"Cities made for living."** (appears in Display 1 specimen in the Figma). That's the vibe — civic, optimistic, not tech-bro.

**Do's**
- Lead with the action or outcome: "Your ride is ready."
- Be specific about numbers and place: "0.25 €/min · Malmö zone".
- When things go wrong, explain + offer the next step: "No signal here. Try walking a few metres."
- Safety content is direct and unambiguous: "Helmet on. Wheels on the road.", "No riding on pavements."

**Don'ts**
- No emoji in product UI. (Brand marketing may occasionally use an illustrated icon — but emoji fonts are not used.)
- No exclamation mark stacking. One, sparingly.
- Avoid jargon: "Start ride" not "Initiate trip".
- Never call the user a "user". Never say "please" in buttons.

**Copy examples lifted from screens**
- *Scan to ride* · *Where to?* · *Reserved for you — 15 min*
- *You're all set* · *Nice ride* · *Report a problem*
- *This scooter needs a break* (low-battery state)
- *Add payment to keep rolling*

---

## Visual foundations

**Vibe.** Calm, airy, premium — closer to Apple.com or Ultrahuman than a colourful consumer app. Rounded forms, generous whitespace, white/Pearl backgrounds, a single coral accent that earns its keep. The full palette exists for edge cases; everyday output is almost entirely white and near-neutral. **Squint test:** if any colour jumps out other than a single accent, it's too much.

**Signature surface — the mesh gradient.** For presentation, marketing or hero contexts, use the warm-cool mesh — coral-peach in one corner bleeding into sky in the opposite, fading through off-white in the centre. Cards float on top as white with `--shadow-card` and 32 px radius — frosted glass resting on the gradient.

```css
/* Light mesh */
background:
  radial-gradient(ellipse at 15% 85%, rgba(242,105,97,0.18) 0%, transparent 55%),
  radial-gradient(ellipse at 85% 10%, rgba(171,209,234,0.22) 0%, transparent 55%),
  #faf4ec;

/* Dark mesh */
background:
  radial-gradient(ellipse at 80% 20%, rgba(242,105,97,0.15) 0%, transparent 50%),
  #161314;
```

**Never use a flat coloured background** (no solid coral, no solid chestnut, no solid blue) except for the Voi+ subscription card — a deliberate brand exception.

**Colours**
- Three working background families: **Pearl (#F2F2F6)** for app canvas, **White** for cards, **Sand (#FAF4EC)** as the mesh-gradient base for hero/marketing surfaces.
- Text is **Tire (#282425)** — a soft near-black, never pure `#000` in-product.
- **Coral (#F26961) is brand-only.** Never a button. It appears in the logo, the splash moment, a celebratory illustration, Voialty (rewards) hero.
- **One accent maximum per screen.** Coral for brand/marketing moments; Sky / Space for functional states (reservations, info banners). Colour is punctuation, not wallpaper.
- Neutrals are warm-tinted greys named as materials: *Pearl → Chalk → Shell → Marble → Granite → Gravel → Slate → Tarmac → Basalt → Graphite → Charcoal → Rubber → Asphalt.*
- Semantic: Success green, Warning amber, Error red, Info blue, Mandatory magenta, Pending teal — each with `-light` and `-dark` pair.

**Type**
- **Sora** throughout. SemiBold (600) for headlines, Light (300) for body, Bold (700) for emphasis, Regular (400) for preambles.
- Headings track **-4% letter-spacing** (`-0.04em`) — tight, confident.
- Line-height tight on display (100%), comfortable on body (~150%).
- Body copy 15–16px; buttons 12–16px Bold.

**Backgrounds, imagery, motifs**
- Default: white or Pearl. For hero/marketing/presentation: the signature mesh gradient (above).
- Full-bleed photography of city scenes (warm, golden-hour, riders in motion, European streetscapes). Never stocky, never greyscale.
- Feature illustrations use flat coral + cream + tire, with soft rounded geometry.
- No decorative gradients beyond the signature mesh. No diamond/iridescent effects. An occasional **protection gradient** (dark→transparent) under a status bar on top of imagery — that's it.
- Map is the app's hero surface; it bleeds edge-to-edge, with floating pill-shaped UI on top.

**Corner radii**
- Everything rounds. Buttons and chips are **pill (999px)**. Cards and sheets are **32px (xl)**. Large feature surfaces are **40px (2xl)**. Inputs are **16px (md)**. Nothing is square.

**Shadows / elevation**
- Light and few. Signature card shadow is a **2px 4px offset, no blur, 8% black** — a soft, deliberate "paper" lift.
- Elevated floating elements (sheets, FABs) use **shallow** `0 0 16px rgba(0,0,0,.12)`.
- Bottom sheets rise with **deep-above** `0 -16px 48px rgba(0,0,0,.12)`. Cards/menus drop with **deep-below**.

**Borders**
- 1px `Shell (#E8E4E5)` for default dividers; `Marble` for stronger; `Granite` for outlined buttons. Borders are thin and warm-grey, never black.

**Focus / hover / press**
- **Hover:** fill darkens by one step (Tire → Graphite) or a neutral tint fills the outlined button (→ Chalk).
- **Press:** fill darkens two steps (Tire → Rubber); or a deeper shell on outlined.
- **Focus ring:** double-ring — inner 2–4px `white`, outer 3–4px `Info #0075DB`. Signature branded focus.
- Disabled: Marble fill, Gravel text, no shadow.

**Motion**
- Gentle. `cubic-bezier(0.2, 0, 0, 1)` ease-out for entries, 200–240ms. Sheets slide up 320ms ease-out. Map pins drop with small bounce (spring). No parallax, no flashy loaders — Voi's loader is a subtle scooter icon spin or a 3-dot pulse.

**Transparency & blur**
- Rare. Used on map-overlay top bars (24% black scrim + 8px backdrop blur), and on full-bleed photo heroes (protection gradient only).

**Layout rules**
- Fixed elements: status bar, app bar (top), floating action pill / bottom sheet handle (bottom). Content scrolls between them.
- 16px outer page gutters on mobile; 24px on larger.
- Sheets slide from bottom, rounded 32px on top corners only, with a 36×5px granite handle.

**Imagery colour vibe**
- Warm. Golden light, coral and cream accents. Slight film grain OK; never desaturated, never cool/blue.

---

## Component exceptions worth knowing

Three contexts deliberately break the everyday rules. They're brand moments, not patterns to copy elsewhere.

- **Voi+ / subscription card** — flat **Chestnut (#500402)** background with white text and Coral accents (badge fills, checkmarks, accent text). The one place a flat coloured background is allowed.
- **Reservation / countdown banner** — **Sky (#ABD1EA)** surface, **Space (#243860)** text, **Info (#0075DB)** progress fill. Used for time-sensitive states (reservations, vehicle holds).
- **Go / Start-ride CTA** — distinct **green (~#2D7A3A)** rather than Tire. A contextual exception for *initiating movement* only — never use green as a general CTA colour.

**Pricing display** — strikethrough original in `--content-body-tertiary` (neutral), discounted price in **Coral**, savings copy ("Save X%") also in Coral on white card. Specific numbers always include currency + unit: *€3.90*, *3 kr/min*, *50/60 minutes*.

---

## Iconography

- Voi uses a custom in-house icon set in Figma (`/Icons/regular`, `/Icons/Filled_light`, `/Icons/Filled_dark`). Most common: `icon-heart`, `icon-menu`, `icon-chevron-right`, `icon-filled-discount`. **These icon SVGs were not included in the Figma export — flagged below.**
- **Temporary substitution:** the UI kit links **Lucide** from CDN (`https://unpkg.com/lucide@latest`) as the closest match — a single-stroke, rounded-line set with the same visual weight. Flag: swap these for the real Voi icon set once provided.
- No emoji in product UI. Unicode symbols are occasionally used in compact UI (▸, •).
- App-icons (launcher, OS-level) live in `/app-icons` in Figma — typically a white symbol on coral, rounded-square.
- Payment-method icons (Visa, Mastercard, Apple/Google Pay, Klarna, Swish) are real brand marks, not re-drawn.

---

Want pixel-perfect recreations of screens the Figma exported? Point me at the specific frames (e.g. `/basic-screens-For-designers/Map---Empty`) and I'll faithfully recreate them.
