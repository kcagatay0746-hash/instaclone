// DOM + UI primitives shared by every view (no framework, no build step).
export function el(tag, props, ...kids) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v; // only used with trusted inline SVG strings
      else if (k === 'data') Object.assign(node.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    }
  }
  append(node, kids);
  return node;
}

export function append(node, kids) {
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false) continue;
    if (Array.isArray(kid)) append(node, kid);
    else node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export const clear = (node) => {
  node.replaceChildren();
  return node;
};

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  heart: '<path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.5 3.2C20.5 15 12 20.5 12 20.5Z"/>',
  comment: '<path d="M21 11.5A8.5 8.5 0 0 1 12.5 20c-1.4 0-2.7-.3-3.9-.9L3 21l1.9-5.1A8.5 8.5 0 1 1 21 11.5Z"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4.5L6 21V3Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  message: '<path d="M21 3 3 10l7 3 3 7 8-17Z"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  camera: '<path d="M3 8h3l1.5-2h9L18 8h3v12H3V8Z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.8"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><circle cx="9" cy="10" r=".8"/><circle cx="15" cy="10" r=".8"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  tag: '<path d="M20 12.5 12.5 20 3 10.5V3h7.5L20 12.5Z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H2.8a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1.3-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.1V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11h.2a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  play: '<path d="M7 4l13 8-13 8V4Z"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  bookmarkFill: '<path d="M6 3h12v18l-6-4.5L6 21V3Z" fill="currentColor"/>',
  heartFill: '<path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.5 3.2C20.5 15 12 20.5 12 20.5Z" fill="currentColor"/>',
  verified: '<path d="m12 2 2.4 1.8 3-.2 1 2.8 2.4 1.8-1 2.8 1 2.9-2.4 1.7-1 2.9-3-.3L12 22l-2.4-1.8-3 .3-1-2.9-2.4-1.7 1-2.9-1-2.8L5.6 8.4l1-2.8 3 .2L12 2Z" fill="currentColor"/><path d="m8 12 2.5 2.5L16 9" stroke="#fff" stroke-width="1.8" fill="none"/>',
};

export function icon(name, size = 24, cls = '') {
  return el('span', {
    class: `ic ${cls}`,
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`,
  });
}

let gradientId = 0;
export function avatar(user, size = 40, { ring = false, onClick } = {}) {
  const cls = `avatar${ring ? ' ring' : ''}`;
  const style = { width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(11, size * 0.38)}px` };
  if (user && user.avatar) {
    return el('span', { class: cls, style, onclick: onClick }, el('img', { src: user.avatar, alt: user.username, loading: 'lazy', draggable: 'false' }));
  }
  return el('span', { class: `${cls} fallback g${(gradientId++ % 6) + 1}`, style, onclick: onClick },
    (user && (user.username || '?')[0] || '?').toUpperCase());
}

export function button(label, { variant = 'primary', size = '', onClick, type = 'button', iconName, disabled } = {}) {
  return el('button', { class: `btn ${variant} ${size}`.trim(), type, onclick: onClick, disabled: !!disabled },
    iconName ? icon(iconName, 18) : null, label);
}

const nf = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 });
export const fmt = {
  count(n) {
    const v = Number(n) || 0;
    return v < 10000 ? String(v) : nf.format(v).replace('\u00a0', '');
  },
  time(ts) {
    const diff = Math.max(0, Date.now() - Number(ts));
    const m = Math.round(diff / 60000);
    if (m < 1) return 'şimdi';
    if (m < 60) return `${m} dk`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} sa`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d} g`;
    const w = Math.round(d / 7);
    if (w < 5) return `${w} hf`;
    return new Date(Number(ts)).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  },
  date(ts) {
    return new Date(Number(ts)).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  },
};

// Turns captions/messages into safe text + hashtag/mention/link anchors.
export function linkify(text) {
  const frag = document.createDocumentFragment();
  const re = /(#[\p{L}\p{N}_]{1,50})|(@[A-Za-z0-9_.]{1,30})|(https?:\/\/[^\s]+)/gu;
  const src = String(text || '');
  let last = 0;
  for (const m of src.matchAll(re)) {
    if (m.index > last) frag.append(document.createTextNode(src.slice(last, m.index)));
    const token = m[0];
    if (token.startsWith('#')) {
      frag.append(el('a', { href: `#/tag/${encodeURIComponent(token.slice(1).toLowerCase())}`, class: 'tag-link' }, token));
    } else if (token.startsWith('@')) {
      frag.append(el('a', { href: `#/u/${token.slice(1)}`, class: 'tag-link' }, token));
    } else {
      frag.append(el('a', { href: token, target: '_blank', rel: 'noopener noreferrer nofollow' },
        token.length > 42 ? `${token.slice(0, 40)}…` : token));
    }
    last = m.index + token.length;
  }
  if (last < src.length) frag.append(document.createTextNode(src.slice(last)));
  return frag;
}

export function toast(message, type = '') {
  const root = document.getElementById('toasts');
  const t = el('div', { class: `toast ${type}` }, icon(type === 'error' ? 'close' : 'check', 18), el('span', { text: message }));
  root.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 250);
  }, type === 'error' ? 4200 : 2600);
  return t;
}

export function spinner(cls = '') {
  return el('div', { class: `spinner ${cls}`.trim() });
}

