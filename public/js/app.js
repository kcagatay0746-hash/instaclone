// Entry point: auth gate, hash router, realtime session.
import { el, spinner, closeTopModal, bus, toast } from './ui.js';
import { state, connectEvents, refreshSession, logout } from './store.js';
import { renderShell, updateBadges } from './shell.js';
import { authView } from './views/auth.js';

const app = document.getElementById('app');
let cleanup = null;

const ROUTES = [
  { re: /^\/$/, load: () => import('./views/feed.js'), key: 'feedView' },
  { re: /^\/feed$/, load: () => import('./views/feed.js'), key: 'feedView' },
  { re: /^\/explore$/, load: () => import('./views/explore.js'), key: 'exploreView' },
  { re: /^\/search$/, load: () => import('./views/search.js'), key: 'searchView' },
  { re: /^\/create$/, load: () => import('./views/compose.js'), key: 'composeView' },
  { re: /^\/saved$/, load: () => import('./views/saved.js'), key: 'savedView' },
  { re: /^\/p\/(\d+)$/, load: () => import('./views/post.js'), key: 'postView' },
  { re: /^\/u\/([\w.]+)$/, load: () => import('./views/profile.js'), key: 'profileView' },
  { re: /^\/tag\/(.+)$/, load: () => import('./views/tag.js'), key: 'tagView' },
  { re: /^\/notifications$/, load: () => import('./views/notifications.js'), key: 'notificationsView' },
  { re: /^\/messages(?:\/([\w.]+))?$/, load: () => import('./views/messages.js'), key: 'messagesView' },
  { re: /^\/settings$/, load: () => import('./views/settings.js'), key: 'settingsView' },
];

function paintAuth() {
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  app.replaceChildren(authView(onAuthed));
}

function onAuthed() {
  connectEvents();
  paintApp();
}

async function paintApp() {
  app.replaceChildren(renderShell());
  updateBadges();
  await route();
}

async function route() {
  if (!state.me) return paintAuth();
  const path = location.hash.replace(/^#/, '') || '/feed';
  const hit = ROUTES.find((r) => r.re.test(path));
  if (!hit) {
    location.replace('#/feed');
    return;
  }
  const wrap = document.getElementById('page');
  if (!wrap) return paintApp();
  const params = path.match(hit.re).slice(1).map((p) => (p === undefined ? undefined : decodeURIComponent(p)));
  if (cleanup) {
    try { cleanup(); } catch { /* ignore */ }
    cleanup = null;
  }
  wrap.className = 'column';
  wrap.parentElement.classList.remove('wide');
  wrap.replaceChildren(el('div', { class: 'load-more' }, spinner()));
  try {
    const mod = await hit.load();
    const out = await mod[hit.key](...params);
    if (!out) return;
    const node = out instanceof Node ? out : out.node;
    wrap.replaceChildren(node);
    if (out.wide) {
      wrap.classList.add('wide');
      wrap.parentElement.classList.add('wide');
    }
    cleanup = (out && out.cleanup) || null;
  } catch (err) {
    console.error(err);
    if (err.status === 401) {
      state.me = null;
      paintAuth();
      return;
    }
    wrap.replaceChildren(el('div', { class: 'empty' },
      el('h3', { text: 'Bu sayfa yüklenemedi' }),
      el('p', { text: err.message || 'Bilinmeyen bir hata oluştu.' }),
      el('button', { class: 'btn primary', onclick: () => route() }, 'Tekrar dene')));
  }
}

window.addEventListener('hashchange', () => {
  if (!state.me) return;
  closeTopModal();
  route();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && closeTopModal()) e.preventDefault();
});

bus.on('session', (user) => {
  if (user) paintApp();
  else paintAuth();
});

bus.on('reload', () => route());

async function boot() {
  await refreshSession();
  if (state.me) {
    connectEvents();
    await paintApp();
  } else {
    paintAuth();
  }
}

// Keyboard shortcut: "n" opens the composer when not typing.
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, [contenteditable="true"]')) return;
  if (e.key === 'n' && !e.metaKey && !e.ctrlKey && state.me && !document.querySelector('.overlay')) location.hash = '#/create';
});

void toast;
void logout;

// Small debug handle (also used by the UI smoke tests).
window.__insta = { openPost: (id) => import('./components/post-detail.js').then((m) => m.openPost(id)), state };

// Make it installable: register the offline-capable service worker.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline mode is optional */ });
  });
}

boot();
