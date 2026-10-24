'use strict';
const crypto = require('node:crypto');
const { HttpError, sha256, hashPassword, verifyPassword, clampStr } = require('./util');

const SESSION_TTL_S = 30 * 24 * 60 * 60;

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

module.exports = function authRoutes(core) {
  const { q, now, route, rateLimit, saveImage, userCard, sse } = core;

  const meCard = (u) => ({ ...userCard(u), bio: u.bio });

  function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    q('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)').run(sha256(token), userId, now());
    res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_S}`);
  }

  function authUser(req) {
    const token = parseCookies(req).sid;
    if (!token) return null;
    return q('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.created_at > ?').get(sha256(token), now() - SESSION_TTL_S * 1000) || null;
  }

  route('POST', '/api/register', (ctx) => {
    rateLimit(`reg:${ctx.ip}`, 20, 60 * 60 * 1000);
    const username = clampStr(ctx.body.username, 30);
    const name = clampStr(ctx.body.name, 60);
    const password = typeof ctx.body.password === 'string' ? ctx.body.password : '';
    if (!/^[A-Za-z0-9_.]{3,30}$/.test(username)) throw new HttpError(400, 'Kullanıcı adı 3-30 karakter olmalı (harf, rakam, _ veya .).');
    if (password.length < 6 || password.length > 200) throw new HttpError(400, 'Şifre en az 6 karakter olmalı.');
    if (q('SELECT 1 x FROM users WHERE username = ?').get(username)) throw new HttpError(409, 'Bu kullanıcı adı alınmış.');
    const r = q('INSERT INTO users (username, name, password_hash, created_at) VALUES (?,?,?,?)').run(username, name || username, hashPassword(password), now());
    const user = q('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
    startSession(ctx.res, user.id);
    ctx.status = 201;
    return { user: meCard(user) };
  }, { auth: false });

  route('POST', '/api/login', (ctx) => {
    rateLimit(`login:${ctx.ip}`, 30, 10 * 60 * 1000);
    const username = clampStr(ctx.body.username, 30);
    const password = typeof ctx.body.password === 'string' ? ctx.body.password : '';
    const user = q('SELECT * FROM users WHERE username = ?').get(username);
    let ok = false;
    if (user) ok = verifyPassword(password, user.password_hash);
    else hashPassword(password); // keep timing similar
    if (!ok) throw new HttpError(401, 'Kullanıcı adı veya şifre hatalı.');
    startSession(ctx.res, user.id);
    return { user: meCard(user) };
  }, { auth: false });

  route('POST', '/api/logout', (ctx) => {
    const token = parseCookies(ctx.req).sid;
    if (token) q('DELETE FROM sessions WHERE token = ?').run(sha256(token));
    ctx.res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return { ok: true };
  }, { auth: false });

  route('GET', '/api/me', (ctx) => {
    if (!ctx.user) return { user: null };
    const unreadNotifications = q('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0').get(ctx.user.id).n;
    const unreadMessages = q('SELECT COUNT(*) n FROM messages WHERE to_id=? AND read=0').get(ctx.user.id).n;
    return { user: meCard(ctx.user), unreadNotifications, unreadMessages };
  }, { auth: false });

  route('PATCH', '/api/me', (ctx) => {
    const b = ctx.body;
    const name = b.name !== undefined ? clampStr(b.name, 60) : ctx.user.name;
    const bio = b.bio !== undefined ? clampStr(b.bio, 300) : ctx.user.bio;
    let avatar = ctx.user.avatar;
    if (b.avatar) avatar = saveImage(b.avatar);
    if (b.remove_avatar) avatar = null;
    q('UPDATE users SET name=?, bio=?, avatar=? WHERE id=?').run(name || ctx.user.username, bio, avatar, ctx.user.id);
    return { user: meCard(q('SELECT * FROM users WHERE id=?').get(ctx.user.id)) };
  });

  // Server-sent events: realtime notifications + DMs
  route('GET', '/api/events', (ctx) => {
    const { req, res, user } = ctx;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    if (!sse.has(user.id)) sse.set(user.id, new Set());
    sse.get(user.id).add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    ping.unref();
    req.on('close', () => {
      clearInterval(ping);
      const set = sse.get(user.id);
      if (set) {
        set.delete(res);
        if (!set.size) sse.delete(user.id);
      }
    });
    return undefined;
  });

  return { authUser };
};
