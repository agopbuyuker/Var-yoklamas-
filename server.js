'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Load .env if present, without any external dependency.
loadEnvFile(path.join(__dirname, '.env'));

const db = require('./lib/db');
const auth = require('./lib/auth');
const render = require('./lib/render');
const { parseCookies, serializeCookie, hashIp, getClientIp, slugSafeFilename } = require('./lib/utils');

const PORT = Number(process.env.PORT || 3000);
const TRUST_HTTPS = String(process.env.TRUST_HTTPS || 'false') === 'true';
const IP_SALT = process.env.SESSION_SECRET || 'dev-only-insecure-salt-change-me';
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const VOTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 yil

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function sendHtml(res, status, html, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...extraHeaders });
  res.end(html);
}

function sendJson(res, status, obj, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders });
  res.end(JSON.stringify(obj));
}

function notFound(res) {
  sendHtml(res, 404, render.layout({ title: 'Bulunamadı', body: '<div class="empty-state"><h1>404</h1><p>Aradığın sayfa bulunamadı.</p></div>' }));
}

function redirect(res, location, cookies = []) {
  const headers = { Location: location };
  if (cookies.length) headers['Set-Cookie'] = cookies;
  res.writeHead(302, headers);
  res.end();
}

async function readRequestAsWebRequest(req, urlObj) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_UPLOAD_BYTES) {
      const err = new Error('PAYLOAD_TOO_LARGE');
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }
    chunks.push(chunk);
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) headers.set(key, value.join(', '));
    else headers.set(key, value);
  }
  return new Request(urlObj.toString(), {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  });
}

function getOrSetVoterId(req, res, cookies, setCookies) {
  let voterId = cookies.voter_id;
  if (!voterId) {
    voterId = require('crypto').randomUUID();
    setCookies.push(
      serializeCookie('voter_id', voterId, {
        maxAge: VOTER_COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: 'Lax',
        secure: TRUST_HTTPS,
      })
    );
  }
  return voterId;
}

function requireAdmin(cookies) {
  return auth.isValidSession(cookies.admin_session);
}

