'use strict';
// Generates the app icons as PNG files with zero dependencies (zlib + CRC32).
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT = path.join(__dirname, '..', 'public', 'img');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

// distance (as 0..1 coverage) helper for rounded rectangle + circle outline
function roundedRect(x, y, cx, cy, half, radius) {
  const dx = Math.abs(x - cx) - (half - radius);
  const dy = Math.abs(y - cy) - (half - radius);
  const d = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius;
  return -d; // positive inside
}

function drawIcon(size, { maskable = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const pad = maskable ? size * 0.14 : size * 0.06;
  const half = size / 2 - pad; // background square half size
  const radius = size * (maskable ? 0.24 : 0.22);
  const ringHalf = half * 0.56;
  const ringR = size * 0.058;
  const lensR = half * 0.3;
  const dotR = size * 0.034;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // Instagram-ish diagonal gradient
      const t = clamp01((u + v) / 2);
      let r = lerp(249, 98, t);
      let g = lerp(206, 40, t);
      let b = lerp(52, 215, t);
      if (t > 0.55) {
        const k = (t - 0.55) / 0.45;
        r = lerp(238, 98, k);
        g = lerp(42, 40, k);
        b = lerp(123, 215, k);
      }
      let alpha = 0;
      const bg = roundedRect(x, y, c, c, half, radius);
      alpha = smooth(-1.5, 1.5, bg);
      // soft highlight
      const glow = Math.max(0, 1 - Math.hypot(x - size * 0.3, y - size * 0.25) / (size * 0.5));
      r = Math.min(255, r + glow * 26);
      g = Math.min(255, g + glow * 26);
      b = Math.min(255, b + glow * 18);

      // white camera outline
      let white = 0;
      const outer = roundedRect(x, y, c, c, ringHalf + ringR, ringHalf * 0.34 + ringR);
      const inner = roundedRect(x, y, c, c, ringHalf - ringR, ringHalf * 0.34 - ringR);
      white = Math.max(white, clamp01((outer + 1.2) / 2.4) * (1 - clamp01((inner + 1.2) / 2.4)));
      // lens
      const lensD = Math.hypot(x - c, y - c);
      const lensOuter = smooth(lensR + 1.4, lensR - 1.4, lensD);
      const lensInner = smooth(lensR - ringR + 1.4, lensR - ringR - 1.4, lensD);
      white = Math.max(white, lensOuter * (1 - lensInner));
      // top-right dot
      const dotD = Math.hypot(x - (c + ringHalf * 0.52), y - (c - ringHalf * 0.52));
      white = Math.max(white, smooth(dotR + 1.2, dotR - 1.2, dotD));

      r = lerp(r, 255, white);
      g = lerp(g, 255, white);
      b = lerp(b, 255, white);
      if (maskable) alpha = 1;

      const i = (y * size + x) * 4;
      pixels[i] = Math.round(r);
      pixels[i + 1] = Math.round(g);
      pixels[i + 2] = Math.round(b);
      pixels[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, size, pixels);
}

fs.mkdirSync(OUT, { recursive: true });
const jobs = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['icon-180.png', 180, {}],
  ['icon-32.png', 32, {}],
];
for (const [name, size, opts] of jobs) {
  fs.writeFileSync(path.join(OUT, name), drawIcon(size, opts));
  console.log('yazıldı:', name, `${size}x${size}`);
}
