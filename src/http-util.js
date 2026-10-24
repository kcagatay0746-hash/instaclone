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
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogg': 'video/ogg',
};

const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  // calls need the camera/mic; everything else stays locked down
  'Permissions-Policy': 'geolocation=(), camera=(self), microphone=(self)',
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

  // Byte-range support so <video> can seek/stream properly.
  const range = req && req.headers.range;
  if (range && /^bytes=\d*-\d*$/.test(range)) {
    const [startRaw, endRaw] = range.replace('bytes=', '').split('-');
    let start = startRaw ? Number(startRaw) : 0;
    let end = endRaw ? Number(endRaw) : st.size - 1;
    if (!startRaw && endRaw) {
      start = Math.max(0, st.size - Number(endRaw));
      end = st.size - 1;
    }
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= st.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${st.size}`, ...SEC_HEADERS });
      res.end();
      return true;
    }
    end = Math.min(end, st.size - 1);
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${st.size}`,
      'Accept-Ranges': 'bytes',
      ETag: etag,
      ...SEC_HEADERS,
      ...extra,
    });
    if (head) {
      res.end();
      return true;
    }
    fs.createReadStream(full, { start, end }).pipe(res);
    return true;
  }

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': st.size,
    'Accept-Ranges': 'bytes',
    ETag: etag,
    ...SEC_HEADERS,
    ...extra,
  });
  if (head) {
    res.end();
    return true;
  }
  fs.createReadStream(full).pipe(res);
  return true;
}

module.exports = { MIME, SEC_HEADERS, send, readBody, serveFile };
