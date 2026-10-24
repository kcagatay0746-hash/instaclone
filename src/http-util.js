'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { HttpError } = require('./util');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

function send(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': data.length, 'Cache-Control': 'no-store', ...SEC_HEADERS });
  res.end(data);
}

function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'İstek çok büyük (en fazla 12MB).'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!size) return resolve({});
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(v && typeof v === 'object' && !Array.isArray(v) ? v : {});
      } catch {
        reject(new HttpError(400, 'Geçersiz JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function serveFile(res, base, rel, extra = {}, req = null, head = false) {
  if (!rel) return false;
  let decoded;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    return false;
  }
  const full = path.normalize(path.join(base, decoded));
  if (full !== base && !full.startsWith(base + path.sep)) return false;
  let st;
  try {
    st = fs.statSync(full);
  } catch {
    return false;
  }
  if (!st.isFile()) return false;
  const type = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream';
  const etag = `W/"${st.size}-${Math.floor(st.mtimeMs)}"`;
  if (req && req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag, ...SEC_HEADERS, ...extra });
    res.end();
    return true;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, ETag: etag, ...SEC_HEADERS, ...extra });
  if (head) {
    res.end();
    return true;
  }
  fs.createReadStream(full).pipe(res);
  return true;
}

module.exports = { MIME, SEC_HEADERS, send, readBody, serveFile };
