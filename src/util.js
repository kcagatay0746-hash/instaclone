'use strict';
const crypto = require('node:crypto');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(pw, stored) {
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function sniffImage(buf) {
  if (buf.length > 12 && buf.subarray(0, 8).equals(PNG_SIG)) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buf.length > 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString('latin1'))) return 'gif';
  return null;
}

// Detects mp4 / webm / quicktime containers by their magic bytes.
function sniffVideo(buf) {
  if (buf.length > 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1');
    return brand === 'qt  ' ? 'mov' : 'mp4';
  }
  if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  if (buf.length > 4 && buf.subarray(0, 4).toString('latin1') === 'OggS') return 'ogg';
  return null;
}

const clampStr = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);
const extractTags = (text) =>
  [...new Set([...text.matchAll(/#([\p{L}\p{N}_]{1,50})/gu)].map((m) => m[1].toLowerCase()))].slice(0, 30);
const extractMentions = (text) =>
  [...new Set([...text.matchAll(/@([A-Za-z0-9_.]{1,30})/g)].map((m) => m[1].toLowerCase()))].slice(0, 10);

module.exports = {
  HttpError, sha256, hashPassword, verifyPassword, sniffImage, sniffVideo,
  clampStr, likeEscape, extractTags, extractMentions,
};
