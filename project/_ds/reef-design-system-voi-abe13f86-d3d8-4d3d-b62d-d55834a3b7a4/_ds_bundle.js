/* @ds-bundle: {"format":2,"namespace":"ReefDesignSystemVoi_abe13f","components":[],"sourceHashes":{"ui_kits/rider-app/MapboxMap.jsx":"2a52e86225c1","ui_kits/rider-app/VoiHome26.jsx":"fc7ef2e24718","ui_kits/rider-app/VoiMapScreen.jsx":"d215df31d5f9","ui_kits/rider-app/VoiMenuScreen.jsx":"7545f1f3ffc7","ui_kits/rider-app/VoiRideScreen.jsx":"4c424bd4e16c","ui_kits/rider-app/VoiSheets26.jsx":"4709703b535a","ui_kits/rider-app/design-canvas.jsx":"3fc2600126c0","ui_kits/rider-app/ios-frame.jsx":"d67eb3ffe562"},"inlinedExternals":[]} */

(() => {

const __ds_ns = (window.ReefDesignSystemVoi_abe13f = window.ReefDesignSystemVoi_abe13f || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/rider-app/MapboxMap.jsx
try { (() => {
// MapboxMap.jsx — Reusable Mapbox GL background for Voi rider screens.
//
// Drop-in replacement for the SVG <Map26/>. Renders a real Mapbox map as a
// position:absolute, inset:0 background. Geolocates the browser on first
// mount; falls back to Paris if geolocation is denied or unavailable.
//
// Usage:
//   <MapboxMap />                                  // default style, geolocate
//   <MapboxMap style="mapbox://styles/mapbox/dark-v11" />
//   <MapboxMap interactive={false} />              // static background
//   <MapboxMap center={[2.35, 48.85]} zoom={15} pitch={45} bearing={-20} />
//
// To use your own access token, set `window.MAPBOX_TOKEN = 'pk....'` BEFORE
// this script loads, or pass `token="pk...."` as a prop. Without a token the
// component falls back to the SVG Map26 and shows a small dev hint.
//
// Mapbox GL JS + CSS are injected lazily on first mount and cached globally.

const MAPBOX_VERSION = '3.7.0';
const MAPBOX_JS = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_VERSION}/mapbox-gl.js`;
const MAPBOX_CSS = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_VERSION}/mapbox-gl.css`;

// Paris — fallback when geolocation is unavailable or denied.
const PARIS = {
  center: [2.3522, 48.8566],
  zoom: 13.5
};

// ─── Token plumbing ──────────────────────────────────────────────────
// Order of precedence: prop → window.MAPBOX_TOKEN → null
function getMapboxToken(propToken) {
  if (propToken) return propToken;
  if (typeof window !== 'undefined' && window.MAPBOX_TOKEN) return window.MAPBOX_TOKEN;
  return null;
}

// ─── Lazy-load Mapbox GL JS + CSS exactly once ───────────────────────
let _mapboxLoading = null;
function loadMapbox() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.mapboxgl) return Promise.resolve(window.mapboxgl);
  if (_mapboxLoading) return _mapboxLoading;
  _mapboxLoading = new Promise((resolve, reject) => {
    // CSS
    if (!document.querySelector(`link[data-mapbox-gl]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = MAPBOX_CSS;
      link.setAttribute('data-mapbox-gl', '');
      document.head.appendChild(link);
    }
    // JS
    const script = document.createElement('script');
    script.src = MAPBOX_JS;
    script.async = true;
    script.onload = () => {
      if (window.mapboxgl) resolve(window.mapboxgl);else reject(new Error('mapbox-gl loaded but window.mapboxgl missing'));
    };
    script.onerror = () => reject(new Error('failed to load mapbox-gl'));
    document.head.appendChild(script);
  });
  return _mapboxLoading;
}

// ─── Geolocation, cached for the session ─────────────────────────────
let _locationPromise = null;
function getUserLocation() {
  if (_locationPromise) return _locationPromise;

  // Reuse a previously cached coord from this session so we don't re-prompt.
  try {
    const cached = sessionStorage.getItem('mapboxmap-coords');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length === 2) {
        _locationPromise = Promise.resolve({
          center: parsed,
          zoom: 13.5,
          source: 'cache'
        });
        return _locationPromise;
      }
    }
  } catch (_) {/* ignore */}
  _locationPromise = new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve({
        ...PARIS,
        source: 'fallback-no-api'
      });
      return;
    }
    let settled = false;
    const done = val => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };

    // Hard timeout — some browsers hang the geolocation prompt indefinitely
    // when the user ignores it; we want a snappy fallback to Paris.
    const timer = setTimeout(() => done({
      ...PARIS,
      source: 'fallback-timeout'
    }), 6000);
    navigator.geolocation.getCurrentPosition(pos => {
      clearTimeout(timer);
      const center = [pos.coords.longitude, pos.coords.latitude];
      try {
        sessionStorage.setItem('mapboxmap-coords', JSON.stringify(center));
      } catch (_) {}
      done({
        center,
        zoom: 13.5,
        source: 'geolocation'
      });
    }, _err => {
      clearTimeout(timer);
      done({
        ...PARIS,
        source: 'fallback-denied'
      });
    }, {
      enableHighAccuracy: false,
      timeout: 5500,
      maximumAge: 5 * 60 * 1000
    });
  });
  return _locationPromise;
}

// ─── Theme resolution ───────────────────────────────────────────────
// 'auto' follows window.C26.mode (set by setReefTheme), then a `dark` class
// on <body>, then the OS preference. Returns 'light' or 'dark'.
function resolveTheme(t) {
  if (t === 'light' || t === 'dark') return t;
  if (typeof window !== 'undefined' && window.C26 && window.C26.mode) {
    return window.C26.mode === 'dark' ? 'dark' : 'light';
  }
  if (typeof document !== 'undefined' && document.body && document.body.classList.contains('dark')) {
    return 'dark';
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

// Apply theme to a live map. For Mapbox Standard this swaps the
// `lightPreset` config slot (day ↔ night). For non-Standard styles this is
// a no-op (the call throws and we swallow it).
function applyTheme(map, theme) {
  try {
    const preset = theme === 'dark' ? 'night' : 'day';
    map.setConfigProperty('basemap', 'lightPreset', preset);
  } catch (_) {/* style doesn't expose lightPreset */}
}

// ─── Token-missing notice (dev-only hint, sits over the SVG fallback) ─
function MapboxMissingTokenHint() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 14,
      top: 14,
      zIndex: 20,
      maxWidth: 260,
      padding: '10px 12px',
      background: 'rgba(255,255,255,.92)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(40,36,37,.12)',
      borderRadius: 12,
      boxShadow: '0 6px 20px -6px rgba(40,36,37,.25)',
      fontFamily: '-apple-system,system-ui,sans-serif'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: '#F26961',
      textTransform: 'uppercase',
      letterSpacing: '.06em'
    }
  }, "Mapbox token missing"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#282425',
      marginTop: 4,
      lineHeight: 1.4
    }
  }, "Set ", /*#__PURE__*/React.createElement("code", {
    style: {
      background: '#F2EFEA',
      padding: '1px 4px',
      borderRadius: 4
    }
  }, "window.MAPBOX_TOKEN"), " or pass a ", /*#__PURE__*/React.createElement("code", {
    style: {
      background: '#F2EFEA',
      padding: '1px 4px',
      borderRadius: 4
    }
  }, "token"), " prop. Showing SVG fallback."));
}

// ─────────────────────────────────────────────────────────────────────
// MapboxMap
// ─────────────────────────────────────────────────────────────────────
function MapboxMap({
  // Mapbox style URL. Leave undefined to use Mapbox's default Standard style
  // (already styled correctly per project requirements).
  style = 'mapbox://styles/mapbox/standard',
  // 'light' | 'dark' | 'auto'. With Mapbox Standard, this is wired to the
  // style's `lightPreset` config slot. 'auto' follows window.C26.mode (set
  // by the rider-app theme toggle), then body.dark, then OS preference.
  theme = 'auto',
  // [lng, lat]. If null, geolocates → Paris fallback.
  center = null,
  zoom = 13.5,
  pitch = 0,
  bearing = 0,
  interactive = true,
  token,
  // prop override for window.MAPBOX_TOKEN
  onMap,
  // callback(mapInstance) once ready, for adding markers/layers
  showFallbackHint = true
}) {
  const ref = React.useRef(null);
  const mapRef = React.useRef(null);
  const [status, setStatus] = React.useState('idle'); // idle | loading | ready | no-token | error

  const resolvedToken = getMapboxToken(token);
  const resolvedTheme = resolveTheme(theme);
  React.useEffect(() => {
    if (!resolvedToken) {
      setStatus('no-token');
      return;
    }
    if (!ref.current) return;
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const mapboxgl = await loadMapbox();
        if (cancelled) return;
        mapboxgl.accessToken = resolvedToken;
        const startCenter = center || (await getUserLocation()).center;
        if (cancelled) return;
        const map = new mapboxgl.Map({
          container: ref.current,
          style,
          center: startCenter,
          zoom,
          pitch,
          bearing,
          interactive,
          attributionControl: false,
          // we add a tiny one bottom-left manually
          cooperativeGestures: false
          // dragRotate handles tilt with two-finger drag / right-click drag
        });
        mapRef.current = map;
        map.on('load', () => {
          if (cancelled) {
            map.remove();
            return;
          }
          applyTheme(map, resolvedTheme);
          setStatus('ready');
          if (typeof onMap === 'function') onMap(map);
        });
        map.on('error', e => {
          // 401 / bad token / style errors land here. Don't tear the UI
          // down — just log; the map shows blank tiles which is obvious.
          // eslint-disable-next-line no-console
          console.warn('[MapboxMap]', e?.error?.message || e);
        });
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[MapboxMap] init failed', err);
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (_) {}
        mapRef.current = null;
      }
    };
    // Re-init when these change. center/onMap intentionally excluded — we
    // don't want to rebuild the map on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedToken, style, interactive]);

  // Imperative theme switch — no rebuild needed.
  React.useEffect(() => {
    const m = mapRef.current;
    if (!m || status !== 'ready') return;
    applyTheme(m, resolvedTheme);
  }, [resolvedTheme, status]);

  // Imperative updates that don't require rebuilding the map.
  React.useEffect(() => {
    const m = mapRef.current;
    if (!m || status !== 'ready' || !center) return;
    m.flyTo({
      center,
      zoom,
      pitch,
      bearing,
      duration: 600
    });
  }, [center && center[0], center && center[1], zoom, pitch, bearing, status]);

  // No token → render SVG fallback (Map26) and an optional hint.
  if (status === 'no-token') {
    return /*#__PURE__*/React.createElement(React.Fragment, null, typeof Map26SVG === 'function' ? /*#__PURE__*/React.createElement(Map26SVG, null) : null, showFallbackHint && /*#__PURE__*/React.createElement(MapboxMissingTokenHint, null));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: 'absolute',
      inset: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 6,
      bottom: 6,
      zIndex: 1,
      pointerEvents: 'auto',
      fontFamily: '-apple-system,system-ui,sans-serif',
      fontSize: 9,
      lineHeight: 1,
      color: 'rgba(40,36,37,.55)',
      background: 'rgba(255,255,255,.6)',
      padding: '2px 5px',
      borderRadius: 3
    }
  }, "\xA9 Mapbox \xA9 OSM"));
}
Object.assign(window, {
  MapboxMap,
  loadMapbox,
  getUserLocation
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/rider-app/MapboxMap.jsx", error: String((e && e.message) || e) }); }

// ui_kits/rider-app/VoiHome26.jsx
try { (() => {
// VoiHome26.jsx — Reef 2026 rider app, refactored from real Voi app screenshots
// Key corrections from the previous draft:
//   • Map canvas is near-WHITE, not sand. Sand is ONLY building footprints.
//   • Streets are white with thin grey edges; minor streets thinner; bridge over the river.
//   • Water is a pale icy blue (#BFDDF0). Parks are a soft moss green.
//   • Vehicle pins = solid coral circle, white scooter glyph, white ring (~36px).
//   • Selected vehicle = white circle with bike silhouette + tiny calendar dot.
//   • Top-right has ticket pill + chat + profile (3 round buttons).
//   • Right-side controls split: lone filter button above a 2-up directions+navigate pill.
//   • Primary CTA is GREEN (#008545). End ride is RED (#ED1C24). Coral is BRAND only.

// Light & dark palettes. Read `C26` — it gets swapped at runtime by the theme toggle.
const C26_LIGHT = {
  mode: 'light',
  tire: '#282425',
  ink: '#1A1718',
  // brand
  coral: '#F26961',
  coralDeep: '#D04740',
  cherry: '#8D0601',
  // map — matched to real Voi app screenshots (cooler pale greys, not sandy)
  mapBg: '#F5F2EC',
  building: '#EDE9DF',
  street: '#FFFFFF',
  streetEdge: 'rgba(40,36,37,.04)',
  water: '#CADFE8',
  waterRipple: 'rgba(255,255,255,.6)',
  park: '#D2E4C3',
  // semantic CTAs
  go: '#008545',
  goDeep: '#006A37',
  stop: '#ED1C24',
  info: '#0075DB',
  infoBg: '#E5F1FB',
  sheetWashCoral: 'rgba(242,105,97,.05)',
  sheetWashBlue: 'rgba(0,117,219,.04)',
  // text + lines
  slate: '#585455',
  gravel: '#787475',
  hair: 'rgba(40,36,37,.10)',
  hairDark: 'rgba(40,36,37,.18)',
  chipBg: '#F2EFEA',
  // surfaces (for sheets/cards)
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#F2EFEA',
  onSurface: '#282425',
  onSurfaceMuted: '#585455',
  // riding map
  ridingBg: '#F3EFE7',
  ridingBuilding: '#E0DBD1',
  ridingBuildingTop: '#EFEAE0',
  ridingRoad: '#DCE7EF',
  // icon button
  iconBg: '#FFFFFF',
  iconFg: '#282425',
  iconShadow: '0 1px 2px rgba(40,36,37,.10), 0 6px 14px -6px rgba(40,36,37,.20)',
  // sheet gradient
  sheetBg: '#FFFFFF',
  sheetShadow: '0 -10px 40px -10px rgba(40,36,37,.15)',
  sheetGrab: 'rgba(40,36,37,.18)'
};
const C26_DARK = {
  mode: 'dark',
  tire: '#F2EFEA',
  // "text" colour on dark → near-white
  ink: '#FFFFFF',
  coral: '#F58E87',
  // brighter coral so it pops on dark
  coralDeep: '#F26961',
  cherry: '#FFDCD9',
  // map — deep warm-charcoal canvas, slightly lighter building blocks
  mapBg: '#141212',
  building: '#24211F',
  street: '#3A3533',
  // desaturated warm grey streets
  streetEdge: 'rgba(255,255,255,.04)',
  water: '#1E2F3E',
  waterRipple: 'rgba(255,255,255,.08)',
  park: '#1F2E1C',
  // semantic — lifted so they read on dark
  go: '#4DAA7D',
  goDeep: '#008545',
  stop: '#F4716C',
  info: '#4D9EE6',
  infoBg: 'rgba(77,158,230,.14)',
  sheetWashCoral: 'rgba(245,142,135,.06)',
  sheetWashBlue: 'rgba(77,158,230,.05)',
  // text + lines
  slate: '#B8B4B5',
  gravel: '#989495',
  hair: 'rgba(255,255,255,.08)',
  hairDark: 'rgba(255,255,255,.16)',
  chipBg: '#2A2625',
  // surfaces
  surface: '#1F1C1D',
  surfaceRaised: '#2A2625',
  surfaceSunken: '#181515',
  onSurface: '#F2EFEA',
  onSurfaceMuted: '#B8B4B5',
  // riding map
  ridingBg: '#141212',
  ridingBuilding: '#24211F',
  ridingBuildingTop: '#2E2A28',
  ridingRoad: '#1E2A34',
  // icon button — dark floating pebble
  iconBg: '#2A2625',
  iconFg: '#F2EFEA',
  iconShadow: '0 1px 2px rgba(0,0,0,.5), 0 6px 14px -6px rgba(0,0,0,.6)',
  sheetBg: '#1F1C1D',
  sheetShadow: '0 -10px 40px -10px rgba(0,0,0,.6)',
  sheetGrab: 'rgba(255,255,255,.22)'
};

// Live token object. Mutated by setReefTheme() (below) on toggle so all
// components — including already-rendered ones — read the current palette.
const C26 = {
  ...C26_LIGHT
};
function setReefTheme(mode) {
  const src = mode === 'dark' ? C26_DARK : C26_LIGHT;
  Object.keys(C26).forEach(k => delete C26[k]);
  Object.assign(C26, src);
}
const SF = '-apple-system,system-ui,"SF Pro Display","SF Pro Text",sans-serif';

// ─────────────────────────────────────────────────────────────────────
// MAP — Mapbox-backed real map; SVG fallback if MapboxMap is unavailable
// (e.g. no token set on window.MAPBOX_TOKEN).
//
// `Map26SVG` is the original drawn map, kept as a fallback and for any
// screen that wants the stylised version (e.g. print, screenshots).
// ─────────────────────────────────────────────────────────────────────
function Map26({
  withRoute = false,
  interactive = true,
  pitch = 0,
  bearing = 0,
  zoom = 14,
  center = null,
  theme = 'auto'
}) {
  // If MapboxMap is loaded use it; otherwise fall back to the SVG version.
  if (typeof window !== 'undefined' && typeof window.MapboxMap === 'function' && window.MAPBOX_TOKEN) {
    return /*#__PURE__*/React.createElement(window.MapboxMap, {
      interactive: interactive,
      pitch: pitch,
      bearing: bearing,
      zoom: zoom,
      center: center,
      theme: theme
    });
  }
  return /*#__PURE__*/React.createElement(Map26SVG, {
    withRoute: withRoute
  });
}
function Map26SVG({
  withRoute = false
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: "375",
    height: "812",
    viewBox: "0 0 375 812",
    style: {
      position: 'absolute',
      inset: 0
    },
    preserveAspectRatio: "xMidYMid slice"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "375",
    height: "812",
    fill: C26.mapBg
  }), /*#__PURE__*/React.createElement("g", {
    fill: C26.building
  }, /*#__PURE__*/React.createElement("rect", {
    x: "-10",
    y: "-10",
    width: "100",
    height: "90",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "100",
    y: "-10",
    width: "120",
    height: "60",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "230",
    y: "-10",
    width: "70",
    height: "60",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "310",
    y: "-10",
    width: "80",
    height: "90",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "-10",
    y: "90",
    width: "60",
    height: "100",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "60",
    y: "60",
    width: "100",
    height: "130",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "170",
    y: "60",
    width: "60",
    height: "60",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "240",
    y: "60",
    width: "60",
    height: "60",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "170",
    y: "130",
    width: "130",
    height: "60",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "310",
    y: "90",
    width: "80",
    height: "100",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "-10",
    y: "200",
    width: "60",
    height: "80",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "60",
    y: "200",
    width: "60",
    height: "80",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "130",
    y: "200",
    width: "170",
    height: "80",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "310",
    y: "200",
    width: "80",
    height: "80",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "-10",
    y: "290",
    width: "60",
    height: "60",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "60",
    y: "290",
    width: "60",
    height: "60",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "130",
    y: "290",
    width: "60",
    height: "60",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "200",
    y: "290",
    width: "100",
    height: "60",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "310",
    y: "290",
    width: "80",
    height: "60",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "-10",
    y: "360",
    width: "60",
    height: "80",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "60",
    y: "360",
    width: "100",
    height: "80",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "170",
    y: "360",
    width: "60",
    height: "80",
    rx: "2"
  })), /*#__PURE__*/React.createElement("path", {
    d: "M -20 480 C 50 460 110 510 160 540 C 200 560 230 590 250 620 C 270 660 280 720 280 820 L 380 820 L 390 770 C 360 720 330 660 320 620 C 305 580 270 530 220 500 C 160 470 80 460 -20 470 Z",
    fill: C26.water
  }), /*#__PURE__*/React.createElement("path", {
    d: "M -20 488 C 50 470 110 515 160 544 C 200 564 230 592 250 622",
    stroke: C26.waterRipple,
    strokeWidth: "0.8",
    fill: "none"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M -20 510 C 60 495 120 535 165 560",
    stroke: C26.waterRipple,
    strokeWidth: "0.6",
    fill: "none"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 4 660 Q 50 645 80 670 Q 100 715 70 740 Q 20 745 -10 715 Z",
    fill: C26.park
  }), /*#__PURE__*/React.createElement("rect", {
    x: "320",
    y: "450",
    width: "60",
    height: "55",
    rx: "2",
    fill: C26.park
  }), /*#__PURE__*/React.createElement("g", {
    fill: C26.building
  }, /*#__PURE__*/React.createElement("rect", {
    x: "320",
    y: "510",
    width: "80",
    height: "50",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "320",
    y: "570",
    width: "80",
    height: "60",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "320",
    y: "640",
    width: "80",
    height: "60",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "320",
    y: "710",
    width: "80",
    height: "100",
    rx: "2"
  })), /*#__PURE__*/React.createElement("g", {
    stroke: C26.street,
    strokeWidth: "9",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M-10 55 L400 55"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 195 L400 195"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 285 L400 285"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 355 L300 355"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 445 L300 445"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M55 -10 L55 460"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M165 -10 L165 460"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M305 -10 L305 460"
  })), /*#__PURE__*/React.createElement("g", {
    stroke: C26.street,
    strokeWidth: "4",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M-10 25 L400 25"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 125 L300 125"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 245 L400 245"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 320 L300 320"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 400 L300 400"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M125 -10 L125 460"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M205 -10 L205 460"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M250 -10 L250 460"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M340 510 L400 510"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M340 590 L400 590"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M340 700 L400 700"
  })), /*#__PURE__*/React.createElement("g", {
    stroke: C26.streetEdge,
    strokeWidth: "0.8",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M-10 50 L400 50 M-10 60 L400 60"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 190 L400 190 M-10 200 L400 200"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 280 L400 280 M-10 290 L400 290"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 350 L300 350 M-10 360 L300 360"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 440 L300 440 M-10 450 L300 450"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M50 -10 L50 460 M60 -10 L60 460"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M160 -10 L160 460 M170 -10 L170 460"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M300 -10 L300 460 M310 -10 L310 460"
  })), /*#__PURE__*/React.createElement("g", {
    stroke: C26.street,
    strokeWidth: "8",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M165 460 L 320 530"
  })), /*#__PURE__*/React.createElement("g", {
    stroke: C26.streetEdge,
    strokeWidth: "0.8",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M165 456 L 320 526 M 165 464 L 320 534"
  })), withRoute && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M55 700 C 80 600 120 550 165 540 C 230 525 280 470 305 380",
    stroke: "#0075DB",
    strokeWidth: "6",
    strokeLinecap: "round",
    fill: "none",
    opacity: "0.85"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "55",
    cy: "700",
    r: "7",
    fill: "#0075DB"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "305",
    cy: "380",
    r: "9",
    fill: "#fff",
    stroke: "#0075DB",
    strokeWidth: "3"
  })));
}

// ─────────────────────────────────────────────────────────────────────
// PIN — coral circle with white scooter glyph, white ring
// ─────────────────────────────────────────────────────────────────────
function Pin26({
  x,
  y,
  faded = false,
  size = 34
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%,-50%)',
      opacity: faded ? .55 : 1,
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: C26.coral,
      border: '2.5px solid #fff',
      boxShadow: '0 2px 4px rgba(0,0,0,.18), 0 4px 10px -2px rgba(242,105,97,.35)',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(ScooterGlyph, {
    size: size * 0.62,
    color: "#fff"
  })));
}

// SELECTED vehicle marker — white circle with bike + mini calendar bubble
function SelectedMarker26({
  x,
  y,
  kind = 'bike',
  reserved = true
}) {
  const isBike = kind === 'bike';
  const markerBg = C26.mode === 'dark' ? C26.surfaceRaised : '#fff';
  const markerFg = C26.mode === 'dark' ? C26.onSurface : C26.tire;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%,-50%)',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: '50%',
      background: markerBg,
      border: `2.5px solid ${markerBg}`,
      boxShadow: '0 4px 10px -2px rgba(0,0,0,.18), 0 2px 4px rgba(0,0,0,.12)',
      display: 'grid',
      placeItems: 'center',
      position: 'relative'
    }
  }, isBike ? /*#__PURE__*/React.createElement(BikeGlyph, {
    size: 24,
    color: markerFg
  }) : /*#__PURE__*/React.createElement(ScooterGlyph, {
    size: 24,
    color: markerFg
  }), reserved && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -3,
      right: -4,
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: markerBg,
      border: `1.5px solid ${C26.coral}`,
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: C26.coral,
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "5",
    width: "18",
    height: "16",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "3",
    x2: "16",
    y2: "7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "3",
    x2: "8",
    y2: "7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "10",
    x2: "21",
    y2: "10"
  })))), /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "10",
    viewBox: "0 0 14 10",
    style: {
      position: 'absolute',
      left: '50%',
      bottom: -9,
      transform: 'translateX(-50%)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 10 L0 0 L14 0 Z",
    fill: markerBg,
    stroke: "rgba(0,0,0,.06)",
    strokeWidth: "0.8"
  })));
}

// MY LOCATION — blue dot with halo
function MyLocation26({
  x,
  y
}) {
  const ring = C26.mode === 'dark' ? C26.surfaceRaised : '#fff';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%,-50%)',
      zIndex: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: '50%',
      background: 'rgba(77,158,230,.22)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      margin: 'auto',
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: C26.info,
      border: `3px solid ${ring}`,
      boxShadow: '0 2px 6px rgba(77,158,230,.45)'
    }
  }));
}

// ─────────────────────────────────────────────────────────────────────
// GLYPHS
// ─────────────────────────────────────────────────────────────────────
function ScooterGlyph({
  size = 16,
  color = '#fff'
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "18",
    r: "2.4",
    fill: color,
    stroke: "none"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "18",
    r: "2.4",
    fill: color,
    stroke: "none"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 18 L12 7 L14 4 L17 4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7 L18 18"
  }));
}
function BikeGlyph({
  size = 18,
  color = '#282425'
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "17",
    r: "3.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "17",
    r: "3.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 17 L11 8 L15 8 L18 17"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 8 L13 8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M11 8 L13 4 L16 4"
  }));
}

// ─────────────────────────────────────────────────────────────────────
// FLOATING ICON BUTTONS
// ─────────────────────────────────────────────────────────────────────
function IconBtn26({
  children,
  onClick,
  size = 44
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      border: 0,
      cursor: 'pointer',
      background: C26.iconBg,
      color: C26.iconFg,
      boxShadow: C26.iconShadow,
      display: 'grid',
      placeItems: 'center',
      padding: 0
    }
  }, children);
}

// Stuck-together pill: two or three round buttons sharing a single rounded container
function PillStack26({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C26.iconBg,
      borderRadius: 28,
      padding: 5,
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      boxShadow: C26.iconShadow
    }
  }, children);
}
function StackBtn26({
  children,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      width: 38,
      height: 38,
      borderRadius: '50%',
      border: 0,
      cursor: 'pointer',
      background: 'transparent',
      color: C26.iconFg,
      display: 'grid',
      placeItems: 'center',
      padding: 0
    }
  }, children);
}

// Tiny coral-dot indicator on the ticket pill (e.g., new offer)
function TicketIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 8 a2 2 0 0 1 2-2 h14 a2 2 0 0 1 2 2 v2 a2 2 0 0 0 0 4 v2 a2 2 0 0 1-2 2 H5 a2 2 0 0 1-2-2 v-2 a2 2 0 0 0 0-4 z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9.5",
    y1: "9",
    x2: "9.5",
    y2: "15",
    strokeDasharray: "1 2"
  }));
}
function ChatIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 11.5 a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9 L3 21 l1.9-5.7 a8.4 8.4 0 0 1-.9-3.8 A8.5 8.5 0 0 1 8.7 3.9 a8.4 8.4 0 0 1 3.8-.9 h.5 a8.5 8.5 0 0 1 8 8 z"
  }));
}
function ProfileIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "10",
    r: "3.2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5.5 19 A 7 7 0 0 1 18.5 19"
  }));
}
function FilterIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 5 h18 l-7 9 v6 l-4-2 v-4 z"
  }));
}
function DirectionsIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3 L21 12 L12 21 L3 12 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 12 h5 a2 2 0 0 1 2 2 v1.5"
  }));
}
function NavigateIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 11 L21 3 L13 21 L11 13 z"
  }));
}
function MapLayerIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M9 4 L3 7 v13 l6-3 6 3 6-3 V4 l-6 3 z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 4 v13 M15 7 v13"
  }));
}
function GroupAddIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "9",
    r: "3.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 20 a 6 6 0 0 1 12 0"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 8 v6 M22 11 h-6"
  }));
}

// Mastercard mini logo (interlocking circles, simplified)
function MastercardMark({
  scale = 1
}) {
  const w = 28 * scale;
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: w * 0.62,
    viewBox: "0 0 28 17"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "8.5",
    r: "7",
    fill: "#EB001B"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "17",
    cy: "8.5",
    r: "7",
    fill: "#F79E1B"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 3.5 a7 7 0 0 0 0 10 a7 7 0 0 0 0-10 z",
    fill: "#FF5F00"
  }));
}

// ─────────────────────────────────────────────────────────────────────
// SCREEN 1 — HOME / MAP (no sheet open)
// ─────────────────────────────────────────────────────────────────────
function Voi26Home({
  onUnlock
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: C26.mapBg,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Map26, null), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 60,
      left: 18,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement(IconBtn26, null, /*#__PURE__*/React.createElement(TicketIcon, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 60,
      right: 18,
      zIndex: 10,
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(IconBtn26, null, /*#__PURE__*/React.createElement(ChatIcon, null)), /*#__PURE__*/React.createElement(IconBtn26, null, /*#__PURE__*/React.createElement(ProfileIcon, null))), /*#__PURE__*/React.createElement(Pin26, {
    x: 75,
    y: 150
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 195,
    y: 130
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 310,
    y: 150
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 120,
    y: 210
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 250,
    y: 205
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 345,
    y: 210
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 70,
    y: 300
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 170,
    y: 290
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 295,
    y: 310
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 125,
    y: 380
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 245,
    y: 370
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 60,
    y: 650,
    faded: true
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 350,
    y: 550
  }), /*#__PURE__*/React.createElement("div", {
    onClick: onUnlock,
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(SelectedMarker26, {
    x: 200,
    y: 420
  })), /*#__PURE__*/React.createElement(MyLocation26, {
    x: 235,
    y: 500
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 18,
      bottom: 36,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(IconBtn26, {
    size: 42
  }, /*#__PURE__*/React.createElement(FilterIcon, null)), /*#__PURE__*/React.createElement(PillStack26, null, /*#__PURE__*/React.createElement(StackBtn26, null, /*#__PURE__*/React.createElement(DirectionsIcon, null)), /*#__PURE__*/React.createElement(StackBtn26, null, /*#__PURE__*/React.createElement(NavigateIcon, null)))));
}
Object.assign(window, {
  C26,
  C26_LIGHT,
  C26_DARK,
  setReefTheme,
  SF,
  Map26,
  Map26SVG,
  Pin26,
  SelectedMarker26,
  MyLocation26,
  ScooterGlyph,
  BikeGlyph,
  IconBtn26,
  PillStack26,
  StackBtn26,
  TicketIcon,
  ChatIcon,
  ProfileIcon,
  FilterIcon,
  DirectionsIcon,
  NavigateIcon,
  MapLayerIcon,
  GroupAddIcon,
  MastercardMark,
  Voi26Home
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/rider-app/VoiHome26.jsx", error: String((e && e.message) || e) }); }

// ui_kits/rider-app/VoiMapScreen.jsx
try { (() => {
// VoiMapScreen.jsx — Map home (scooter/bike selector with floating UI)
// Uses global IOSDevice. Voi rider-app inspired map home screen.

const coral = '#F26961';
const tire = '#282425';
const pearl = '#F2F2F6';
const sand = '#FAF4EC';
const shell = '#E8E4E5';
const marble = '#D0CCCD';
const slate = '#787475';
const tarmac = '#585455';
const success = '#008545';
function MapBackground() {
  // Simple stylised map: soft blocks, streets, a park, a river
  return /*#__PURE__*/React.createElement("svg", {
    width: "375",
    height: "812",
    viewBox: "0 0 375 812",
    style: {
      position: 'absolute',
      inset: 0
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("pattern", {
    id: "dots",
    width: "24",
    height: "24",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "1",
    cy: "1",
    r: "0.7",
    fill: "#D0CCCD",
    opacity: ".6"
  }))), /*#__PURE__*/React.createElement("rect", {
    width: "375",
    height: "812",
    fill: "#EFEDE8"
  }), /*#__PURE__*/React.createElement("rect", {
    width: "375",
    height: "812",
    fill: "url(#dots)"
  }), /*#__PURE__*/React.createElement("g", {
    fill: "#F6F2EC",
    stroke: "#E3DED6",
    strokeWidth: "1"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "-20",
    y: "60",
    width: "120",
    height: "160",
    rx: "8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "110",
    y: "40",
    width: "150",
    height: "100",
    rx: "10"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "270",
    y: "60",
    width: "130",
    height: "180",
    rx: "10"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "-20",
    y: "240",
    width: "90",
    height: "140",
    rx: "8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "80",
    y: "260",
    width: "120",
    height: "110",
    rx: "10"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "210",
    y: "270",
    width: "90",
    height: "90",
    rx: "8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "310",
    y: "260",
    width: "90",
    height: "140",
    rx: "10"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "-20",
    y: "420",
    width: "140",
    height: "150",
    rx: "10"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "130",
    y: "420",
    width: "170",
    height: "130",
    rx: "10"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "310",
    y: "420",
    width: "90",
    height: "150",
    rx: "10"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "-20",
    y: "600",
    width: "150",
    height: "160",
    rx: "10"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "230",
    y: "600",
    width: "170",
    height: "160",
    rx: "10"
  })), /*#__PURE__*/React.createElement("path", {
    d: "M130 560 Q200 555 220 600 Q230 640 180 680 Q120 690 110 620 Z",
    fill: "#D9E6C9",
    stroke: "#BFD3A5",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M0 380 C120 360 220 410 375 390 L375 420 C220 440 120 395 0 415 Z",
    fill: "#C6DEED",
    opacity: ".9"
  }), /*#__PURE__*/React.createElement("g", {
    stroke: "#B8B4B5",
    strokeWidth: "1",
    strokeDasharray: "4 4",
    opacity: ".6",
    fill: "none"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: "240",
    x2: "375",
    y2: "240"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: "420",
    x2: "375",
    y2: "420"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: "580",
    x2: "375",
    y2: "580"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "100",
    y1: "0",
    x2: "100",
    y2: "812"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "260",
    y1: "0",
    x2: "260",
    y2: "812"
  })));
}
function VehiclePin({
  x,
  y,
  type = 'scooter',
  selected = false,
  battery = 80
}) {
  const fill = selected ? coral : '#fff';
  const stroke = selected ? coral : tire;
  const glyph = selected ? '#fff' : tire;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%,-100%)',
      filter: selected ? 'drop-shadow(0 6px 12px rgba(242,105,97,.45))' : 'drop-shadow(0 2px 4px rgba(0,0,0,.2))'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "44",
    height: "52",
    viewBox: "0 0 44 52"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M22 50 L8 30 A16 16 0 1 1 36 30 Z",
    fill: fill,
    stroke: stroke,
    strokeWidth: "2"
  }), type === 'scooter' ? /*#__PURE__*/React.createElement("g", {
    fill: glyph
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "14",
    cy: "22",
    r: "2.2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "30",
    cy: "22",
    r: "2.2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 22 L22 14 L28 22",
    stroke: glyph,
    strokeWidth: "1.8",
    fill: "none",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "26",
    y: "10",
    width: "2",
    height: "8",
    rx: "1"
  })) : /*#__PURE__*/React.createElement("g", {
    fill: glyph
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "14",
    cy: "23",
    r: "3.5",
    fill: "none",
    stroke: glyph,
    strokeWidth: "1.6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "30",
    cy: "23",
    r: "3.5",
    fill: "none",
    stroke: glyph,
    strokeWidth: "1.6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 23 L22 16 L30 23",
    stroke: glyph,
    strokeWidth: "1.6",
    fill: "none",
    strokeLinecap: "round"
  }))), selected && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -6,
      right: -4,
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: '#fff',
      border: `2px solid ${coral}`,
      display: 'grid',
      placeItems: 'center',
      fontSize: 8,
      fontWeight: 800,
      color: tire
    }
  }, battery));
}
function TopSearchBar({
  onMenu
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 56,
      left: 16,
      right: 16,
      zIndex: 10,
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onMenu,
    style: {
      border: 0,
      width: 44,
      height: 44,
      borderRadius: '50%',
      background: '#fff',
      boxShadow: '2px 4px 0 rgba(0,0,0,.08)',
      display: 'grid',
      placeItems: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "14",
    viewBox: "0 0 18 14"
  }, /*#__PURE__*/React.createElement("g", {
    stroke: tire,
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1h16"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M1 7h16"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M1 13h10"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 44,
      background: '#fff',
      borderRadius: 999,
      boxShadow: '2px 4px 0 rgba(0,0,0,.08)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '0 18px'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: slate,
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.3-4.3"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'Sora',
      fontSize: 14,
      fontWeight: 500,
      color: slate
    }
  }, "Where to?")));
}
function ModeToggle({
  mode,
  setMode
}) {
  const opts = [{
    id: 'scooter',
    label: 'Scooter',
    count: '12 near'
  }, {
    id: 'bike',
    label: 'E-bike',
    count: '4 near'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 116,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      background: '#fff',
      borderRadius: 999,
      padding: 4,
      display: 'flex',
      boxShadow: '2px 4px 0 rgba(0,0,0,.08)'
    }
  }, opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.id,
    onClick: () => setMode(o.id),
    style: {
      border: 0,
      cursor: 'pointer',
      padding: '8px 16px',
      borderRadius: 999,
      background: mode === o.id ? tire : 'transparent',
      color: mode === o.id ? '#fff' : tire,
      fontFamily: 'Sora',
      fontWeight: 700,
      fontSize: 12
    }
  }, o.label, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: .6,
      fontWeight: 500
    }
  }, "\xB7 ", o.count))));
}
function LocateFab() {
  return /*#__PURE__*/React.createElement("button", {
    style: {
      position: 'absolute',
      right: 16,
      bottom: 280,
      zIndex: 10,
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: '#fff',
      border: 0,
      boxShadow: '2px 4px 0 rgba(0,0,0,.08)',
      display: 'grid',
      placeItems: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: tire,
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v3M12 19v3M2 12h3M19 12h3"
  })));
}
function BottomSheet({
  vehicle,
  onRide
}) {
  if (!vehicle) {
    return /*#__PURE__*/React.createElement("div", {
      style: sheetStyle
    }, /*#__PURE__*/React.createElement("div", {
      style: handle
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '8px 20px 28px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'Sora',
        fontWeight: 700,
        fontSize: 22,
        letterSpacing: '-.03em',
        color: tire
      }
    }, "Ready to ride?"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'Sora',
        fontWeight: 400,
        fontSize: 14,
        color: tarmac,
        marginTop: 4
      }
    }, "Tap a scooter on the map, or scan a QR code to unlock."), /*#__PURE__*/React.createElement("button", {
      style: primaryBtn
    }, /*#__PURE__*/React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "4",
      y: "4",
      width: "6",
      height: "6",
      rx: "1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "14",
      y: "4",
      width: "6",
      height: "6",
      rx: "1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "4",
      y: "14",
      width: "6",
      height: "6",
      rx: "1"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M14 14h3v3h-3zM20 14v6M14 20h6"
    })), "Scan to ride")));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: sheetStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: handle
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '6px 20px 28px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 16,
      background: sand,
      display: 'grid',
      placeItems: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "28",
    height: "32",
    viewBox: "0 0 44 52"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M22 50 L8 30 A16 16 0 1 1 36 30 Z",
    fill: coral
  }), /*#__PURE__*/React.createElement("g", {
    fill: "#fff"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "14",
    cy: "22",
    r: "2.2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "30",
    cy: "22",
    r: "2.2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 22 L22 14 L28 22",
    stroke: "#fff",
    strokeWidth: "1.8",
    fill: "none",
    strokeLinecap: "round"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 11,
      fontWeight: 600,
      color: slate,
      textTransform: 'uppercase',
      letterSpacing: '.06em'
    }
  }, "Voi Cruiser \xB7 5VB-421"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 20,
      fontWeight: 700,
      color: tire,
      letterSpacing: '-.03em',
      marginTop: 2
    }
  }, "3 min walk away")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#E6F3EC',
      color: '#005D30',
      padding: '4px 10px',
      borderRadius: 999,
      fontFamily: 'Sora',
      fontSize: 11,
      fontWeight: 700
    }
  }, "82%")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: miniCard
  }, /*#__PURE__*/React.createElement("div", {
    style: miniLabel
  }, "Unlock"), /*#__PURE__*/React.createElement("div", {
    style: miniValue
  }, "1,00 \u20AC")), /*#__PURE__*/React.createElement("div", {
    style: miniCard
  }, /*#__PURE__*/React.createElement("div", {
    style: miniLabel
  }, "Per minute"), /*#__PURE__*/React.createElement("div", {
    style: miniValue
  }, "0,25 \u20AC"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...secondaryBtn,
      flex: 1
    }
  }, "Reserve \xB7 15 min free"), /*#__PURE__*/React.createElement("button", {
    onClick: onRide,
    style: {
      ...primaryBtn,
      flex: 1,
      marginTop: 0
    }
  }, "Start ride"))));
}
const sheetStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 34,
  zIndex: 10,
  background: '#fff',
  borderRadius: '32px 32px 0 0',
  boxShadow: '0 -16px 48px rgba(0,0,0,.12)',
  paddingTop: 10
};
const handle = {
  width: 36,
  height: 5,
  borderRadius: 999,
  background: marble,
  margin: '0 auto 8px'
};
const miniCard = {
  background: pearl,
  borderRadius: 16,
  padding: '12px 14px'
};
const miniLabel = {
  fontFamily: 'Sora',
  fontSize: 11,
  fontWeight: 600,
  color: slate,
  textTransform: 'uppercase',
  letterSpacing: '.06em'
};
const miniValue = {
  fontFamily: 'Sora',
  fontSize: 18,
  fontWeight: 700,
  color: tire,
  marginTop: 4,
  letterSpacing: '-.02em'
};
const primaryBtn = {
  marginTop: 16,
  width: '100%',
  height: 56,
  borderRadius: 999,
  border: 0,
  background: tire,
  color: '#fff',
  fontFamily: 'Sora',
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10
};
const secondaryBtn = {
  height: 56,
  borderRadius: 999,
  border: `1px solid ${marble}`,
  background: '#fff',
  color: tire,
  fontFamily: 'Sora',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer'
};
function VoiMapScreen({
  onRide,
  onMenu
}) {
  const [mode, setMode] = React.useState('scooter');
  const [selected, setSelected] = React.useState(null);
  const pins = [{
    id: 1,
    x: 90,
    y: 320,
    battery: 72
  }, {
    id: 2,
    x: 200,
    y: 260,
    battery: 88
  }, {
    id: 3,
    x: 285,
    y: 310,
    battery: 45
  }, {
    id: 4,
    x: 140,
    y: 470,
    battery: 92
  }, {
    id: 5,
    x: 260,
    y: 500,
    battery: 63
  }, {
    id: 6,
    x: 80,
    y: 570,
    battery: 78
  }, {
    id: 7,
    x: 310,
    y: 620,
    battery: 34
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: pearl,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(MapBackground, null), pins.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    onClick: () => setSelected(p.id),
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(VehiclePin, {
    x: p.x,
    y: p.y,
    battery: p.battery,
    selected: selected === p.id,
    type: mode
  }))), /*#__PURE__*/React.createElement(TopSearchBar, {
    onMenu: onMenu
  }), /*#__PURE__*/React.createElement(ModeToggle, {
    mode: mode,
    setMode: setMode
  }), /*#__PURE__*/React.createElement(LocateFab, null), /*#__PURE__*/React.createElement(BottomSheet, {
    vehicle: selected ? pins.find(p => p.id === selected) : null,
    onRide: onRide
  }));
}
Object.assign(window, {
  VoiMapScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/rider-app/VoiMapScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/rider-app/VoiMenuScreen.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// VoiMenuScreen.jsx — Menu / profile / Voialty rewards
const tire3 = '#282425';
const coral3 = '#F26961';
const sand3 = '#FAF4EC';
const pearl3 = '#F2F2F6';
const shell3 = '#E8E4E5';
const slate3 = '#787475';
const tarmac3 = '#585455';
const marble3 = '#D0CCCD';
function VoiMenuScreen({
  onClose
}) {
  const items = [{
    icon: 'wallet',
    label: 'Payment',
    detail: 'Visa · 4242'
  }, {
    icon: 'gift',
    label: 'Promos & gift cards'
  }, {
    icon: 'history',
    label: 'Ride history',
    detail: '48'
  }, {
    icon: 'help',
    label: 'Help centre'
  }, {
    icon: 'shield',
    label: 'Safety'
  }, {
    icon: 'settings',
    label: 'Settings'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: pearl3,
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '60px 20px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: coral3,
      display: 'grid',
      placeItems: 'center',
      color: '#fff',
      fontFamily: 'Sora',
      fontWeight: 700,
      fontSize: 24,
      boxShadow: '2px 4px 0 rgba(0,0,0,.08)'
    }
  }, "AL"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontWeight: 700,
      fontSize: 22,
      color: tire3,
      letterSpacing: '-.03em'
    }
  }, "Alma Lindqvist"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontWeight: 500,
      fontSize: 13,
      color: slate3
    }
  }, "alma@voi.app \xB7 Malm\xF6")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: 40,
      height: 40,
      borderRadius: '50%',
      background: '#fff',
      border: 0,
      boxShadow: '2px 4px 0 rgba(0,0,0,.08)',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 14 14",
    stroke: tire3,
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 2l10 10M12 2L2 12"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      background: coral3,
      borderRadius: 32,
      padding: '20px 22px',
      color: '#fff',
      boxShadow: '2px 4px 0 rgba(0,0,0,.08)',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "140",
    height: "140",
    viewBox: "0 0 100 100",
    style: {
      position: 'absolute',
      right: -20,
      top: -30,
      opacity: .18
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "50",
    cy: "50",
    r: "48",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "50",
    cy: "50",
    r: "36",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "50",
    cy: "50",
    r: "24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "2"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontWeight: 700,
      fontSize: 11,
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      opacity: .9
    }
  }, "Voialty"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontWeight: 700,
      fontSize: 34,
      letterSpacing: '-.04em',
      marginTop: 4,
      lineHeight: 1
    }
  }, "1,240", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 400,
      fontSize: 14,
      marginLeft: 8
    }
  }, "pts")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      height: 8,
      borderRadius: 999,
      background: 'rgba(255,255,255,.25)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '62%',
      height: '100%',
      borderRadius: 999,
      background: '#fff'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 8,
      fontFamily: 'Sora',
      fontSize: 12,
      fontWeight: 500,
      opacity: .9
    }
  }, /*#__PURE__*/React.createElement("span", null, "Silver"), /*#__PURE__*/React.createElement("span", null, "760 pts to Gold"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 10,
      marginTop: 16
    }
  }, [['48', 'rides'], ['212', 'km'], ['18', 'kg CO₂']].map(([v, l]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      background: '#fff',
      borderRadius: 20,
      padding: '12px 14px',
      boxShadow: '2px 4px 0 rgba(0,0,0,.08)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontWeight: 700,
      fontSize: 20,
      color: tire3,
      letterSpacing: '-.03em'
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontWeight: 500,
      fontSize: 11,
      color: slate3,
      textTransform: 'uppercase',
      letterSpacing: '.06em',
      marginTop: 2
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 28,
      marginTop: 18,
      overflow: 'hidden',
      boxShadow: '2px 4px 0 rgba(0,0,0,.08)'
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: it.label,
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: '16px 18px',
      gap: 14,
      borderBottom: i < items.length - 1 ? `1px solid ${shell3}` : 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(MenuIcon, {
    name: it.icon
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: 'Sora',
      fontWeight: 600,
      fontSize: 15,
      color: tire3
    }
  }, it.label), it.detail && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'Sora',
      fontSize: 13,
      color: slate3
    }
  }, it.detail), /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "12",
    viewBox: "0 0 8 12",
    fill: "none",
    stroke: marble3,
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1l5 5-5 5"
  }))))), /*#__PURE__*/React.createElement("button", {
    style: {
      width: '100%',
      marginTop: 18,
      height: 48,
      borderRadius: 999,
      background: 'transparent',
      color: tarmac3,
      fontFamily: 'Sora',
      fontWeight: 600,
      fontSize: 14,
      border: 0,
      cursor: 'pointer'
    }
  }, "Sign out")));
}
function MenuIcon({
  name
}) {
  const s = {
    width: 20,
    height: 20
  };
  const stroke = tire3;
  const sw = 2;
  const icons = {
    wallet: /*#__PURE__*/React.createElement("svg", _extends({}, s, {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: stroke,
      strokeWidth: sw,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "6",
      width: "18",
      height: "13",
      rx: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3 10h18"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "17",
      cy: "14",
      r: "1.2",
      fill: stroke
    })),
    gift: /*#__PURE__*/React.createElement("svg", _extends({}, s, {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: stroke,
      strokeWidth: sw,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "9",
      width: "18",
      height: "12",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3 13h18M12 9v12M9 9a3 3 0 010-6c2 0 3 3 3 6M15 9a3 3 0 000-6c-2 0-3 3-3 6"
    })),
    history: /*#__PURE__*/React.createElement("svg", _extends({}, s, {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: stroke,
      strokeWidth: sw,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 7v5l3 2"
    })),
    help: /*#__PURE__*/React.createElement("svg", _extends({}, s, {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: stroke,
      strokeWidth: sw,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9 9a3 3 0 116 0c0 2-3 2-3 4"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "17",
      r: ".8",
      fill: stroke
    })),
    shield: /*#__PURE__*/React.createElement("svg", _extends({}, s, {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: stroke,
      strokeWidth: sw,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9 12l2 2 4-4"
    })),
    settings: /*#__PURE__*/React.createElement("svg", _extends({}, s, {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: stroke,
      strokeWidth: sw,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19.4 15a1.7 1.7 0 00.4 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.4 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.4-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.4H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.4 1.9v.1a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"
    }))
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 12,
      background: sand3,
      display: 'grid',
      placeItems: 'center'
    }
  }, icons[name]);
}
Object.assign(window, {
  VoiMenuScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/rider-app/VoiMenuScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/rider-app/VoiRideScreen.jsx
try { (() => {
// VoiRideScreen.jsx — Ride in progress, end ride, receipt
const coral2 = '#F26961';
const tire2 = '#282425';
const pearl2 = '#F2F2F6';
const sand2 = '#FAF4EC';
const marble2 = '#D0CCCD';
const slate2 = '#787475';
const tarmac2 = '#585455';
const shell2 = '#E8E4E5';
function RideTopBar({
  time,
  speed
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 56,
      left: 16,
      right: 16,
      zIndex: 10,
      background: tire2,
      color: '#fff',
      borderRadius: 24,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: '0 8px 24px rgba(0,0,0,.18)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 11,
      fontWeight: 600,
      color: '#B8B4B5',
      textTransform: 'uppercase',
      letterSpacing: '.06em'
    }
  }, "Ride time"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: '-.02em',
      marginTop: 2
    }
  }, time)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 36,
      background: '#403C3D'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 11,
      fontWeight: 600,
      color: '#B8B4B5',
      textTransform: 'uppercase',
      letterSpacing: '.06em'
    }
  }, "Speed"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: '-.02em',
      marginTop: 2
    }
  }, speed, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 500,
      color: '#B8B4B5',
      marginLeft: 4
    }
  }, "km/h"))));
}
function RouteMap() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "375",
    height: "812",
    viewBox: "0 0 375 812",
    style: {
      position: 'absolute',
      inset: 0
    }
  }, /*#__PURE__*/React.createElement("rect", {
    width: "375",
    height: "812",
    fill: "#EFEDE8"
  }), /*#__PURE__*/React.createElement("g", {
    fill: "#F6F2EC",
    stroke: "#E3DED6",
    strokeWidth: "1"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "-20",
    y: "60",
    width: "120",
    height: "220",
    rx: "8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "110",
    y: "40",
    width: "150",
    height: "180",
    rx: "10"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "270",
    y: "60",
    width: "130",
    height: "240",
    rx: "10"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "-20",
    y: "300",
    width: "90",
    height: "220",
    rx: "8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "80",
    y: "320",
    width: "120",
    height: "180",
    rx: "10"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "220",
    y: "320",
    width: "180",
    height: "180",
    rx: "10"
  })), /*#__PURE__*/React.createElement("path", {
    d: "M70 650 C100 560 180 520 200 450 C220 380 260 320 280 250",
    stroke: coral2,
    strokeWidth: "6",
    strokeLinecap: "round",
    fill: "none"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "280",
    cy: "250",
    r: "9",
    fill: "#fff",
    stroke: tire2,
    strokeWidth: "3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "70",
    cy: "650",
    r: "8",
    fill: tire2
  }));
}
function MeLocationPin({
  x = 200,
  y = 450
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%,-50%)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 60,
      height: 60,
      borderRadius: '50%',
      background: 'rgba(0,117,219,.2)',
      position: 'absolute',
      left: -30,
      top: -30
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: '#0075DB',
      border: '3px solid #fff',
      boxShadow: '0 2px 6px rgba(0,0,0,.25)'
    }
  }));
}
function RideSheet({
  onEnd
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 34,
      zIndex: 10,
      background: '#fff',
      borderRadius: '32px 32px 0 0',
      boxShadow: '0 -16px 48px rgba(0,0,0,.12)',
      paddingTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 5,
      borderRadius: 999,
      background: marble2,
      margin: '0 auto 12px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 20px 28px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: pearl2,
      borderRadius: 16,
      padding: '10px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 11,
      fontWeight: 600,
      color: slate2,
      textTransform: 'uppercase',
      letterSpacing: '.06em'
    }
  }, "Distance"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 18,
      fontWeight: 700,
      color: tire2,
      marginTop: 2
    }
  }, "2,4 km")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: pearl2,
      borderRadius: 16,
      padding: '10px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 11,
      fontWeight: 600,
      color: slate2,
      textTransform: 'uppercase',
      letterSpacing: '.06em'
    }
  }, "Fare so far"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 18,
      fontWeight: 700,
      color: tire2,
      marginTop: 2
    }
  }, "3,50 \u20AC"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: sand2,
      borderRadius: 16,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: '#FFB100',
      display: 'grid',
      placeItems: 'center',
      color: tire2,
      fontWeight: 800
    }
  }, "!"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 13,
      fontWeight: 700,
      color: tire2
    }
  }, "Helmet zone ahead"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 12,
      fontWeight: 400,
      color: tarmac2
    }
  }, "Speed will slow to 15 km/h along the seafront."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      flex: 1,
      height: 54,
      borderRadius: 999,
      border: `1px solid ${marble2}`,
      background: '#fff',
      color: tire2,
      fontFamily: 'Sora',
      fontWeight: 700,
      fontSize: 14,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: tire2,
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "5",
    width: "4",
    height: "14",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "5",
    width: "4",
    height: "14",
    rx: "1"
  })), "Pause"), /*#__PURE__*/React.createElement("button", {
    onClick: onEnd,
    style: {
      flex: 1.2,
      height: 54,
      borderRadius: 999,
      border: 0,
      background: tire2,
      color: '#fff',
      fontFamily: 'Sora',
      fontWeight: 700,
      fontSize: 14,
      cursor: 'pointer'
    }
  }, "End ride"))));
}
function VoiRideScreen({
  onEnd
}) {
  const [time, setTime] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(time / 60).toString().padStart(2, '0');
  const s = (time % 60).toString().padStart(2, '0');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      background: pearl2
    }
  }, /*#__PURE__*/React.createElement(RouteMap, null), /*#__PURE__*/React.createElement(MeLocationPin, {
    x: 200,
    y: 450
  }), /*#__PURE__*/React.createElement(RideTopBar, {
    time: `${m}:${s}`,
    speed: "18"
  }), /*#__PURE__*/React.createElement(RideSheet, {
    onEnd: onEnd
  }));
}

// ── End-ride receipt ─────────────────────────────────────────
function VoiReceiptScreen({
  onDone
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: sand2,
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '72px 20px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 72,
      height: 72,
      borderRadius: '50%',
      background: '#008545',
      display: 'grid',
      placeItems: 'center',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "34",
    height: "34",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 12l5 5 9-11"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 32,
      fontWeight: 700,
      color: tire2,
      letterSpacing: '-.04em',
      lineHeight: 1.1
    }
  }, "Nice ride."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 16,
      fontWeight: 400,
      color: tarmac2,
      marginTop: 6
    }
  }, "You saved 0,6 kg of CO\u2082 today."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 32,
      padding: 20,
      marginTop: 24,
      boxShadow: '2px 4px 0 rgba(0,0,0,.08)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    label: "Distance",
    value: "2,4 km"
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Duration",
    value: "14:02"
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Avg speed",
    value: "16 km/h"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: shell2,
      margin: '18px 0'
    }
  }), /*#__PURE__*/React.createElement(Line, {
    label: "Unlock",
    value: "1,00 \u20AC"
  }), /*#__PURE__*/React.createElement(Line, {
    label: "14 min \xB7 0,25 \u20AC/min",
    value: "3,50 \u20AC"
  }), /*#__PURE__*/React.createElement(Line, {
    label: "Voialty discount",
    value: "\u22120,30 \u20AC",
    coral: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: shell2,
      margin: '10px 0'
    }
  }), /*#__PURE__*/React.createElement(Line, {
    label: "Total",
    value: "4,20 \u20AC",
    bold: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      background: '#fff',
      borderRadius: 24,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: '2px 4px 0 rgba(0,0,0,.08)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 24,
      borderRadius: 4,
      background: '#1A1F71',
      display: 'grid',
      placeItems: 'center',
      color: '#fff',
      fontFamily: 'Sora',
      fontWeight: 800,
      fontSize: 10,
      letterSpacing: '.06em'
    }
  }, "VISA"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: 'Sora',
      fontWeight: 600,
      fontSize: 14,
      color: tire2
    }
  }, "Visa \xB7 4242"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontWeight: 500,
      fontSize: 12,
      color: slate2
    }
  }, "Receipt sent")), /*#__PURE__*/React.createElement("button", {
    onClick: onDone,
    style: {
      marginTop: 20,
      width: '100%',
      height: 56,
      borderRadius: 999,
      border: 0,
      background: tire2,
      color: '#fff',
      fontFamily: 'Sora',
      fontWeight: 700,
      fontSize: 16,
      cursor: 'pointer'
    }
  }, "Done"), /*#__PURE__*/React.createElement("button", {
    style: {
      marginTop: 10,
      width: '100%',
      height: 52,
      borderRadius: 999,
      border: 0,
      background: 'transparent',
      color: tarmac2,
      fontFamily: 'Sora',
      fontWeight: 600,
      fontSize: 14,
      cursor: 'pointer'
    }
  }, "Report a problem")));
}
function Stat({
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 10,
      fontWeight: 600,
      color: slate2,
      textTransform: 'uppercase',
      letterSpacing: '.06em'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Sora',
      fontSize: 18,
      fontWeight: 700,
      color: tire2,
      marginTop: 4,
      letterSpacing: '-.02em'
    }
  }, value));
}
function Line({
  label,
  value,
  bold,
  coral
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '6px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'Sora',
      fontSize: bold ? 16 : 14,
      fontWeight: bold ? 700 : 500,
      color: bold ? tire2 : tarmac2
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'Sora',
      fontSize: bold ? 18 : 14,
      fontWeight: bold ? 700 : 600,
      color: coral ? coral2 : bold ? tire2 : tire2,
      letterSpacing: '-.01em'
    }
  }, value));
}
Object.assign(window, {
  VoiRideScreen,
  VoiReceiptScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/rider-app/VoiRideScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/rider-app/VoiSheets26.jsx
try { (() => {
// VoiSheets26.jsx — Reserved / Riding / Summary screens.
// Pulls primitives from VoiHome26.jsx via window globals.

// ─────────────────────────────────────────────────────────────────────
// Bottom-sheet shell with the soft coral/blue corner washes
// ─────────────────────────────────────────────────────────────────────
function Sheet26({
  children,
  pad = '10px 18px 28px'
}) {
  const coralWash = C26.mode === 'dark' ? 'rgba(245,142,135,.10)' : 'rgba(242,105,97,.05)';
  const blueWash = C26.mode === 'dark' ? 'rgba(77,158,230,.10)' : 'rgba(0,117,219,.04)';
  const blueWashTop = C26.mode === 'dark' ? 'rgba(77,158,230,.07)' : 'rgba(0,117,219,.035)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 11,
      borderRadius: '24px 24px 0 0',
      background: `
        radial-gradient(110% 70% at 0% 100%, ${blueWash} 0%, rgba(0,0,0,0) 55%),
        radial-gradient(110% 70% at 100% 100%, ${coralWash} 0%, rgba(0,0,0,0) 55%),
        radial-gradient(140% 50% at 50% 0%, ${blueWashTop} 0%, rgba(0,0,0,0) 60%),
        ${C26.sheetBg}
      `,
      padding: pad,
      boxShadow: C26.sheetShadow
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 5,
      borderRadius: 999,
      background: C26.sheetGrab,
      margin: '0 auto 14px'
    }
  }), children);
}

// Pill chip for "Find vehicle / Report issue / Lorem ipsum"
function ActionChip26({
  children
}) {
  return /*#__PURE__*/React.createElement("button", {
    style: {
      height: 36,
      padding: '0 16px',
      borderRadius: 999,
      background: C26.surfaceRaised,
      color: C26.onSurface,
      border: `1px solid ${C26.hairDark}`,
      fontFamily: SF,
      fontWeight: 600,
      fontSize: 13,
      letterSpacing: '-.005em',
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, children);
}

// Tag chip for credits / discount status row
function TagChip26({
  children,
  tone = 'neutral'
}) {
  const palette = tone === 'coral' ? C26.mode === 'dark' ? {
    bg: 'rgba(245,142,135,.18)',
    fg: C26.coral
  } : {
    bg: '#FBDDDB',
    fg: C26.coralDeep
  } : C26.mode === 'dark' ? {
    bg: 'rgba(255,255,255,.08)',
    fg: C26.onSurface
  } : {
    bg: '#ECE8E1',
    fg: C26.tire
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 28,
      padding: '0 12px',
      borderRadius: 999,
      background: palette.bg,
      color: palette.fg,
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 12.5,
      letterSpacing: '-.005em'
    }
  }, children);
}
function VehicleHeader26({
  name = 'E-Bike light',
  code = 'VRA1',
  battery = '78%'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 4px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 62,
      height: 54,
      borderRadius: 10,
      background: C26.surfaceRaised,
      display: 'grid',
      placeItems: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(BikeGlyph, {
    size: 42,
    color: C26.coral
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 20,
      letterSpacing: '-.025em',
      color: C26.onSurface
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontWeight: 500,
      fontSize: 18,
      letterSpacing: '-.02em',
      color: C26.gravel
    }
  }, code)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "12",
    viewBox: "0 0 24 18",
    fill: "none",
    stroke: C26.gravel,
    strokeWidth: "1.6"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "1",
    y: "2",
    width: "19",
    height: "14",
    rx: "2.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "20.5",
    y: "6.5",
    width: "2.5",
    height: "5",
    rx: "1",
    fill: C26.gravel
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "8",
    height: "10",
    rx: "1",
    fill: C26.gravel,
    stroke: "none"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontWeight: 500,
      fontSize: 13,
      color: C26.gravel
    }
  }, battery))), /*#__PURE__*/React.createElement("button", {
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      border: 0,
      cursor: 'pointer',
      background: C26.mode === 'dark' ? 'rgba(255,255,255,.08)' : '#F2EEEE',
      color: C26.onSurface,
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }))));
}

// Reservation timer block — blue-tinted card with icon, big countdown, progress bar
function ReservationBlock26({
  time = '09:59',
  progress = 0.6
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C26.infoBg,
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: C26.info,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "5",
    width: "18",
    height: "16",
    rx: "2.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "3",
    x2: "16",
    y2: "7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "3",
    x2: "8",
    y2: "7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "10",
    x2: "21",
    y2: "10"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "15.5",
    r: "2.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "15.5",
    x2: "13.5",
    y2: "14"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 15,
      letterSpacing: '-.015em',
      color: C26.onSurface
    }
  }, "Reserved for you"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 18,
      letterSpacing: '-.02em',
      color: C26.onSurface,
      fontVariantNumeric: 'tabular-nums'
    }
  }, time)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      height: 6,
      borderRadius: 999,
      background: 'rgba(77,158,230,.22)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${progress * 100}%`,
      height: '100%',
      borderRadius: 999,
      background: C26.info
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontFamily: SF,
      fontSize: 12.5,
      color: C26.onSurfaceMuted,
      letterSpacing: '-.005em'
    }
  }, "The reservation will cancel automatically."));
}

// Pricing block — credits row + main fare line + Mastercard
function PricingBlock26({
  credits = 'xx Credits',
  discount = true,
  unlock = '10 kr',
  perMin = '3 kr/minute'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C26.chipBg,
      borderRadius: 14,
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(TagChip26, {
    tone: "neutral"
  }, credits), discount && /*#__PURE__*/React.createElement(TagChip26, {
    tone: "coral"
  }, "Discount applied")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: SF,
      fontSize: 14,
      color: C26.onSurface,
      letterSpacing: '-.005em'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      fontWeight: 700
    }
  }, unlock), " to unlock + ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontWeight: 700
    }
  }, perMin)), /*#__PURE__*/React.createElement(MastercardMark, {
    scale: 1.15
  })));
}

