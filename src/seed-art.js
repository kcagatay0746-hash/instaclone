'use strict';

const PALETTES = [
  ['#f9ce34', '#ee2a7b', '#6228d7'],
  ['#00c6ff', '#0072ff', '#00e0a1'],
  ['#ff9a9e', '#fad0c4', '#fbc2eb'],
  ['#ff512f', '#dd2476', '#7b1fa2'],
  ['#11998e', '#38ef7d', '#0b6e4f'],
  ['#fc466b', '#3f5efb', '#24243e'],
  ['#f7971e', '#ffd200', '#ff6a00'],
  ['#654ea3', '#eaafc8', '#8e2de2'],
  ['#2b5876', '#4e4376', '#1b1b3a'],
  ['#e96443', '#904e95', '#2c3e50'],
];

// Deterministic pseudo-random generator so demo art is stable across runs.
function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function avatarSvg(name, seed) {
  const r = rng(seed);
  const [a, b] = PALETTES[Math.floor(r() * PALETTES.length)];
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="200" height="200" fill="url(#g)"/>
<circle cx="150" cy="45" r="70" fill="#fff" opacity=".12"/>
<text x="100" y="128" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="82" font-weight="700" fill="#fff" text-anchor="middle" opacity=".95">${initials}</text>
</svg>`;
}

function artSvg(seed, square = true) {
  const r = rng(seed);
  const pal = PALETTES[Math.floor(r() * PALETTES.length)];
  const w = 1080;
  const h = square ? 1080 : 1920;
  let shapes = '';
  for (let i = 0; i < 7; i++) {
    const cx = Math.round(r() * w);
    const cy = Math.round(r() * h);
    const rad = Math.round(80 + r() * 340);
    shapes += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="#fff" opacity="${(0.05 + r() * 0.12).toFixed(2)}"/>`;
  }
  for (let i = 0; i < 4; i++) {
    const y = Math.round(r() * h);
    const amp = Math.round(40 + r() * 120);
    shapes += `<path d="M0 ${y} Q ${w / 4} ${y - amp}, ${w / 2} ${y} T ${w} ${y}" stroke="#fff" stroke-width="${Math.round(2 + r() * 6)}" fill="none" opacity=".18"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal[0]}"/><stop offset=".55" stop-color="${pal[1]}"/><stop offset="1" stop-color="${pal[2]}"/></linearGradient>
<radialGradient id="v" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>${shapes}<rect width="${w}" height="${h}" fill="url(#v)"/></svg>`;
}

module.exports = { PALETTES, rng, avatarSvg, artSvg };
