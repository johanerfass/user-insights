import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

// qr.js ships to the browser as a plain script, but it also assigns
// module.exports so it can be required here.
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const QR = require(path.resolve(__dirname, "../../public/qr.js"));

/*
 * The expected matrix below was cross-checked against the `segno` reference
 * encoder: every function pattern (finders, separators, timing, alignment,
 * version info, format info) matches segno exactly, and the symbol decodes
 * back to the original URL with all Reed-Solomon syndromes zero.
 *
 * Note that segno's own pad *codewords* differ from these — segno appends a
 * spurious zero byte when the bit stream already ends on a codeword boundary
 * (`8 - (length % 8)` yields 8 rather than 0). Pad content is ignored by
 * decoders, so both symbols scan; this encoder follows the spec.
 */
const V1_L_MASK0 = [
  "111111100100101111111",
  "100000100111001000001",
  "101110101101101011101",
  "101110100100101011101",
  "101110100010001011101",
  "100000100000001000001",
  "111111101010101111111",
  "000000001100100000000",
  "111011111111011000100",
  "110101001011101110001",
  "100011111001110010111",
  "001001001100100010010",
  "000011110110110101000",
  "000000001011100110011",
  "111111101001100010111",
  "100000101111100110001",
  "101110101011000001010",
  "101110100001101011010",
  "101110101010110010101",
  "100000101110000010010",
  "111111101000000011011",
].join("\n");

function render(matrix) {
  return matrix.map((row) => row.map((dark) => (dark ? "1" : "0")).join("")).join("\n");
}

test("QR.matrix: v1 level L mask 0 matches the verified reference symbol", () => {
  const matrix = QR.matrix("https://voi.com", { level: "L", mask: 0 });
  assert.equal(render(matrix), V1_L_MASK0);
});

test("QR.matrix: picks the smallest version that fits the URL", () => {
  const version = (text, level) => (QR.matrix(text, { level }).length - 17) / 4;
  assert.equal(version("https://voi.com", "L"), 1);
  assert.equal(version("https://www.reddit.com/r/london/comments/abc123/voi/", "L"), 3);
  assert.equal(
    version("https://www.bbc.co.uk/news/articles/c1234567890abcdef-e-scooters-rolled-out", "L"),
    4
  );
  // Level M carries less data, so the same URL needs a larger symbol.
  assert.equal(version("https://voi.com", "M"), 2);
});

test("QR.matrix: is square, with a side of 4 x version + 17", () => {
  for (const level of ["L", "M"]) {
    const matrix = QR.matrix("https://voi.com/malmo", { level });
    assert.ok(matrix.length >= 21);
    assert.equal((matrix.length - 17) % 4, 0);
    for (const row of matrix) assert.equal(row.length, matrix.length);
  }
});

test("QR.matrix: encodes non-ASCII as UTF-8 rather than throwing", () => {
  const matrix = QR.matrix("Malmö zone — å ä ö https://voi.com/malmo", { level: "L" });
  assert.equal((matrix.length - 17) / 4, 3);
});

test("QR.matrix: mask selection is deterministic", () => {
  const first = render(QR.matrix("https://voi.com/oslo", { level: "L" }));
  const second = render(QR.matrix("https://voi.com/oslo", { level: "L" }));
  assert.equal(first, second);
});

test("QR.matrix: throws past the version-15 capacity instead of emitting a broken symbol", () => {
  const tooLong = "https://voi.com/" + "x".repeat(600);
  assert.throws(() => QR.matrix(tooLong, { level: "L" }), /exceeds the version-15/);
});

test("QR.matrix: rejects an unsupported ECC level", () => {
  assert.throws(() => QR.matrix("https://voi.com", { level: "H" }), /unsupported ECC level/);
});

test("QR.svg: emits a self-contained SVG sized for the requested quiet zone", () => {
  const svg = QR.svg("https://voi.com", { level: "L", quiet: 2 });
  // 21 modules + 2 either side.
  assert.match(svg, /viewBox="0 0 25 25"/);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<path d="M/);
  assert.ok(svg.endsWith("</svg>"));
  // No external references — the board is served offline on a TV.
  assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)/);
});

test("QR.svg: honours custom colours", () => {
  const svg = QR.svg("https://voi.com", { dark: "#282425", light: "#ffffff" });
  assert.match(svg, /fill="#282425"/);
  assert.match(svg, /fill="#ffffff"/);
});

test("QR.codewords: data and error-correction codewords fill the symbol exactly", () => {
  // v1 level L holds 26 codewords: 19 data + 7 error correction.
  const codewords = QR.codewords("https://voi.com", { level: "L" });
  assert.equal(codewords.length, 26);
  assert.ok(codewords.every((b) => Number.isInteger(b) && b >= 0 && b <= 255));
  // Byte mode (0100) with a 15-character payload => 0x40, then 0xF6.
  assert.equal(codewords[0], 0x40);
  assert.equal(codewords[1], 0xf6);
});
