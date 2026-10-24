/* Service worker: installable app + offline shell (no dependencies). */
const VERSION = 'instaclone-v2';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/img/logo.svg',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/icon-180.png',
  '/css/base.css',
  '/css/buttons.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/forms.css',
  '/css/views.css',
  '/css/views2.css',
  '/css/views3.css',
  '/css/views4.css',
  '/css/reels.css',
  '/css/calls.css',
  '/js/app.js',
  '/js/ui.js',
  '/js/api.js',
  '/js/store.js',
  '/js/shell.js',
  '/js/components/media.js',
  '/js/components/call.js',
  '/js/views/reels.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // addAll fails as a whole if a single file 404s; add them one by one instead.
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App shell navigations: network first, cached shell as offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('/index.html', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(VERSION);
        return (await cache.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  // API GETs: network first, last cached response offline.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh.ok) {
          const cache = await caches.open(VERSION);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cache = await caches.open(VERSION);
        return (await cache.match(req)) || new Response(JSON.stringify({ error: 'Çevrimdışısın.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    })());
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    const network = fetch(req)
      .then((res) => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
