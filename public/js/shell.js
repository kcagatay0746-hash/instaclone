// Sidebar / top bar / bottom nav chrome shared by every route.
import { el, icon, avatar, navigate, bus } from './ui.js';
import { state, toggleTheme, logout } from './store.js';

const NAV = [
  { path: '/feed', label: 'Ana Sayfa', icon: 'home' },
  { path: '/explore', label: 'Keşfet', icon: 'compass' },
  { path: '/messages', label: 'Mesajlar', icon: 'message', badge: 'messages' },
  { path: '/notifications', label: 'Bildirimler', icon: 'bell', badge: 'notifications' },
  { path: '/create', label: 'Oluştur', icon: 'plus' },
];

function countBadge(kind) {
  const n = kind === 'messages' ? state.unreadMessages : state.unreadNotifications;
  if (!n) return null;
  return el('span', { class: 'badge', text: n > 9 ? '9+' : String(n) });
}

export function updateBadges() {
  document.querySelectorAll('[data-badge]').forEach((node) => {
    node.querySelectorAll(':scope > .badge').forEach((b) => b.remove());
    const b = countBadge(node.dataset.badge);
    if (b) node.append(b);
  });
}

export function renderShell() {
  const me = state.me;
  const path = location.hash.replace(/^#/, '') || '/feed';
  const isActive = (p) => (path === '/' || path === '/feed' ? p === '/feed' : path.startsWith(p));

  const sidebar = el('aside', { class: 'sidebar' },
    el('a', { class: 'brand', href: '#/feed' },
      el('img', { src: '/img/logo.svg', alt: 'Instaclone' }),
      el('div', { class: 'wordmark' }, 'Insta', el('span', {}, 'clone'))),
    el('nav', { class: 'side-nav' },
      NAV.map((item) => el('a', {
        class: `side-link${isActive(item.path) ? ' active' : ''}`,
        href: `#${item.path}`,
        'aria-label': item.label,
        'data-badge': item.badge || null,
      }, icon(item.icon, 24), el('span', { class: 'label', text: item.label }))),
      el('a', { class: `side-link${path.startsWith('/search') ? ' active' : ''}`, href: '#/search' },
        icon('search', 24), el('span', { class: 'label', text: 'Ara' })),
      el('a', { class: `side-link${path === `/u/${me.username}` ? ' active' : ''}`, href: `#/u/${me.username}` },
        el('span', { class: 'label', text: 'Profil' }), avatar(me, 26))),
    el('div', { class: 'side-foot' },
      el('button', { class: 'side-link', onclick: toggleTheme },
        icon(state.theme === 'dark' ? 'sun' : 'moon', 24),
        el('span', { class: 'label', text: state.theme === 'dark' ? 'Açık tema' : 'Koyu tema' })),
      el('div', { class: 'side-user', onclick: () => navigate('/settings') },
        avatar(me, 32),
        el('div', { class: 'who' }, el('b', { text: me.username }), el('span', { text: me.name })),
        el('button', {
          class: 'icon-btn', 'aria-label': 'Çıkış yap', title: 'Çıkış yap',
          onclick: (e) => { e.stopPropagation(); logout(); },
        }, icon('logout', 20)))));

  const topbar = el('header', { class: 'topbar' },
    el('a', { class: 'brand', href: '#/feed' },
      el('img', { src: '/img/logo.svg', alt: '' }),
      el('div', { class: 'wordmark' }, 'Insta', el('span', {}, 'clone'))),
    el('div', { class: 'topbar-actions' },
      el('a', { class: 'icon-btn', href: '#/notifications', 'aria-label': 'Bildirimler', 'data-badge': 'notifications' }, icon('bell', 24)),
      el('a', { class: 'icon-btn', href: '#/messages', 'aria-label': 'Mesajlar', 'data-badge': 'messages' }, icon('message', 24))));

  const bottom = el('nav', { class: 'bottom-nav' },
    [
      { path: '/feed', iconName: 'home', label: 'Ana Sayfa' },
      { path: '/explore', iconName: 'compass', label: 'Keşfet' },
      { path: '/create', iconName: 'plus', label: 'Oluştur' },
      { path: '/notifications', iconName: 'bell', label: 'Bildirimler', badge: 'notifications' },
      { path: `/u/${me.username}`, iconName: 'user', label: 'Profil', profile: true },
    ].map((item) => el('a', {
      class: `nav-item${isActive(item.path) ? ' active' : ''}`,
      href: `#${item.path}`,
      'data-badge': item.badge || null,
    }, item.profile ? avatar(me, 24) : icon(item.iconName, 24), el('span', { text: item.label }))));

  const main = el('main', { class: 'main' }, el('div', { class: 'page' }, el('div', { class: 'column', id: 'page' })));
  return el('div', { class: 'app-shell' }, sidebar, topbar, main, bottom);
}

export function remountShell() {
  const app = document.getElementById('app');
  app.replaceChildren(renderShell());
}

bus.on('counts', updateBadges);
bus.on('theme', () => {
  remountShell();
  updateBadges();
  // re-run the current route inside the fresh shell
  window.dispatchEvent(new HashChangeEvent('hashchange'));
});
