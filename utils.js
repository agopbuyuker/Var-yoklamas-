'use strict';

const crypto = require('crypto');

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) return;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  });
  return out;
}

function serializeCookie(name, value, options = {}) {
  let str = `${name}=${encodeURIComponent(value)}`;
  if (options.maxAge !== undefined) str += `; Max-Age=${Math.floor(options.maxAge)}`;
  str += `; Path=${options.path || '/'}`;
  if (options.httpOnly !== false) str += '; HttpOnly';
  str += `; SameSite=${options.sameSite || 'Lax'}`;
  if (options.secure) str += '; Secure';
  if (options.expires) str += `; Expires=${options.expires.toUTCString()}`;
  return str;
}

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hashIp(ip, secret) {
  return crypto.createHash('sha256').update(`${ip}:${secret}`).digest('hex').slice(0, 32);
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // still do a comparison to keep timing roughly constant, but result is false
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function slugSafeFilename(originalName) {
  const ext = (originalName.match(/\.[a-zA-Z0-9]+$/) || [''])[0].toLowerCase();
  const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '';
  return `${crypto.randomBytes(16).toString('hex')}${safeExt}`;
}

module.exports = {
  parseCookies,
  serializeCookie,
  esc,
  hashIp,
  timingSafeEqualStr,
  getClientIp,
  slugSafeFilename,
};
