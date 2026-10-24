'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { openDb } = require('./src/db');
const { createCore } = require('./src/core');
const { HttpError } = require('./src/util');
const { SEC_HEADERS, send, readBody, serveFile } = require('./src/http-util');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = openDb(process.env.DB_PATH || path.join(DATA_DIR, 'app.db'));
const core = createCore({ db, uploadDir: UPLOAD_DIR, now: Date.now });

const PAGE_CSP = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const OFF_CSP = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";

const { authUser } = require('./src/routes-auth')(core);
require('./src/routes-feed')(core);
require('./src/routes-posts')(core);
require('./src/routes-comments')(core);
require('./src/routes-users')(core);
require('./src/routes-stories')(core);
require('./src/routes-notifications')(core);
require('./src/routes-messages')(core);
require('./src/routes-calls')(core);
const { routes } = core;

// Video uploads are big; photos/SDP payloads stay small.
const BIG_BODY = 40 * 1024 * 1024;
const BIG_ROUTES = new Set(['/api/posts', '/api/stories']);

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const ip = req.socket.remoteAddress || 'unknown';
  for (const [k, v] of Object.entries(SEC_HEADERS)) res.setHeader(k, v);
  try {
    if (url.pathname.startsWith('/api/')) {
      const method = req.method;
      const mutating = method !== 'GET' && method !== 'HEAD';
      if (mutating) {
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
          throw new HttpError(415, 'Content-Type: application/json olmalı.');
        }
        const origin = req.headers.origin;
        if (origin) {
          let host = null;
          try { host = new URL(origin).host; } catch { host = null; }
          if (host !== req.headers.host) throw new HttpError(403, 'Geçersiz kaynak.');
        }
      }
      let matched = null;
      let pathMatched = false;
      for (const r of routes) {
        const m = r.re.exec(url.pathname);
        if (!m) continue;
        pathMatched = true;
        if (r.method === method) {
          matched = { r, m };
          break;
        }
      }
      if (!matched) throw new HttpError(pathMatched ? 405 : 404, pathMatched ? 'Yöntem desteklenmiyor.' : 'Bulunamadı.');
      const user = authUser(req);
      if (matched.r.auth && !user) throw new HttpError(401, 'Giriş yapmalısınız.');
      const params = {};
      matched.r.keys.forEach((k, i) => { params[k] = matched.m[i + 1]; });
      if (params.id !== undefined && !/^\d+$/.test(params.id)) throw new HttpError(400, 'Geçersiz kimlik.');
      const body = mutating ? await readBody(req, BIG_ROUTES.has(url.pathname) ? BIG_BODY : 12 * 1024 * 1024) : {};
      const ctx = { req, res, ip, user, params, query: url.searchParams, body, status: 200 };
      const result = matched.r.handler(ctx);
      if (result === undefined) return; // streaming response (SSE)
      return send(res, ctx.status, result);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Yöntem desteklenmiyor.');
    const head = req.method === 'HEAD';

    if (url.pathname.startsWith('/uploads/')) {
      const ok = serveFile(res, UPLOAD_DIR, url.pathname.slice('/uploads/'.length),
        { 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Security-Policy': OFF_CSP }, req, head);
      if (!ok) throw new HttpError(404, 'Bulunamadı.');
      return;
    }

    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const pageHeaders = { 'Cache-Control': 'no-cache', 'Content-Security-Policy': PAGE_CSP };
    if (serveFile(res, PUBLIC_DIR, rel, pageHeaders, req, head)) return;
    if (!path.extname(rel) && serveFile(res, PUBLIC_DIR, 'index.html', pageHeaders, req, head)) return;
    throw new HttpError(404, 'Bulunamadı.');
  } catch (err) {
    if (res.headersSent) {
      res.end();
      return;
    }
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error(err);
    return send(res, 500, { error: 'Sunucu hatası.' });
  }
}

if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0 && process.env.SEED !== '0') {
  require('./src/seed')({ db, uploadDir: UPLOAD_DIR, now: Date.now });
}

const server = http.createServer(handle);
const realClose = server.close.bind(server);
server.close = (cb) => {
  for (const set of core.sse.values()) for (const res of set) res.end();
  core.sse.clear();
  server.closeAllConnections?.();
  return realClose(cb);
};

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`\n  Instaclone hazır → http://localhost:${PORT}`);
    console.log('  Demo hesaplar: ayse / mehmet / zeynep / can / elif / deniz  (şifre: demo1234)\n');
  });
}

module.exports = { server, handle, db, UPLOAD_DIR, PUBLIC_DIR };