// ─────────────────────────────────────────────────────────────────────
// SCREEN 2 — RESERVED / SINGLE PRIMARY ("Start riding")
// ─────────────────────────────────────────────────────────────────────
function Voi26Reserved({
  onStart,
  onBack
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: C26.mapBg,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Map26, null), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 60,
      left: 18,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement(IconBtn26, {
    onClick: onBack
  }, /*#__PURE__*/React.createElement(TicketIcon, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 60,
      right: 18,
      zIndex: 10,
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(IconBtn26, null, /*#__PURE__*/React.createElement(ChatIcon, null)), /*#__PURE__*/React.createElement(IconBtn26, null, /*#__PURE__*/React.createElement(ProfileIcon, null))), /*#__PURE__*/React.createElement(Pin26, {
    x: 75,
    y: 150
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 195,
    y: 130
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 310,
    y: 150
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 120,
    y: 210
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 250,
    y: 205
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 345,
    y: 210
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 70,
    y: 300
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 170,
    y: 290
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 295,
    y: 310
  }), /*#__PURE__*/React.createElement(SelectedMarker26, {
    x: 205,
    y: 400
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 18,
      top: 330,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(IconBtn26, {
    size: 42
  }, /*#__PURE__*/React.createElement(FilterIcon, null)), /*#__PURE__*/React.createElement(PillStack26, null, /*#__PURE__*/React.createElement(StackBtn26, null, /*#__PURE__*/React.createElement(DirectionsIcon, null)), /*#__PURE__*/React.createElement(StackBtn26, null, /*#__PURE__*/React.createElement(NavigateIcon, null)))), /*#__PURE__*/React.createElement(Sheet26, null, /*#__PURE__*/React.createElement(VehicleHeader26, null), /*#__PURE__*/React.createElement(ReservationBlock26, {
    time: "09:59",
    progress: 0.62
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 14,
      overflowX: 'auto',
      paddingBottom: 2
    }
  }, /*#__PURE__*/React.createElement(ActionChip26, null, "Find vehicle"), /*#__PURE__*/React.createElement(ActionChip26, null, "Report issue"), /*#__PURE__*/React.createElement(ActionChip26, null, "How to ride")), /*#__PURE__*/React.createElement(PricingBlock26, null), /*#__PURE__*/React.createElement("button", {
    onClick: onStart,
    style: {
      width: '100%',
      height: 56,
      marginTop: 16,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      background: C26.go,
      color: '#fff',
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 17,
      letterSpacing: '-.015em',
      boxShadow: C26.mode === 'dark' ? '0 8px 18px -6px rgba(77,170,125,.45)' : '0 8px 18px -6px rgba(0,133,69,.45)'
    }
  }, "Start riding")));
}

