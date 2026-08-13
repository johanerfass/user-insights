(() => {
  "use strict";

  const DATA_URL = "./data.json";
  const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // re-check data.json every 5 minutes
  const TICK_MS = 100;
  const MIN_ROTATE_SECONDS = 3;
  const DAILY_RELOAD_HOUR = 4; // local hour to hard-reload the page (low-traffic, keeps a 24/7 kiosk tab fresh)

  const SENTIMENT_COLOR = {
    Negative: "#B04A44",
    Mixed: "#ABD1EA",
    Positive: "#2D7A3A",
  };
  const TREND_GLYPH = { up: "▲", down: "▼", flat: "–" };

  const el = {
    board: document.getElementById("board"),
    windowLabel: document.querySelector('[data-field="windowLabel"]'),
    checkedLabel: document.querySelector('[data-field="checkedLabel"]'),
    postSource: document.querySelector('[data-field="post.source"]'),
    postMarket: document.querySelector('[data-field="post.market"]'),
    postDate: document.querySelector('[data-field="post.date"]'),
    postSentiment: document.querySelector('[data-field="post.sentiment"]'),
    postQuote: document.querySelector('[data-field="post.quote"]'),
    sentimentDot: document.getElementById("sentiment-dot"),
    themeChips: document.getElementById("theme-chips"),
    counter: document.getElementById("post-counter"),
    progressFill: document.getElementById("progress-fill"),
    sentimentBar: document.getElementById("sentiment-bar"),
    negCount: document.getElementById("neg-count"),
    mixedCount: document.getElementById("mixed-count"),
    posCount: document.getElementById("pos-count"),
    themeRows: document.getElementById("theme-rows"),
    sourceChips: document.getElementById("source-chips"),
    rotateLabel: document.getElementById("rotate-label"),
    quoteCard: document.getElementById("quote-card"),
  };

  const state = {
    data: null,
    index: 0,
    elapsedMs: 0,
    lastGeneratedAt: null,
  };

  function rotateSeconds() {
    const s = state.data && state.data.rotateSeconds;
    return Math.max(MIN_ROTATE_SECONDS, Number(s) || 12);
  }

  function currentPost() {
    const posts = (state.data && state.data.posts) || [];
    if (!posts.length) return null;
    return posts[state.index % posts.length];
  }

  function renderStatic() {
    const data = state.data;
    if (!data) return;
    el.windowLabel.textContent = data.windowLabel || "";
    el.checkedLabel.textContent = data.checkedLabel || "";
    el.rotateLabel.textContent = rotateSeconds() + "s";

    const s = data.sentimentSummary || { negative: 0, mixed: 0, positive: 0 };
    const total = (s.negative || 0) + (s.mixed || 0) + (s.positive || 0);
    const pct = (n) => (total > 0 ? (n / total) * 100 : 0) + "%";
    const segs = el.sentimentBar.children;
    segs[0].style.width = pct(s.negative || 0);
    segs[1].style.width = pct(s.mixed || 0);
    segs[2].style.width = pct(s.positive || 0);
    el.negCount.textContent = s.negative || 0;
    el.mixedCount.textContent = s.mixed || 0;
    el.posCount.textContent = s.positive || 0;

    const themes = data.themes || [];
    const maxCount = themes.reduce((m, t) => Math.max(m, t.count || 0), 0) || 1;
    el.themeRows.innerHTML = "";
    for (const row of themes) {
      const wrap = document.createElement("div");
      wrap.className = "theme-row";
      const glyph = TREND_GLYPH[row.trend] || "–";
      const deltaText =
        row.trend === "flat" || !row.delta
          ? ""
          : " " + (row.delta > 0 ? "+" : "") + row.delta;
      wrap.innerHTML = `
        <div class="theme-row__label-col">
          <span class="theme-row__label">${escapeHtml(row.label)}</span>
          <div class="theme-row__track"><div class="theme-row__fill" style="width:${
            ((row.count || 0) / maxCount) * 100
          }%"></div></div>
        </div>
        <span class="theme-row__count">${row.count || 0}</span>
        <span class="theme-row__trend">${glyph}${deltaText}</span>
      `;
      el.themeRows.appendChild(wrap);
    }

    const sources = data.sources || [];
    el.sourceChips.innerHTML = "";
    for (const src of sources) {
      const chip = document.createElement("span");
      chip.className = "source-chip";
      chip.textContent = `${src.label} · ${src.count}`;
      el.sourceChips.appendChild(chip);
    }
  }

  function renderSlide() {
    const post = currentPost();
    const posts = (state.data && state.data.posts) || [];

    if (!post) {
      el.quoteCard.classList.add("is-empty");
      el.postSource.textContent = "";
      el.postMarket.textContent = "";
      el.postDate.textContent = "";
      el.postSentiment.textContent = "";
      el.sentimentDot.style.background = "transparent";
      el.themeChips.innerHTML = "";
      el.counter.textContent = "0 / 0";
      el.postQuote.textContent = "";
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No new rider chatter this window.";
      el.postQuote.appendChild(empty);
      return;
    }
    el.quoteCard.classList.remove("is-empty");

    el.postSource.textContent = post.source || "";
    el.postMarket.textContent = post.market || "";
    el.postDate.textContent = post.date || "";
    el.postSentiment.textContent = post.sentiment || "";
    el.sentimentDot.style.background = SENTIMENT_COLOR[post.sentiment] || "#A9A3A5";
    el.postQuote.textContent = post.quote || "";

    el.themeChips.innerHTML = "";
    for (const theme of post.themes || []) {
      const chip = document.createElement("span");
      chip.className = "theme-chip";
      chip.textContent = theme;
      el.themeChips.appendChild(chip);
    }

    el.counter.textContent = `${state.index + 1} / ${posts.length}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function advance(delta) {
    const posts = (state.data && state.data.posts) || [];
    if (!posts.length) return;
    state.index = (state.index + delta + posts.length) % posts.length;
    state.elapsedMs = 0;
    renderSlide();
    el.progressFill.style.width = "0%";
  }

  function tick() {
    if (!state.data) return;
    const posts = state.data.posts || [];
    if (!posts.length) return;
    const durMs = rotateSeconds() * 1000;
    state.elapsedMs += TICK_MS;
    if (state.elapsedMs >= durMs) {
      advance(1);
      return;
    }
    el.progressFill.style.width = Math.min(100, (state.elapsedMs / durMs) * 100).toFixed(1) + "%";
  }

  function applyData(data, { resetIndex } = {}) {
    state.data = data;
    if (resetIndex || state.index >= (data.posts || []).length) {
      state.index = 0;
    }
    state.elapsedMs = 0;
    state.lastGeneratedAt = data.generatedAt || null;
    renderStatic();
    renderSlide();
    el.progressFill.style.width = "0%";
  }

  async function fetchData() {
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`data.json request failed: HTTP ${res.status}`);
    return res.json();
  }

  async function initialLoad() {
    try {
      const data = await fetchData();
      applyData(data, { resetIndex: true });
    } catch (err) {
      console.error("[rider-signal-board] failed to load data.json", err);
      applyData(
        {
          windowLabel: "—",
          checkedLabel: "—",
          rotateSeconds: 12,
          posts: [],
          sentimentSummary: { negative: 0, mixed: 0, positive: 0 },
          themes: [],
          sources: [],
        },
        { resetIndex: true }
      );
    }
  }

  async function pollForUpdates() {
    try {
      const data = await fetchData();
      if (data.generatedAt && data.generatedAt === state.lastGeneratedAt) return;
      applyData(data, { resetIndex: false });
    } catch (err) {
      console.warn("[rider-signal-board] refresh check failed", err);
    }
  }

  function scaleBoard() {
    const scale = Math.min(
      window.innerWidth / 1920,
      window.innerHeight / 1080
    );
    el.board.style.transform = `scale(${scale})`;
  }

  function scheduleDailyReload() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(DAILY_RELOAD_HOUR, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const ms = next.getTime() - now.getTime();
    setTimeout(() => window.location.reload(), ms);
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") advance(1);
    if (e.key === "ArrowLeft") advance(-1);
  });
  window.addEventListener("resize", scaleBoard);

  scaleBoard();
  initialLoad();
  setInterval(tick, TICK_MS);
  setInterval(pollForUpdates, REFRESH_INTERVAL_MS);
  scheduleDailyReload();
})();
