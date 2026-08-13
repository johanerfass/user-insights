/* =============================================================
   Minimal QR encoder — enough for the source links on this board.

   Model 2, byte mode only, versions 1–15, ECC level L or M. That's
   deliberate: the board renders QRs at ~160px, and past version 15
   (77×77 modules) the modules get too small for a phone to read off
   a TV anyway. Byte mode alone because every input here is a URL.

   Exposes window.QR.matrix(text, opts) -> boolean[][] (true = dark)
   and window.QR.svg(text, opts) -> SVG string.

   The ECC block table and alignment-pattern positions below were
   generated from the `segno` library's tables, and the whole encoder
   is verified against segno's output matrix-for-matrix (see
   scripts/test/qr.test.mjs).
   ============================================================= */
(function (root) {
  "use strict";

  const ECC_BLOCKS = {
    // [blockCount, totalCodewordsPerBlock, dataCodewordsPerBlock] per group
    L: [
      [[1, 26, 19]],
      [[1, 44, 34]],
      [[1, 70, 55]],
      [[1, 100, 80]],
      [[1, 134, 108]],
      [[2, 86, 68]],
      [[2, 98, 78]],
      [[2, 121, 97]],
      [[2, 146, 116]],
      [[2, 86, 68], [2, 87, 69]],
      [[4, 101, 81]],
      [[2, 116, 92], [2, 117, 93]],
      [[4, 133, 107]],
      [[3, 145, 115], [1, 146, 116]],
      [[5, 109, 87], [1, 110, 88]],
    ],
    M: [
      [[1, 26, 16]],
      [[1, 44, 28]],
      [[1, 70, 44]],
      [[2, 50, 32]],
      [[2, 67, 43]],
      [[4, 43, 27]],
      [[4, 49, 31]],
      [[2, 60, 38], [2, 61, 39]],
      [[3, 58, 36], [2, 59, 37]],
      [[4, 69, 43], [1, 70, 44]],
      [[1, 80, 50], [4, 81, 51]],
      [[6, 58, 36], [2, 59, 37]],
      [[8, 59, 37], [1, 60, 38]],
      [[4, 64, 40], [5, 65, 41]],
      [[5, 65, 41], [5, 66, 42]],
    ],
  };

  // Alignment-pattern centre coordinates for versions 2..15 (v1 has none).
  const ALIGNMENT_POS = [
    [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
    [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
    [6, 26, 46, 66], [6, 26, 48, 70],
  ];

  const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  // Details of the most recent encode — surfaced for tests/debugging only.
  let lastEncoding = null;

  /* ---------- GF(256) arithmetic (x^8 + x^4 + x^3 + x^2 + 1) ---------- */

  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function initGaloisField() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  /** Generator polynomial for `degree` error-correction codewords. */
  function generatorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  /** Reed-Solomon remainder — the ECC codewords for one block. */
  function eccForBlock(data, eccLen) {
    const gen = generatorPoly(eccLen);
    const remainder = new Array(eccLen).fill(0);
    for (const byte of data) {
      const factor = byte ^ remainder[0];
      remainder.shift();
      remainder.push(0);
      if (factor !== 0) {
        for (let i = 0; i < eccLen; i++) {
          remainder[i] ^= gfMul(gen[i + 1], factor);
        }
      }
    }
    return remainder;
  }

  /* ---------- BCH codes for the format / version info areas ---------- */

  function bchFormat(bits) {
    let d = bits << 10;
    for (let i = 14; i >= 10; i--) {
      if ((d >> i) & 1) d ^= 0x537 << (i - 10);
    }
    return ((bits << 10) | d) ^ 0x5412;
  }

  function bchVersion(version) {
    let d = version << 12;
    for (let i = 17; i >= 12; i--) {
      if ((d >> i) & 1) d ^= 0x1f25 << (i - 12);
    }
    return (version << 12) | d;
  }

  /* ---------- data encoding ---------- */

  // Hand-rolled rather than TextEncoder so the module has no environment
  // dependencies and can be unit-tested in any JS runtime.
  function utf8Bytes(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let code = str.charCodeAt(i);
      // Combine surrogate pairs into a single code point.
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
        const low = str.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          code = (code - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
          i++;
        }
      }
      if (code < 0x80) {
        out.push(code);
      } else if (code < 0x800) {
        out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0x10000) {
        out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else {
        out.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f)
        );
      }
    }
    return out;
  }

  function totalDataCodewords(version, level) {
    return ECC_BLOCKS[level][version - 1].reduce(
      (sum, [count, , dataLen]) => sum + count * dataLen,
      0
    );
  }

  // Byte mode uses an 8-bit character count up to version 9, 16-bit from 10 on.
  function countBits(version) {
    return version <= 9 ? 8 : 16;
  }

  function chooseVersion(byteLen, level) {
    for (let v = 1; v <= ECC_BLOCKS[level].length; v++) {
      const capacity = totalDataCodewords(v, level) - 2 - (countBits(v) === 16 ? 1 : 0);
      if (byteLen <= capacity) return v;
    }
    return null;
  }

  /** Mode indicator + length + payload + terminator + pad, as codewords. */
  function buildDataCodewords(bytes, version, level) {
    const capacityBits = totalDataCodewords(version, level) * 8;
    const bits = [];
    const push = (value, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
    };

    push(0b0100, 4); // byte mode
    push(bytes.length, countBits(version));
    for (const b of bytes) push(b, 8);

    // Terminator, then align to a codeword boundary.
    for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      codewords.push(byte);
    }
    // Spec-mandated alternating pad bytes.
    const PAD = [0xec, 0x11];
    let p = 0;
    while (codewords.length < capacityBits / 8) codewords.push(PAD[p++ % 2]);
    return codewords;
  }

  /** Split into blocks, add ECC, then interleave data and ECC codewords. */
  function interleave(codewords, version, level) {
    const groups = ECC_BLOCKS[level][version - 1];
    const dataBlocks = [];
    const eccBlocks = [];
    let offset = 0;
    for (const [count, total, dataLen] of groups) {
      for (let i = 0; i < count; i++) {
        const block = codewords.slice(offset, offset + dataLen);
        offset += dataLen;
        dataBlocks.push(block);
        eccBlocks.push(eccForBlock(block, total - dataLen));
      }
    }

    const result = [];
    const maxData = Math.max(...dataBlocks.map((b) => b.length));
    for (let i = 0; i < maxData; i++) {
      for (const block of dataBlocks) if (i < block.length) result.push(block[i]);
    }
    const maxEcc = Math.max(...eccBlocks.map((b) => b.length));
    for (let i = 0; i < maxEcc; i++) {
      for (const block of eccBlocks) if (i < block.length) result.push(block[i]);
    }
    return result;
  }

  /* ---------- module placement ---------- */

  function buildMatrix(version) {
    const size = version * 4 + 17;
    const modules = [];
    const reserved = []; // function patterns — data must skip these
    for (let i = 0; i < size; i++) {
      modules.push(new Array(size).fill(false));
      reserved.push(new Array(size).fill(false));
    }

    const setFn = (r, c, dark) => {
      modules[r][c] = dark;
      reserved[r][c] = true;
    };

    // Finder patterns + separators, at the three corners.
    const placeFinder = (row, col) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = row + r;
          const cc = col + c;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          const inRing =
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6));
          const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setFn(rr, cc, inRing || inCore);
        }
      }
    };
    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // Timing patterns.
    for (let i = 8; i < size - 8; i++) {
      setFn(6, i, i % 2 === 0);
      setFn(i, 6, i % 2 === 0);
    }

    // Alignment patterns, skipping any that would collide with a finder.
    if (version > 1) {
      const centres = ALIGNMENT_POS[version - 2];
      for (const r of centres) {
        for (const c of centres) {
          const nearFinder =
            (r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
          if (nearFinder) continue;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const ring = Math.max(Math.abs(dr), Math.abs(dc));
              setFn(r + dr, c + dc, ring !== 1);
            }
          }
        }
      }
    }

    // Reserve the format-info areas and the always-dark module.
    for (let i = 0; i < 9; i++) {
      if (!reserved[8][i]) setFn(8, i, false);
      if (!reserved[i][8]) setFn(i, 8, false);
    }
    for (let i = 0; i < 8; i++) {
      if (!reserved[8][size - 1 - i]) setFn(8, size - 1 - i, false);
      if (!reserved[size - 1 - i][8]) setFn(size - 1 - i, 8, false);
    }
    setFn(size - 8, 8, true); // dark module

    // Reserve the version-info blocks (version 7 and up).
    if (version >= 7) {
      for (let i = 0; i < 18; i++) {
        const a = Math.floor(i / 3);
        const b = (i % 3) + size - 11;
        setFn(b, a, false);
        setFn(a, b, false);
      }
    }

    return { modules, reserved, size };
  }

  /** Place the codeword bitstream in the standard upward/downward zigzag. */
  function placeData(modules, reserved, size, codewords) {
    let bitIndex = 0;
    const nextBit = () => {
      const byte = codewords[bitIndex >> 3];
      const bit = byte === undefined ? 0 : (byte >> (7 - (bitIndex & 7))) & 1;
      bitIndex++;
      return bit === 1;
    };

    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--; // the vertical timing pattern column is skipped entirely
      for (let i = 0; i < size; i++) {
        const row = upward ? size - 1 - i : i;
        for (const c of [col, col - 1]) {
          if (reserved[row][c]) continue;
          modules[row][c] = nextBit();
        }
      }
      upward = !upward;
    }
  }

  /* ---------- masking ---------- */

  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  function applyMask(modules, reserved, size, maskIndex) {
    const mask = MASKS[maskIndex];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && mask(r, c)) modules[r][c] = !modules[r][c];
      }
    }
  }

  /** The four penalty rules from the spec; lower total is a better mask. */
  function penalty(modules, size) {
    let score = 0;

    // Rule 1 — runs of five or more same-coloured modules in a line.
    const runPenalty = (get) => {
      for (let a = 0; a < size; a++) {
        let run = 1;
        for (let b = 1; b < size; b++) {
          if (get(a, b) === get(a, b - 1)) {
            run++;
          } else {
            if (run >= 5) score += run - 2;
            run = 1;
          }
        }
        if (run >= 5) score += run - 2;
      }
    };
    runPenalty((r, c) => modules[r][c]);
    runPenalty((c, r) => modules[r][c]);

    // Rule 2 — every 2x2 block of one colour.
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = modules[r][c];
        if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
          score += 3;
        }
      }
    }

    // Rule 3 — the 1:1:3:1:1 finder-lookalike pattern, with 4 light modules
    // on either side.
    const PATTERN = [true, false, true, true, true, false, true];
    const matchesAt = (get, a, b) => {
      for (let i = 0; i < 7; i++) if (get(a, b + i) !== PATTERN[i]) return false;
      const beforeClear = (from) => {
        for (let i = from; i < from + 4; i++) {
          if (i < 0 || i >= size) continue;
          if (get(a, i)) return false;
        }
        return true;
      };
      return beforeClear(b - 4) || beforeClear(b + 7);
    };
    for (let a = 0; a < size; a++) {
      for (let b = 0; b <= size - 7; b++) {
        if (matchesAt((x, y) => modules[x][y], a, b)) score += 40;
        if (matchesAt((x, y) => modules[y][x], a, b)) score += 40;
      }
    }

    // Rule 4 — deviation from a 50/50 dark/light balance.
    let dark = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (modules[r][c]) dark++;
    const ratio = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(ratio - 50) / 5) * 10;

    return score;
  }

  function writeFormatInfo(modules, size, level, maskIndex) {
    const bits = bchFormat((ECC_FORMAT_BITS[level] << 3) | maskIndex);
    const bitAt = (i) => ((bits >> i) & 1) === 1;

    // Copy 1, around the top-left finder: bits 0-7 run down column 8 (the
    // timing row is skipped), then bits 8-14 run leftwards along row 8.
    for (let i = 0; i <= 5; i++) modules[i][8] = bitAt(i);
    modules[7][8] = bitAt(6);
    modules[8][8] = bitAt(7);
    modules[8][7] = bitAt(8);
    for (let i = 9; i <= 14; i++) modules[8][14 - i] = bitAt(i);

    // Copy 2: bits 0-7 run leftwards along row 8 from the right edge, then
    // bits 8-14 run upwards along column 8 from the bottom edge.
    for (let i = 0; i <= 7; i++) modules[8][size - 1 - i] = bitAt(i);
    for (let i = 8; i <= 14; i++) modules[size - 15 + i][8] = bitAt(i);
  }

  function writeVersionInfo(modules, size, version) {
    if (version < 7) return;
    const bits = bchVersion(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + size - 11;
      modules[b][a] = bit;
      modules[a][b] = bit;
    }
  }

  /* ---------- public API ---------- */

  /**
   * Encode `text` and return the module matrix (true = dark), excluding the
   * quiet zone. Throws if the text is too long for version 15.
   */
  function matrix(text, opts) {
    const level = (opts && opts.level) || "L";
    if (!ECC_BLOCKS[level]) throw new Error(`QR: unsupported ECC level "${level}"`);

    const bytes = utf8Bytes(String(text));
    const version = chooseVersion(bytes.length, level);
    if (!version) {
      throw new Error(
        `QR: ${bytes.length} bytes exceeds the version-15 level-${level} capacity`
      );
    }

    const codewords = interleave(buildDataCodewords(bytes, version, level), version, level);
    const { modules, reserved, size } = buildMatrix(version);
    placeData(modules, reserved, size, codewords);
    writeVersionInfo(modules, size, version);

    // Try all 8 masks and keep the lowest-penalty one, as the spec requires.
    // opts.mask forces a specific one — only used by the tests, which compare
    // against a reference encoder mask-by-mask.
    const forced = opts && opts.mask;
    const candidates = typeof forced === "number" ? [forced] : [0, 1, 2, 3, 4, 5, 6, 7];
    let best = null;
    for (const m of candidates) {
      const candidate = modules.map((row) => row.slice());
      applyMask(candidate, reserved, size, m);
      writeFormatInfo(candidate, size, level, m);
      const score = penalty(candidate, size);
      if (!best || score < best.score) best = { score, modules: candidate, mask: m };
    }
    lastEncoding = { version, level, mask: best.mask, penalty: best.score };
    return best.modules;
  }

  /**
   * Render `text` as an SVG string. Uses a single <path> so it stays light
   * even at TV sizes, plus the 4-module quiet zone the spec requires.
   */
  function svg(text, opts) {
    const options = opts || {};
    const quiet = options.quiet == null ? 4 : options.quiet;
    const dark = options.dark || "#282425";
    const light = options.light || "#ffffff";
    const mods = matrix(text, options);
    const size = mods.length;
    const total = size + quiet * 2;

    let path = "";
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (mods[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
      }
    }

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
      `shape-rendering="crispEdges" role="img">` +
      `<rect width="${total}" height="${total}" fill="${light}"/>` +
      `<path d="${path}" fill="${dark}"/>` +
      `</svg>`
    );
  }

  const api = {
    matrix,
    svg,
    lastEncoding: () => lastEncoding,
    // Test hook: the final interleaved codeword stream for a given input.
    codewords(text, opts) {
      const level = (opts && opts.level) || "L";
      const bytes = utf8Bytes(String(text));
      const version = (opts && opts.version) || chooseVersion(bytes.length, level);
      return interleave(buildDataCodewords(bytes, version, level), version, level);
    },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.QR = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