async function saveUploadedImage(fileField) {
  if (!fileField || typeof fileField === 'string') return null;
  if (!fileField.size) return null;
  if (fileField.size > MAX_UPLOAD_BYTES) {
    const err = new Error('IMAGE_TOO_LARGE');
    err.code = 'IMAGE_TOO_LARGE';
    throw err;
  }
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (fileField.type && !allowed.includes(fileField.type)) {
    const err = new Error('INVALID_IMAGE_TYPE');
    err.code = 'INVALID_IMAGE_TYPE';
    throw err;
  }
  const filename = slugSafeFilename(fileField.name || 'upload.jpg');
  const buf = Buffer.from(await fileField.arrayBuffer());
  fs.writeFileSync(path.join(db.UPLOADS_DIR, filename), buf);
  return filename;
}

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      notFound(res);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.css' || ext === '.js' ? 'public, max-age=300' : 'public, max-age=31536000, immutable',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(urlObj.pathname);
    const cookies = parseCookies(req.headers.cookie);
    const setCookies = [];

    // ---- Static assets ----
    if (req.method === 'GET' && pathname === '/style.css') {
      return serveStaticFile(res, path.join(__dirname, 'public', 'style.css'));
    }
    if (req.method === 'GET' && pathname === '/app.js') {
      return serveStaticFile(res, path.join(__dirname, 'public', 'app.js'));
    }
    if (req.method === 'GET' && pathname.startsWith('/uploads/')) {
      const filename = path.basename(pathname);
      return serveStaticFile(res, path.join(db.UPLOADS_DIR, filename));
    }

    // ---- Public site ----
    if (req.method === 'GET' && pathname === '/') {
      const voterId = getOrSetVoterId(req, res, cookies, setCookies);
      const positions = db.listPositionsWithResults(voterId);
      const html = render.renderHome(positions);
      return sendHtml(res, 200, html, setCookies.length ? { 'Set-Cookie': setCookies } : {});
    }

    if (req.method === 'POST' && pathname === '/vote') {
      const voterId = getOrSetVoterId(req, res, cookies, setCookies);
      let webReq;
      try {
        webReq = await readRequestAsWebRequest(req, urlObj);
      } catch (e) {
        return sendJson(res, 413, { message: 'Gönderilen veri çok büyük.' });
      }
      const fd = await webReq.formData();
      const positionId = Number(fd.get('position_id'));
      const choice = fd.get('choice');
      if (!Number.isInteger(positionId) || !['dogru', 'yanlis'].includes(choice)) {
        return sendJson(res, 400, { message: 'Geçersiz oy verisi.' }, setCookies.length ? { 'Set-Cookie': setCookies } : {});
      }
      const position = db.getPosition(positionId);
      if (!position) {
        return sendJson(res, 404, { message: 'Pozisyon bulunamadı.' }, setCookies.length ? { 'Set-Cookie': setCookies } : {});
      }
      try {
        db.castVote({ positionId, voterId, ipHash: hashIp(getClientIp(req), IP_SALT), choice });
      } catch (e) {
        if (e.code === 'ALREADY_VOTED') {
          const counts = db.getVoteCounts(positionId);
          return sendJson(
            res,
            409,
            { message: 'Bu pozisyon için zaten oy kullandın.', counts: withPct(counts) },
            setCookies.length ? { 'Set-Cookie': setCookies } : {}
          );
        }
        throw e;
      }
      const counts = db.getVoteCounts(positionId);
      return sendJson(res, 200, { ok: true, counts: withPct(counts) }, setCookies.length ? { 'Set-Cookie': setCookies } : {});
    }

    // ---- Admin auth ----
    if (req.method === 'GET' && pathname === '/admin/login') {
      if (requireAdmin(cookies)) return redirect(res, '/admin');
      return sendHtml(res, 200, render.renderAdminLogin());
    }

    if (req.method === 'POST' && pathname === '/admin/login') {
      const webReq = await readRequestAsWebRequest(req, urlObj);
      const fd = await webReq.formData();
      const password = fd.get('password');
      if (!auth.checkAdminPassword(password)) {
        return sendHtml(res, 401, render.renderAdminLogin('Şifre hatalı. Tekrar dene.'));
      }
      const sessionId = auth.createSession();
      const cookie = serializeCookie('admin_session', sessionId, {
        maxAge: 60 * 60 * 24 * 7,
        httpOnly: true,
        sameSite: 'Lax',
        secure: TRUST_HTTPS,
      });
      return redirect(res, '/admin', [cookie]);
    }

    if (req.method === 'POST' && pathname === '/admin/logout') {
      if (cookies.admin_session) auth.destroySession(cookies.admin_session);
      const cookie = serializeCookie('admin_session', '', { maxAge: 0, httpOnly: true, sameSite: 'Lax', secure: TRUST_HTTPS });
      return redirect(res, '/admin/login', [cookie]);
    }

    // ---- Admin: everything below requires a valid session ----
    if (pathname.startsWith('/admin')) {
      if (!requireAdmin(cookies)) return redirect(res, '/admin/login');

      if (req.method === 'GET' && pathname === '/admin') {
        const positions = db.listPositions().map((p) => ({ ...p, counts: db.getVoteCounts(p.id) }));
        return sendHtml(res, 200, render.renderAdminDashboard({ positions }));
      }

      if (req.method === 'POST' && pathname === '/admin/positions') {
        let webReq;
        try {
          webReq = await readRequestAsWebRequest(req, urlObj);
        } catch (e) {
          const positions = db.listPositions().map((p) => ({ ...p, counts: db.getVoteCounts(p.id) }));
          return sendHtml(res, 413, render.renderAdminDashboard({ positions, error: 'Yüklenen dosya çok büyük (maks 8MB).' }));
        }
        const fd = await webReq.formData();
        try {
          const imagePath = await saveUploadedImage(fd.get('image'));
          db.createPosition({
            title: String(fd.get('title') || '').trim(),
            description: String(fd.get('description') || '').trim(),
            matchInfo: String(fd.get('match_info') || '').trim(),
            category: String(fd.get('category') || 'Diger'),
            weekLabel: String(fd.get('week_label') || '').trim(),
            imagePath,
          });
        } catch (e) {
          const positions = db.listPositions().map((p) => ({ ...p, counts: db.getVoteCounts(p.id) }));
          return sendHtml(res, 400, render.renderAdminDashboard({ positions, error: uploadErrorMessage(e) }));
        }
        return redirect(res, '/admin');
      }

      const editMatch = pathname.match(/^\/admin\/positions\/(\d+)\/edit$/);
      if (editMatch) {
        const id = Number(editMatch[1]);
        if (req.method === 'GET') {
          const position = db.getPosition(id);
          if (!position) return notFound(res);
          return sendHtml(res, 200, render.renderAdminEdit(position));
        }
        if (req.method === 'POST') {
          const position = db.getPosition(id);
          if (!position) return notFound(res);
          const webReq = await readRequestAsWebRequest(req, urlObj);
          const fd = await webReq.formData();
          try {
            const imagePath = await saveUploadedImage(fd.get('image'));
            db.updatePosition(id, {
              title: String(fd.get('title') || '').trim(),
              description: String(fd.get('description') || '').trim(),
              matchInfo: String(fd.get('match_info') || '').trim(),
              category: String(fd.get('category') || 'Diger'),
              weekLabel: String(fd.get('week_label') || '').trim(),
              imagePath,
              keepImage: true,
            });
          } catch (e) {
            return sendHtml(res, 400, render.renderAdminEdit({ ...position, ...Object.fromEntries(fd) }, uploadErrorMessage(e)));
          }
          return redirect(res, '/admin');
        }
      }

      const deleteMatch = pathname.match(/^\/admin\/positions\/(\d+)\/delete$/);
      if (deleteMatch && req.method === 'POST') {
        const id = Number(deleteMatch[1]);
        const position = db.deletePosition(id);
        if (position && position.image_path) {
          const imgPath = path.join(db.UPLOADS_DIR, position.image_path);
          fs.unlink(imgPath, () => {});
        }
        return redirect(res, '/admin');
      }

      return notFound(res);
    }

    return notFound(res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      sendHtml(res, 500, render.layout({ title: 'Hata', body: '<div class="empty-state"><h1>Bir şeyler ters gitti</h1><p>Lütfen daha sonra tekrar dene.</p></div>' }));
    } else {
      res.end();
    }
  }
});

function withPct(counts) {
  const dogruPct = counts.total > 0 ? Math.round((counts.dogru / counts.total) * 100) : 0;
  const yanlisPct = counts.total > 0 ? 100 - dogruPct : 0;
  return { ...counts, dogruPct, yanlisPct };
}

function uploadErrorMessage(e) {
  if (e.code === 'IMAGE_TOO_LARGE') return 'Görsel çok büyük (maks 8MB).';
  if (e.code === 'INVALID_IMAGE_TYPE') return 'Geçersiz görsel türü. JPG, PNG, GIF veya WEBP kullan.';
  return 'Beklenmeyen bir hata oluştu: ' + e.message;
}

if (!process.env.ADMIN_PASSWORD) {
  console.warn('[UYARI] ADMIN_PASSWORD ortam degiskeni tanimli degil. Admin girisi calismayacak. .env dosyasi olusturup ADMIN_PASSWORD belirleyin.');
}

server.listen(PORT, () => {
  console.log(`VAR Yoklamasi ${PORT} portunda calisiyor -> http://localhost:${PORT}`);
});