export function skeletonPost() {
  return el('div', { class: 'card skeleton-post' },
    el('div', { class: 'sk-row' }, el('div', { class: 'sk sk-av' }), el('div', { class: 'sk sk-line', style: { width: '38%' } })),
    el('div', { class: 'sk sk-img' }),
    el('div', { class: 'sk sk-line', style: { width: '70%', margin: '14px' } }),
    el('div', { class: 'sk sk-line', style: { width: '45%', margin: '0 14px 16px' } }));
}

export function emptyState(iconName, title, text, action) {
  return el('div', { class: 'empty' },
    el('div', { class: 'empty-ic' }, icon(iconName, 42)),
    el('h3', { text: title }),
    text ? el('p', { text }) : null,
    action || null);
}

// ----- modal -----
const modalStack = [];
export function modal({ title, body, size = 'md', onClose, headerExtra, bare = false }) {
  const root = document.getElementById('modal-root');
  const dialog = el('div', { class: `dialog ${size}${bare ? ' bare' : ''}`, role: 'dialog', 'aria-modal': 'true' });
  const closeBtn = el('button', { class: 'icon-btn dialog-close', 'aria-label': 'Kapat', onclick: () => close() }, icon('close', 22));
  if (title || headerExtra) {
    dialog.append(el('div', { class: 'dialog-head' }, title ? el('h3', { text: title }) : el('span'), headerExtra || null, closeBtn));
  }
  const bodyEl = el('div', { class: 'dialog-body' }, body || null);
  dialog.append(bodyEl);
  const overlay = el('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) close(); } }, dialog);
  root.append(overlay);
  document.body.classList.add('modal-open');
  const prevFocus = document.activeElement;

  function close() {
    const i = modalStack.indexOf(close);
    if (i === -1) return;
    modalStack.splice(i, 1);
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 160);
    if (!modalStack.length) document.body.classList.remove('modal-open');
    if (prevFocus && prevFocus.focus) prevFocus.focus();
    if (onClose) onClose();
  }
  modalStack.push(close);
  requestAnimationFrame(() => overlay.classList.add('open'));
  const first = dialog.querySelector('input, textarea, button.primary');
  if (first) setTimeout(() => first.focus(), 60);
  return { close, dialog, body: bodyEl, overlay };
}

export function closeTopModal() {
  const fn = modalStack[modalStack.length - 1];
  if (fn) fn();
  return !!fn;
}

export function confirmDialog(message, { title = 'Emin misin?', confirmLabel = 'Sil', danger = true } = {}) {
  return new Promise((resolve) => {
    let decided = false;
    const m = modal({
      title,
      size: 'sm',
      body: el('div', { class: 'confirm-body' }, el('p', { text: message })),
      onClose: () => { if (!decided) resolve(false); },
    });
    m.dialog.append(el('div', { class: 'dialog-foot' },
      el('button', { class: 'btn ghost', onclick: () => { decided = true; resolve(false); m.close(); } }, 'Vazgeç'),
      el('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => { decided = true; resolve(true); m.close(); } }, confirmLabel)));
  });
}

export function navigate(path) {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Minimal event bus so views can notify the shell (badges, counters).
const listeners = new Map();
export const bus = {
  on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set());
    listeners.get(evt).add(fn);
    return () => listeners.get(evt).delete(fn);
  },
  emit(evt, data) {
    (listeners.get(evt) || []).forEach((fn) => fn(data));
  },
};

export function onImgError(img, fallbackText = 'Resim yüklenemedi') {
  img.addEventListener('error', () => {
    img.replaceWith(el('div', { class: 'img-fallback', text: fallbackText }));
  }, { once: true });
}

// ----- image pipeline (drag&drop upload -> crop/filter -> JPEG data URL) -----
const FILTERS = {
  normal: 'none',
  clarendon: 'contrast(1.15) saturate(1.25)',
  gingham: 'brightness(1.05) hue-rotate(-8deg) contrast(.95)',
  moon: 'grayscale(1) contrast(1.1) brightness(1.05)',
  lark: 'brightness(1.05) contrast(.9) saturate(1.1)',
  juno: 'saturate(1.3) contrast(1.05)',
  reyes: 'sepia(.35) brightness(1.1) contrast(.9)',
  valencia: 'sepia(.2) saturate(1.5) brightness(1.05)',
  warm: 'saturate(1.1) sepia(.25)',
  cool: 'hue-rotate(180deg) saturate(1.1)',
};
export const FILTER_NAMES = Object.keys(FILTERS);
export const cssFilter = (name) => FILTERS[name] || 'none';

export async function loadImageFile(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Lütfen bir resim dosyası seçin.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Resim 20MB’dan büyük olamaz.');
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return img; // the blob URL stays alive for the editor preview
}

export function renderToDataUrl(img, { filter = 'normal', aspect = 1, zoom = 1, maxSize = 1080 } = {}) {
  const width = aspect >= 1 ? maxSize : Math.round(maxSize * aspect);
  const height = aspect >= 1 ? Math.round(maxSize / aspect) : maxSize;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  if ('filter' in ctx) ctx.filter = cssFilter(filter);
  const scale = Math.max(width / img.width, height / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
  return canvas.toDataURL('image/jpeg', 0.9);
}