// ─────────────────────────────────────────────────────────────────────
// SCREEN 2b — RESERVED / TWO BUTTONS ("Reserve · 10 min free" + "Start")
// ─────────────────────────────────────────────────────────────────────
function Voi26Picked({
  onStart,
  onBack
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: C26.mapBg,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Map26, null), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 60,
      left: 18,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement(IconBtn26, {
    onClick: onBack
  }, /*#__PURE__*/React.createElement(TicketIcon, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 60,
      right: 18,
      zIndex: 10,
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(IconBtn26, null, /*#__PURE__*/React.createElement(ChatIcon, null)), /*#__PURE__*/React.createElement(IconBtn26, null, /*#__PURE__*/React.createElement(ProfileIcon, null))), /*#__PURE__*/React.createElement(Pin26, {
    x: 75,
    y: 150
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 195,
    y: 130
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 310,
    y: 150
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 120,
    y: 210
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 250,
    y: 205
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 345,
    y: 210
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 70,
    y: 300
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 170,
    y: 290
  }), /*#__PURE__*/React.createElement(Pin26, {
    x: 295,
    y: 310
  }), /*#__PURE__*/React.createElement(SelectedMarker26, {
    x: 205,
    y: 400,
    reserved: false
  }), /*#__PURE__*/React.createElement(MyLocation26, {
    x: 235,
    y: 500
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 18,
      top: 330,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(IconBtn26, {
    size: 42
  }, /*#__PURE__*/React.createElement(MapLayerIcon, null)), /*#__PURE__*/React.createElement(IconBtn26, {
    size: 42
  }, /*#__PURE__*/React.createElement(GroupAddIcon, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 18,
      top: 330,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(IconBtn26, {
    size: 42
  }, /*#__PURE__*/React.createElement(FilterIcon, null)), /*#__PURE__*/React.createElement(PillStack26, null, /*#__PURE__*/React.createElement(StackBtn26, null, /*#__PURE__*/React.createElement(DirectionsIcon, null)), /*#__PURE__*/React.createElement(StackBtn26, null, /*#__PURE__*/React.createElement(NavigateIcon, null)))), /*#__PURE__*/React.createElement(Sheet26, null, /*#__PURE__*/React.createElement(VehicleHeader26, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 14,
      overflowX: 'auto',
      paddingBottom: 2
    }
  }, /*#__PURE__*/React.createElement(ActionChip26, null, "Find vehicle"), /*#__PURE__*/React.createElement(ActionChip26, null, "Report issue"), /*#__PURE__*/React.createElement(ActionChip26, null, "How to ride")), /*#__PURE__*/React.createElement(PricingBlock26, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      flex: 1,
      height: 56,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      background: C26.surfaceRaised,
      color: C26.onSurface,
      boxShadow: `inset 0 0 0 1.5px ${C26.hairDark}`,
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 15,
      letterSpacing: '-.015em',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: 1.1
    }
  }, /*#__PURE__*/React.createElement("span", null, "Reserve"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontWeight: 500,
      fontSize: 11,
      color: C26.gravel,
      marginTop: 2
    }
  }, "10 min free")), /*#__PURE__*/React.createElement("button", {
    onClick: onStart,
    style: {
      flex: 1.4,
      height: 56,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      background: C26.go,
      color: '#fff',
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 17,
      letterSpacing: '-.015em',
      boxShadow: C26.mode === 'dark' ? '0 8px 18px -6px rgba(77,170,125,.45)' : '0 8px 18px -6px rgba(0,133,69,.45)'
    }
  }, "Start"))));
}

