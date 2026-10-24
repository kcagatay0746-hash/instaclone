// Global session state + theme + realtime (SSE) wiring.
import { API } from './api.js';
import { bus, toast } from './ui.js';

export const state = {
  me: null,
  unreadNotifications: 0,
  unreadMessages: 0,
  theme: localStorage.getItem('theme') || 'dark',
};

export function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', state.theme === 'dark' ? '#000000' : '#ffffff');
}

export function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', state.theme);
  applyTheme();
  bus.emit('theme', state.theme);
}

applyTheme();

export async function refreshSession() {
  try {
    const res = await API.me();
    state.me = res.user;
    state.unreadNotifications = res.unreadNotifications || 0;
    state.unreadMessages = res.unreadMessages || 0;
  } catch {
    state.me = null;
  }
  return state.me;
}

export async function logout() {
  try {
    await API.logout();
  } catch { /* ignore */ }
  state.me = null;
  disconnectEvents();
  bus.emit('session', null);
}

let events = null;

export function connectEvents() {
  if (!state.me || events) return;
  events = new EventSource('/api/events');
  events.addEventListener('notification', (e) => {
    let data = {};
    try { data = JSON.parse(e.data); } catch { /* ignore */ }
    state.unreadNotifications += 1;
    bus.emit('counts', state);
    const labels = { like: 'gönderini beğendi', comment: 'gönderine yorum yaptı', follow: 'seni takip etmeye başladı', mention: 'senden bahsetti' };
    if (location.hash.includes('/notifications')) bus.emit('notifications:refresh');
    else toast(`Yeni bildirim: ${labels[data.type] || 'etkinlik'}`);
  });
  events.addEventListener('message', (e) => {
    let data = {};
    try { data = JSON.parse(e.data); } catch { /* ignore */ }
    state.unreadMessages += 1;
    bus.emit('counts', state);
    bus.emit('dm:incoming', data);
    if (!location.hash.includes('/messages') && !location.hash.includes('/u/')) toast(`${data.fromName || data.from}: ${data.message ? data.message.text : 'yeni mesaj'}`);
  });
  events.onerror = () => { /* browser auto-reconnects */ };
}

export function disconnectEvents() {
  if (events) {
    events.close();
    events = null;
  }
}

export async function reloadCounts() {
  if (!state.me) return;
  try {
    const res = await API.me();
    state.unreadNotifications = res.unreadNotifications || 0;
    state.unreadMessages = res.unreadMessages || 0;
    bus.emit('counts', state);
  } catch { /* ignore */ }
}
