// Boots the real SPA inside a tiny DOM with a stubbed API for UI smoke tests.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { installDom } from './dom-shim.mjs';

const ROOT = path.resolve('public', 'js');

export const me = { id: 1, username: 'ayse', name: 'Ayşe Yıldız', avatar: null, bio: 'Fotoğraf' };
export const other = { id: 2, username: 'mehmet', name: 'Mehmet Kaya', avatar: null };
const comment = { id: 5, text: 'Harika!', created_at: Date.now(), user: other, mine: false };
export const post = {
  id: 11,
  image: '/uploads/a.svg',
  caption: 'Gün batımı #istanbul',
  location: 'İstanbul',
  created_at: Date.now() - 7200000,
  user: other,
  likes: 12,
  comments: 1,
  liked: false,
  saved: false,
  recent: [comment],
};

export const videoPost = {
  ...post,
  id: 12,
  kind: 'video',
  video: '/uploads/v.mp4',
  image: '/uploads/v.svg',
  caption: 'Dans videosu #reels',
  views: 5,
  likes: 3,
  comments: 0,
  recent: [],
};

const routes = [
  [/^\/api\/me$/, () => ({ user: me, unreadNotifications: 2, unreadMessages: 1 })],
  [/^\/api\/feed/, () => ({ posts: [post], next: null })],
  [/^\/api\/reels/, () => ({ posts: [videoPost, post], next: null })],
  [/^\/api\/posts\/12\/view$/, () => ({ views: 6, counted: true })],
  [/^\/api\/posts\/12$/, () => ({ post: videoPost })],
  [/^\/api\/posts\/12\/comments$/, () => ({ comments: [] })],
  [/^\/api\/stories$/, () => ({
    groups: [{ user: other, stories: [{ id: 3, image: '/uploads/s.svg', created_at: Date.now(), seen: false }], all_seen: false }],
  })],
  [/^\/api\/suggestions$/, () => ({ users: [other] })],
  [/^\/api\/people\/follows-me$/, () => ({ users: [{ ...other, follows_me: true }] })],
  [/^\/api\/explore/, () => ({ posts: [post], next: null })],
  [/^\/api\/saved$/, () => ({ posts: [post] })],
  [/^\/api\/users\/ayse$/, () => ({
    user: { ...me, posts: 1, followers: 3, following: 2, is_following: false, follows_me: false, is_me: true, created_at: Date.now() },
  })],
  [/^\/api\/users\/mehmet$/, () => ({
    user: { ...other, bio: '', posts: 1, followers: 4, following: 1, is_following: false, follows_me: false, is_me: false, created_at: Date.now() },
  })],
  [/^\/api\/users\/[\w.]+\/posts$/, () => ({ posts: [post] })],
  [/^\/api\/users\/[\w.]+\/(followers|following)$/, () => ({ users: [{ ...other, is_following: false, is_me: false }] })],
  [/^\/api\/notifications$/, () => ({
    notifications: [{
      id: 1, type: 'like', post_id: 11, text: null, read: false, created_at: Date.now(), user: other, post_image: '/uploads/a.svg',
    }],
  })],
  [/^\/api\/messages$/, () => ({
    conversations: [{ user: other, last: { text: 'Selam', created_at: Date.now(), mine: false }, unread: 1 }],
  })],
  [/^\/api\/messages\/mehmet$/, () => ({
    user: other,
    messages: [
      { id: 1, text: 'Selam', created_at: Date.now(), mine: false, kind: 'text' },
      { id: 2, text: 'Merhaba!', created_at: Date.now(), mine: true, kind: 'text' },
      { id: 3, text: 'Sesli arama · 0:42', created_at: Date.now(), mine: true, kind: 'call', call_id: 7 },
    ],
  })],
  [/^\/api\/posts\/11$/, () => ({ post })],
  [/^\/api\/posts\/11\/(like|save)$/, (url, opts) => ({
    post: { ...post, liked: opts.method === 'POST', likes: opts.method === 'POST' ? 13 : 12, saved: opts.method === 'POST' },
  })],
  [/^\/api\/posts\/11\/comments$/, (url, opts) => {
    if (opts.method === 'POST') {
      const text = JSON.parse(opts.body).text;
      return { comment: { id: 9, text, created_at: Date.now(), user: me, mine: true } };
    }
    return { comments: [comment] };
  }],
  [/^\/api\/search/, () => ({ users: [other], tags: [{ tag: 'istanbul', posts: 3 }] })],
  [/^\/api\/tags\//, () => ({ tag: 'istanbul', count: 1, posts: [post] })],
  [/^\/api\/notifications\/read$/, () => ({ ok: true })],
  [/^\/api\/stories\/\d+\/view$/, () => ({ ok: true })],
];

function stubFetch(url, opts = {}) {
  const target = new URL(url, 'http://localhost:3000');
  const full = target.pathname + target.search;
  for (const [re, handler] of routes) {
    if (re.test(full)) {
      const data = handler(full, opts);
      return Promise.resolve({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
    }
  }
  return Promise.resolve({ ok: false, status: 404, json: async () => ({ error: 'yok' }), text: async () => '{"error":"yok"}' });
}

export const settle = async (rounds = 14) => {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 6));
};

export async function boot() {
  const storage = new Map();
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    fetch: stubFetch,
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
  });
  const { document, window } = installDom(context);
  for (const id of ['app', 'toasts', 'modal-root', 'overlay-root']) {
    const node = document.createElement('div');
    node.id = id;
    document.body.append(node);
  }
  context.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const cache = new Map();
  const resolveFrom = (referencing, specifier) => path.resolve(path.dirname(referencing.identifier), specifier);

  const ensureLinked = async (mod) => {
    // Node's linker walks (and links) the static graph itself, so cycles are fine.
    if (mod.status === 'unlinked') {
      await mod.link((specifier, referencing) => getModule(resolveFrom(referencing, specifier)));
    }
  };

  const dynImport = async (specifier, referencing) => {
    const mod = getModule(resolveFrom(referencing, specifier));
    await ensureLinked(mod);
    if (mod.status !== 'evaluated') await mod.evaluate();
    await settle(2);
    return mod;
  };

  function getModule(file) {
    if (cache.has(file)) return cache.get(file);
    const mod = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), {
      identifier: file,
      context,
      importModuleDynamically: dynImport,
    });
    cache.set(file, mod);
    return mod;
  }

  const app = getModule(path.join(ROOT, 'app.js'));
  await ensureLinked(app);
  await app.evaluate();
  await settle();
  const go = async (hash) => {
    window.location.hash = hash;
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    await settle();
  };
  return { document, window, go };
}