// ─────────────────────────────────────────────────────────────────────
// SCREEN 3 — RIDING (blue 3D-ish map, dark banner, stats sheet, Pause/End)
// ─────────────────────────────────────────────────────────────────────
function RidingMap26() {
  const bg = C26.ridingBg,
    bld = C26.ridingBuilding,
    top = C26.ridingBuildingTop,
    road = C26.ridingRoad;
  const sideFill = C26.mode === 'dark' ? 'rgba(0,0,0,.35)' : 'rgba(40,36,37,.05)';
  const laneColor = C26.mode === 'dark' ? 'rgba(255,255,255,.5)' : '#fff';
  return /*#__PURE__*/React.createElement("svg", {
    width: "375",
    height: "812",
    viewBox: "0 0 375 812",
    style: {
      position: 'absolute',
      inset: 0
    },
    preserveAspectRatio: "xMidYMid slice"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "375",
    height: "812",
    fill: bg
  }), /*#__PURE__*/React.createElement("g", {
    fill: bld
  }, /*#__PURE__*/React.createElement("path", {
    d: "M-10 100 L 130 50 L 130 200 L -10 250 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M150 35 L 240 5 L 240 165 L 150 195 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M260 -10 L 390 -10 L 390 145 L 260 175 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 320 L 110 280 L 110 430 L -10 470 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M260 270 L 390 230 L 390 380 L 260 420 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 550 L 100 510 L 100 650 L -10 690 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M280 480 L 390 440 L 390 600 L 280 640 Z"
  })), /*#__PURE__*/React.createElement("g", {
    fill: top
  }, /*#__PURE__*/React.createElement("path", {
    d: "M-10 100 L 130 50 L 130 70 L -10 120 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M150 35 L 240 5 L 240 25 L 150 55 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M260 -10 L 390 -10 L 390 10 L 260 20 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 320 L 110 280 L 110 300 L -10 340 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M260 270 L 390 230 L 390 250 L 260 290 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-10 550 L 100 510 L 100 530 L -10 570 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M280 480 L 390 440 L 390 460 L 280 500 Z"
  })), /*#__PURE__*/React.createElement("g", {
    fill: sideFill
  }, /*#__PURE__*/React.createElement("path", {
    d: "M130 50 L 130 200 L 110 210 L 110 60 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M240 5 L 240 165 L 220 175 L 220 15 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M110 280 L 110 430 L 90 440 L 90 290 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M100 510 L 100 650 L 80 660 L 80 520 Z"
  })), /*#__PURE__*/React.createElement("path", {
    d: `M130 200 L 260 175 L 290 270 L 110 280 Z`,
    fill: road
  }), /*#__PURE__*/React.createElement("path", {
    d: `M110 280 L 290 270 L 290 440 L 100 470 Z`,
    fill: road
  }), /*#__PURE__*/React.createElement("path", {
    d: `M100 470 L 290 440 L 280 640 L 100 680 Z`,
    fill: road
  }), /*#__PURE__*/React.createElement("path", {
    d: `M100 680 L 280 640 L 280 820 L 100 820 Z`,
    fill: road
  }), /*#__PURE__*/React.createElement("path", {
    d: `M-10 250 L 130 200 L 110 280 L -10 320 Z`,
    fill: road
  }), /*#__PURE__*/React.createElement("path", {
    d: `M-10 470 L 100 470 L 100 510 L -10 550 Z`,
    fill: road
  }), /*#__PURE__*/React.createElement("path", {
    d: "M195 195 L 195 800",
    stroke: laneColor,
    strokeWidth: "2",
    strokeDasharray: "6 8",
    opacity: "0.8"
  }));
}
function Voi26Riding({
  onEnd,
  onPause
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: C26.ridingBg,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(RidingMap26, null), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 60,
      left: 16,
      right: 16,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C26.mode === 'dark' ? C26.surfaceRaised : C26.tire,
      color: '#fff',
      borderRadius: 18,
      padding: '14px 8px 14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      boxShadow: C26.mode === 'dark' ? '0 10px 28px -8px rgba(0,0,0,.7)' : '0 10px 28px -8px rgba(40,36,37,.45)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 15,
      letterSpacing: '-.015em'
    }
  }, "Ride started"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontWeight: 400,
      fontSize: 12.5,
      opacity: .7,
      marginTop: 2
    }
  }, "vehicle is unlocked and ready")), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 34,
      padding: '0 14px',
      borderRadius: 999,
      cursor: 'pointer',
      background: 'transparent',
      color: '#fff',
      border: '1.5px solid rgba(255,255,255,.4)',
      fontFamily: SF,
      fontWeight: 600,
      fontSize: 13,
      letterSpacing: '-.005em',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "9 14 4 9 9 4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M20 20 v-7 a4 4 0 0 0-4-4 H4"
  })), "Undo"))), /*#__PURE__*/React.createElement(MyLocation26, {
    x: 188,
    y: 460
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 18,
      bottom: 235,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement(IconBtn26, {
    size: 42
  }, /*#__PURE__*/React.createElement(ChatIcon, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 18,
      bottom: 215,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement(PillStack26, null, /*#__PURE__*/React.createElement(StackBtn26, null, /*#__PURE__*/React.createElement(DirectionsIcon, null)), /*#__PURE__*/React.createElement(StackBtn26, null, /*#__PURE__*/React.createElement(NavigateIcon, null)))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      bottom: 240,
      transform: 'translateX(-50%)',
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      height: 42,
      padding: '0 18px',
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      background: C26.iconBg,
      color: C26.iconFg,
      fontFamily: SF,
      fontWeight: 600,
      fontSize: 14,
      letterSpacing: '-.01em',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      boxShadow: C26.iconShadow
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  })), "Add vehicle")), /*#__PURE__*/React.createElement(Sheet26, {
    pad: "10px 18px 24px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 10,
      padding: '4px 4px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: C26.go,
      margin: '0 auto 6px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: '-.03em',
      color: C26.onSurface,
      fontVariantNumeric: 'tabular-nums',
      lineHeight: 1
    }
  }, "00:04"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontWeight: 500,
      fontSize: 12,
      color: C26.gravel,
      marginTop: 4
    }
  }, "Unlocked")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      borderLeft: `1px solid ${C26.hair}`,
      borderRight: `1px solid ${C26.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(BikeGlyph, {
    size: 20,
    color: C26.onSurface
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: '-.03em',
      color: C26.onSurface,
      lineHeight: 1
    }
  }, "MN5F"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontWeight: 500,
      fontSize: 12,
      color: C26.gravel,
      marginTop: 4
    }
  }, "Bike")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "14",
    viewBox: "0 0 24 14",
    fill: "none",
    stroke: C26.onSurface,
    strokeWidth: "1.6"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "1",
    y: "1",
    width: "20",
    height: "12",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "21.5",
    y: "4.5",
    width: "2",
    height: "5",
    rx: "1",
    fill: C26.onSurface
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2.5",
    y: "2.5",
    width: "15",
    height: "9",
    rx: "1",
    fill: C26.onSurface,
    stroke: "none"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: '-.03em',
      color: C26.onSurface,
      lineHeight: 1
    }
  }, "86%"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontWeight: 500,
      fontSize: 12,
      color: C26.gravel,
      marginTop: 4
    }
  }, "Battery"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onPause,
    style: {
      flex: 1,
      height: 56,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      background: C26.surfaceRaised,
      color: C26.onSurface,
      boxShadow: `inset 0 0 0 1.5px ${C26.hairDark}`,
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 16,
      letterSpacing: '-.015em'
    }
  }, "Pause"), /*#__PURE__*/React.createElement("button", {
    onClick: onEnd,
    style: {
      flex: 1,
      height: 56,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      background: C26.stop,
      color: '#fff',
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 16,
      letterSpacing: '-.015em',
      boxShadow: C26.mode === 'dark' ? '0 8px 18px -6px rgba(244,113,108,.45)' : '0 8px 18px -6px rgba(237,28,36,.45)'
    }
  }, "End"))));
}

// ─────────────────────────────────────────────────────────────────────
// SCREEN 4 — SUMMARY (kept as a sensible flow extension)
// ─────────────────────────────────────────────────────────────────────
function Voi26Summary({
  onDone
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: C26.surface,
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '58px 22px 100px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(IconBtn26, {
    onClick: onDone,
    size: 36
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: C26.onSurface,
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 11.5,
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: C26.coral
    }
  }, "Ride summary"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '6px 0 0',
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 54,
      letterSpacing: '-.05em',
      color: C26.onSurface,
      lineHeight: 1
    }
  }, "3,95\xA0\u20AC"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontFamily: SF,
      fontSize: 13,
      color: C26.onSurfaceMuted
    }
  }, "Tue 18 Nov \xB7 18:14 \u2192 18:27 \xB7 Stockholm")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      background: C26.chipBg,
      borderRadius: 16,
      overflow: 'hidden'
    }
  }, [['2,8 km', 'Distance'], ['13:07', 'Time'], ['520 g', 'CO₂ saved']].map(([v, k], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '14px 12px',
      textAlign: 'center',
      borderLeft: i ? `1px solid ${C26.hair}` : '0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 18,
      letterSpacing: '-.025em',
      color: C26.onSurface
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontWeight: 500,
      fontSize: 11.5,
      color: C26.gravel,
      marginTop: 3
    }
  }, k)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      padding: '4px 18px',
      background: C26.surfaceRaised,
      borderRadius: 16,
      boxShadow: `inset 0 0 0 1px ${C26.hair}`
    }
  }, [['Unlock fee', '1,00 €'], ['13 min · 0,25 €/min', '3,25 €'], ['Monthly 300 discount', '−0,30 €']].map(([k, v], i, a) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '13px 0',
      borderBottom: i < a.length - 1 ? `1px solid ${C26.hair}` : '0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontWeight: 500,
      fontSize: 14,
      color: C26.onSurface
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontWeight: 600,
      fontSize: 14,
      color: C26.onSurface,
      fontVariantNumeric: 'tabular-nums'
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      flex: 1,
      height: 52,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      background: C26.surfaceRaised,
      color: C26.onSurface,
      boxShadow: `inset 0 0 0 1.5px ${C26.hairDark}`,
      fontFamily: SF,
      fontWeight: 600,
      fontSize: 14
    }
  }, "Get receipt"), /*#__PURE__*/React.createElement("button", {
    onClick: onDone,
    style: {
      flex: 1,
      height: 52,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      background: C26.mode === 'dark' ? C26.coral : C26.tire,
      color: '#fff',
      fontFamily: SF,
      fontWeight: 700,
      fontSize: 14
    }
  }, "Done"))));
}
Object.assign(window, {
  Voi26Reserved,
  Voi26Picked,
  Voi26Riding,
  Voi26Summary
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/rider-app/VoiSheets26.jsx", error: String((e && e.message) || e) }); }

// ui_kits/rider-app/design-canvas.jsx
try { (() => {
// DesignCanvas.jsx — Figma-ish design canvas wrapper
// Warm gray grid bg + Sections + Artboards + PostIt notes.
// No assets, no deps.

const DC = {
  bg: '#f0eee9',
  grid: 'rgba(0,0,0,0.06)',
  label: 'rgba(60,50,40,0.7)',
  title: 'rgba(40,30,20,0.85)',
  subtitle: 'rgba(60,50,40,0.6)',
  postitBg: '#fef4a8',
  postitText: '#5a4a2a',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
};

// ─────────────────────────────────────────────────────────────
// Main canvas — transform-based pan/zoom viewport
//
// Input mapping (Figma-style):
//   • trackpad pinch  → zoom   (ctrlKey wheel; Safari gesture* events)
//   • trackpad scroll → pan    (two-finger)
//   • mouse wheel     → zoom   (notched; distinguished from trackpad scroll)
//   • middle-drag / primary-drag-on-bg → pan
//
// Transform state lives in a ref and is written straight to the DOM
// (translate3d + will-change) so wheel ticks don't go through React —
// keeps pans at 60fps on dense canvases.
// ─────────────────────────────────────────────────────────────
function DesignCanvas({
  children,
  minScale = 0.1,
  maxScale = 8,
  style = {}
}) {
  const vpRef = React.useRef(null);
  const worldRef = React.useRef(null);
  const tf = React.useRef({
    x: 0,
    y: 0,
    scale: 1
  });
  const apply = React.useCallback(() => {
    const {
      x,
      y,
      scale
    } = tf.current;
    const el = worldRef.current;
    if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }, []);
  React.useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const zoomAt = (cx, cy, factor) => {
      const r = vp.getBoundingClientRect();
      const px = cx - r.left,
        py = cy - r.top;
      const t = tf.current;
      const next = Math.min(maxScale, Math.max(minScale, t.scale * factor));
      const k = next / t.scale;
      // keep the world point under the cursor fixed
      t.x = px - (px - t.x) * k;
      t.y = py - (py - t.y) * k;
      t.scale = next;
      apply();
    };

    // Mouse-wheel vs trackpad-scroll heuristic. A physical wheel sends
    // line-mode deltas (Firefox) or large integer pixel deltas with no X
    // component (Chrome/Safari, typically multiples of 100/120). Trackpad
    // two-finger scroll sends small/fractional pixel deltas, often with
    // non-zero deltaX. ctrlKey is set by the browser for trackpad pinch.
    const isMouseWheel = e => e.deltaMode !== 0 || e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40;
    const onWheel = e => {
      e.preventDefault();
      if (isGesturing) return; // Safari: gesture* owns the pinch — discard concurrent wheels
      if (e.ctrlKey) {
        // trackpad pinch (or explicit ctrl+wheel)
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      } else if (isMouseWheel(e)) {
        // notched mouse wheel — fixed-ratio step per click
        zoomAt(e.clientX, e.clientY, Math.exp(-Math.sign(e.deltaY) * 0.18));
      } else {
        // trackpad two-finger scroll — pan
        tf.current.x -= e.deltaX;
        tf.current.y -= e.deltaY;
        apply();
      }
    };

    // Safari sends native gesture* events for trackpad pinch with a smooth
    // e.scale; preferring these over the ctrl+wheel fallback gives a much
    // better feel there. No-ops on other browsers. Safari also fires
    // ctrlKey wheel events during the same pinch — isGesturing makes
    // onWheel drop those entirely so they neither zoom nor pan.
    let gsBase = 1;
    let isGesturing = false;
    const onGestureStart = e => {
      e.preventDefault();
      isGesturing = true;
      gsBase = tf.current.scale;
    };
    const onGestureChange = e => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, gsBase * e.scale / tf.current.scale);
    };
    const onGestureEnd = e => {
      e.preventDefault();
      isGesturing = false;
    };

    // Drag-pan: middle button anywhere, or primary button starting on the
    // canvas background (not inside an artboard).
    let drag = null;
    const onPointerDown = e => {
      const onBg = e.target === vp || e.target === worldRef.current;
      if (!(e.button === 1 || e.button === 0 && onBg)) return;
      e.preventDefault();
      vp.setPointerCapture(e.pointerId);
      drag = {
        id: e.pointerId,
        lx: e.clientX,
        ly: e.clientY
      };
      vp.style.cursor = 'grabbing';
    };
    const onPointerMove = e => {
      if (!drag || e.pointerId !== drag.id) return;
      tf.current.x += e.clientX - drag.lx;
      tf.current.y += e.clientY - drag.ly;
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      apply();
    };
    const onPointerUp = e => {
      if (!drag || e.pointerId !== drag.id) return;
      vp.releasePointerCapture(e.pointerId);
      drag = null;
      vp.style.cursor = '';
    };
    vp.addEventListener('wheel', onWheel, {
      passive: false
    });
    vp.addEventListener('gesturestart', onGestureStart, {
      passive: false
    });
    vp.addEventListener('gesturechange', onGestureChange, {
      passive: false
    });
    vp.addEventListener('gestureend', onGestureEnd, {
      passive: false
    });
    vp.addEventListener('pointerdown', onPointerDown);
    vp.addEventListener('pointermove', onPointerMove);
    vp.addEventListener('pointerup', onPointerUp);
    vp.addEventListener('pointercancel', onPointerUp);
    return () => {
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('gesturestart', onGestureStart);
      vp.removeEventListener('gesturechange', onGestureChange);
      vp.removeEventListener('gestureend', onGestureEnd);
      vp.removeEventListener('pointerdown', onPointerDown);
      vp.removeEventListener('pointermove', onPointerMove);
      vp.removeEventListener('pointerup', onPointerUp);
      vp.removeEventListener('pointercancel', onPointerUp);
    };
  }, [apply, minScale, maxScale]);
  const gridSvg = `url("data:image/svg+xml,%3Csvg width='120' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M120 0H0v120' fill='none' stroke='${encodeURIComponent(DC.grid)}' stroke-width='1'/%3E%3C/svg%3E")`;
  return /*#__PURE__*/React.createElement("div", {
    ref: vpRef,
    className: "design-canvas",
    style: {
      height: '100vh',
      width: '100vw',
      background: DC.bg,
      overflow: 'hidden',
      overscrollBehavior: 'none',
      touchAction: 'none',
      position: 'relative',
      fontFamily: DC.font,
      boxSizing: 'border-box',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: worldRef,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      transformOrigin: '0 0',
      willChange: 'transform',
      width: 'max-content',
      minWidth: '100%',
      minHeight: '100%',
      padding: '60px 0 80px',
      backgroundImage: gridSvg,
      backgroundSize: '120px 120px'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Section — title + subtitle + h-stack of artboards (no wrap)
// ─────────────────────────────────────────────────────────────
function DCSection({
  title,
  subtitle,
  children,
  gap = 48
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 80,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 60px 36px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 600,
      color: DC.title,
      letterSpacing: -0.3,
      marginBottom: 4
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 400,
      color: DC.subtitle
    }
  }, subtitle)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap,
      padding: '0 60px',
      alignItems: 'flex-start',
      width: 'max-content'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Artboard — labeled card
// ─────────────────────────────────────────────────────────────
function DCArtboard({
  label,
  children,
  width,
  height,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flexShrink: 0
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: '100%',
      left: 0,
      paddingBottom: 8,
      fontSize: 12,
      fontWeight: 500,
      color: DC.label,
      whiteSpace: 'nowrap'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 2,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)',
      overflow: 'hidden',
      width,
      height,
      background: '#fff',
      ...style
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Post-it — absolute-positioned sticky note
// ─────────────────────────────────────────────────────────────
function DCPostIt({
  children,
  top,
  left,
  right,
  bottom,
  rotate = -2,
  width = 180
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top,
      left,
      right,
      bottom,
      width,
      background: DC.postitBg,
      padding: '14px 16px',
      fontFamily: '"Comic Sans MS", "Marker Felt", "Segoe Print", cursive',
      fontSize: 14,
      lineHeight: 1.4,
      color: DC.postitText,
      boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
      transform: `rotate(${rotate}deg)`,
      zIndex: 5
    }
  }, children);
}
Object.assign(window, {
  DesignCanvas,
  DCSection,
  DCArtboard,
  DCPostIt
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/rider-app/design-canvas.jsx", error: String((e && e.message) || e) }); }

// ui_kits/rider-app/ios-frame.jsx
try { (() => {
// iOS.jsx — Simplified iOS 26 (Liquid Glass) device frame
// Based on the iOS 26 UI Kit + Figma status bar spec. No assets, no deps.
// Exports: IOSDevice, IOSStatusBar, IOSNavBar, IOSGlassPill, IOSList, IOSListRow, IOSKeyboard

// ─────────────────────────────────────────────────────────────
// Status bar
// ─────────────────────────────────────────────────────────────
function IOSStatusBar({
  dark = false,
  time = '9:41'
}) {
  const c = dark ? '#fff' : '#000';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 154,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '21px 24px 19px',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 20,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 1.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: '-apple-system, "SF Pro", system-ui',
      fontWeight: 590,
      fontSize: 17,
      lineHeight: '22px',
      color: c
    }
  }, time)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingTop: 1,
      paddingRight: 1
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "19",
    height: "12",
    viewBox: "0 0 19 12"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "7.5",
    width: "3.2",
    height: "4.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4.8",
    y: "5",
    width: "3.2",
    height: "7",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9.6",
    y: "2.5",
    width: "3.2",
    height: "9.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14.4",
    y: "0",
    width: "3.2",
    height: "12",
    rx: "0.7",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "12",
    viewBox: "0 0 17 12"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z",
    fill: c
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "10.5",
    r: "1.5",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "27",
    height: "13",
    viewBox: "0 0 27 13"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "23",
    height: "12",
    rx: "3.5",
    stroke: c,
    strokeOpacity: "0.35",
    fill: "none"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "20",
    height: "9",
    rx: "2",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z",
    fill: c,
    fillOpacity: "0.4"
  }))));
}

// ─────────────────────────────────────────────────────────────
// Liquid glass pill — blur + tint + shine
// ─────────────────────────────────────────────────────────────
function IOSGlassPill({
  children,
  dark = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      minWidth: 44,
      borderRadius: 9999,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: dark ? '0 2px 6px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.07), 0 3px 10px rgba(0,0,0,0.06)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.28)' : 'rgba(255,255,255,0.5)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.08)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      padding: '0 4px'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Navigation bar — glass pills + large title
// ─────────────────────────────────────────────────────────────
function IOSNavBar({
  title = 'Title',
  dark = false,
  trailingIcon = true
}) {
  const muted = dark ? 'rgba(255,255,255,0.6)' : '#404040';
  const text = dark ? '#fff' : '#000';
  const pillIcon = content => /*#__PURE__*/React.createElement(IOSGlassPill, {
    dark: dark
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, content));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      paddingTop: 62,
      paddingBottom: 10,
      position: 'relative',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px'
    }
  }, pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "20",
    viewBox: "0 0 12 20",
    fill: "none",
    style: {
      marginLeft: -1
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 2L2 10l8 8",
    stroke: muted,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), trailingIcon && pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "6",
    viewBox: "0 0 22 6"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "3",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "3",
    r: "2.5",
    fill: muted
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      fontFamily: '-apple-system, system-ui',
      fontSize: 34,
      fontWeight: 700,
      lineHeight: '41px',
      color: text,
      letterSpacing: 0.4
    }
  }, title));
}

// ─────────────────────────────────────────────────────────────
// Grouped list (inset card, r:26) + row (52px)
// ─────────────────────────────────────────────────────────────
function IOSListRow({
  title,
  detail,
  icon,
  chevron = true,
  isLast = false,
  dark = false
}) {
  const text = dark ? '#fff' : '#000';
  const sec = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const ter = dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)';
  const sep = dark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.12)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      minHeight: 52,
      padding: '0 16px',
      position: 'relative',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      letterSpacing: -0.43
    }
  }, icon && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 7,
      background: icon,
      marginRight: 12,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      color: text
    }
  }, title), detail && /*#__PURE__*/React.createElement("span", {
    style: {
      color: sec,
      marginRight: 6
    }
  }, detail), chevron && /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "14",
    viewBox: "0 0 8 14",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1l6 6-6 6",
    stroke: ter,
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), !isLast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      left: icon ? 58 : 16,
      height: 0.5,
      background: sep
    }
  }));
}
function IOSList({
  header,
  children,
  dark = false
}) {
  const hc = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const bg = dark ? '#1C1C1E' : '#fff';
  return /*#__PURE__*/React.createElement("div", null, header && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: '-apple-system, system-ui',
      fontSize: 13,
      color: hc,
      textTransform: 'uppercase',
      padding: '8px 36px 6px',
      letterSpacing: -0.08
    }
  }, header), /*#__PURE__*/React.createElement("div", {
    style: {
      background: bg,
      borderRadius: 26,
      margin: '0 16px',
      overflow: 'hidden'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Device frame
// ─────────────────────────────────────────────────────────────
function IOSDevice({
  children,
  width = 402,
  height = 874,
  dark = false,
  title,
  keyboard = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      borderRadius: 48,
      overflow: 'hidden',
      position: 'relative',
      background: dark ? '#000' : '#F2F2F7',
      boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
      fontFamily: '-apple-system, system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 11,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 126,
      height: 37,
      borderRadius: 24,
      background: '#000',
      zIndex: 50
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement(IOSStatusBar, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }
  }, title !== undefined && /*#__PURE__*/React.createElement(IOSNavBar, {
    title: title,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto'
    }
  }, children), keyboard && /*#__PURE__*/React.createElement(IOSKeyboard, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 60,
      height: 34,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingBottom: 8,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 139,
      height: 5,
      borderRadius: 100,
      background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)'
    }
  })));
}

// ─────────────────────────────────────────────────────────────
// Keyboard — iOS 26 liquid glass
// ─────────────────────────────────────────────────────────────
function IOSKeyboard({
  dark = false
}) {
  const glyph = dark ? 'rgba(255,255,255,0.7)' : '#595959';
  const sugg = dark ? 'rgba(255,255,255,0.6)' : '#333';
  const keyBg = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';

  // special-key icons
  const icons = {
    shift: /*#__PURE__*/React.createElement("svg", {
      width: "19",
      height: "17",
      viewBox: "0 0 19 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9.5 1L1 9.5h4.5V16h8V9.5H18L9.5 1z",
      fill: glyph
    })),
    del: /*#__PURE__*/React.createElement("svg", {
      width: "23",
      height: "17",
      viewBox: "0 0 23 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M7 1h13a2 2 0 012 2v11a2 2 0 01-2 2H7l-6-7.5L7 1z",
      fill: "none",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 5l7 7M17 5l-7 7",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinecap: "round"
    })),
    ret: /*#__PURE__*/React.createElement("svg", {
      width: "20",
      height: "14",
      viewBox: "0 0 20 14"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M18 1v6H4m0 0l4-4M4 7l4 4",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))
  };
  const key = (content, {
    w,
    flex,
    ret,
    fs = 25,
    k
  } = {}) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      height: 42,
      borderRadius: 8.5,
      flex: flex ? 1 : undefined,
      width: w,
      minWidth: 0,
      background: ret ? '#08f' : keyBg,
      boxShadow: '0 1px 0 rgba(0,0,0,0.075)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, "SF Compact", system-ui',
      fontSize: fs,
      fontWeight: 458,
      color: ret ? '#fff' : glyph
    }
  }, content);
  const row = (keys, pad = 0) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      justifyContent: 'center',
      padding: `0 ${pad}px`
    }
  }, keys.map(l => key(l, {
    flex: true,
    k: l
  })));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 15,
      borderRadius: 27,
      overflow: 'hidden',
      padding: '11px 0 2px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: dark ? '0 -2px 20px rgba(0,0,0,0.09)' : '0 -1px 6px rgba(0,0,0,0.018), 0 -3px 20px rgba(0,0,0,0.012)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.14)' : 'rgba(255,255,255,0.25)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'center',
      padding: '8px 22px 13px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, ['"The"', 'the', 'to'].map((w, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 25,
      background: '#ccc',
      opacity: 0.3
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      color: sugg,
      letterSpacing: -0.43,
      lineHeight: '22px'
    }
  }, w)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13,
      padding: '0 6.5px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, row(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']), row(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], 20), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14.25,
      alignItems: 'center'
    }
  }, key(icons.shift, {
    w: 45,
    k: 'shift'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      flex: 1
    }
  }, ['z', 'x', 'c', 'v', 'b', 'n', 'm'].map(l => key(l, {
    flex: true,
    k: l
  }))), key(icons.del, {
    w: 45,
    k: 'del'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, key('ABC', {
    w: 92.25,
    fs: 18,
    k: 'abc'
  }), key('', {
    flex: true,
    k: 'space'
  }), key(icons.ret, {
    w: 92.25,
    ret: true,
    k: 'ret'
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      width: '100%',
      position: 'relative'
    }
  }));
}
Object.assign(window, {
  IOSDevice,
  IOSStatusBar,
  IOSNavBar,
  IOSGlassPill,
  IOSList,
  IOSListRow,
  IOSKeyboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/rider-app/ios-frame.jsx", error: String((e && e.message) || e) }); }

})();
