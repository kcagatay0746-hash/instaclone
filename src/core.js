'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { HttpError, sniffImage, sniffVideo } = require('./util');

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 25 * 1024 * 1024;

// Shared helpers + route registry used by every route module.
function createCore({ db, uploadDir, now }) {
  fs.mkdirSync(uploadDir, { recursive: true });

  const stmts = new Map();
  const q = (sql) => {
    let s = stmts.get(sql);
    if (!s) stmts.set(sql, (s = db.prepare(sql)));
    return s;
  };

  const sse = new Map(); // userId -> Set<res>
  const hits = new Map(); // rate limiter

  function rateLimit(key, max, windowMs) {
    const t = now();
    let h = hits.get(key);
    if (!h || h.reset < t) {
      h = { count: 0, reset: t + windowMs };
      hits.set(key, h);
    }
    if (++h.count > max) throw new HttpError(429, 'Çok fazla deneme. Lütfen biraz bekleyin.');
  }

  function push(userId, event, data) {
    const set = sse.get(userId);
    if (!set) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of set) res.write(payload);
  }

  function saveImage(dataUrl) {
    const m = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
    if (!m) throw new HttpError(400, 'Geçerli bir resim gerekli (png, jpg, webp, gif).');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_IMAGE) throw new HttpError(413, 'Resim çok büyük (en fazla 8MB).');
    const ext = sniffImage(buf);
    if (!ext) throw new HttpError(400, 'Resim dosyası geçersiz.');
    const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, name), buf);
    return name;
  }

  function saveVideo(dataUrl) {
    const m = /^data:video\/(mp4|webm|quicktime|ogg);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
    if (!m) throw new HttpError(400, 'Geçerli bir video gerekli (mp4 veya webm).');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_VIDEO) throw new HttpError(413, 'Video çok büyük (en fazla 25MB).');
    const ext = sniffVideo(buf);
    if (!ext) throw new HttpError(400, 'Video dosyası geçersiz.');
    if (!['mp4', 'webm', 'mov', 'ogg'].includes(ext)) throw new HttpError(400, 'Desteklenmeyen video biçimi.');
    const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, name), buf);
    return name;
  }

  const imgUrl = (f) => (f ? `/uploads/${f}` : null);
  const userCard = (u) => ({ id: u.id, username: u.username, name: u.name, avatar: imgUrl(u.avatar) });
  const rowUser = (r) => ({ id: r.uid, username: r.username, name: r.name, avatar: imgUrl(r.avatar) });

  function userByName(name) {
    const u = q('SELECT * FROM users WHERE username = ?').get(String(name));
    if (!u) throw new HttpError(404, 'Kullanıcı bulunamadı.');
    return u;
  }

  function notify(userId, actorId, type, postId, text) {
    if (userId === actorId) return;
    if (type === 'like' || type === 'follow') {
      const dup = q('SELECT id FROM notifications WHERE user_id=? AND actor_id=? AND type=? AND IFNULL(post_id,0)=IFNULL(?,0)').get(userId, actorId, type, postId ?? null);
      if (dup) return;
    }
    q('INSERT INTO notifications (user_id, actor_id, type, post_id, text, read, created_at) VALUES (?,?,?,?,?,0,?)').run(userId, actorId, type, postId ?? null, text ?? null, now());
    push(userId, 'notification', { type });
  }

  // route registry
  const routes = [];
  const route = (method, pattern, handler, { auth = true } = {}) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$');
    routes.push({ method, re, keys, handler, auth });
  };

  // Simple gradient poster for videos uploaded without a captured frame.
  function savePlaceholder() {
    const pal = [['#f9ce34', '#ee2a7b', '#6228d7'], ['#00c6ff', '#0072ff', '#00e0a1'], ['#ff512f', '#dd2476', '#7b1fa2']][Math.floor(Math.random() * 3)];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${pal[0]}"/><stop offset=".5" stop-color="${pal[1]}"/><stop offset="1" stop-color="${pal[2]}"/>
</linearGradient></defs>
<rect width="1080" height="1080" fill="url(#g)"/>
<circle cx="540" cy="540" r="110" fill="rgba(255,255,255,.22)"/>
<path d="M505 480l120 60-120 60z" fill="#fff"/>
</svg>`;
    const name = `ph-${crypto.randomBytes(8).toString('hex')}.svg`;
    fs.writeFileSync(path.join(uploadDir, name), svg);
    return name;
  }

  return { db, q, now, uploadDir, sse, rateLimit, push, saveImage, saveVideo, savePlaceholder, imgUrl, userCard, rowUser, userByName, notify, routes, route };
}

module.exports = { createCore };
