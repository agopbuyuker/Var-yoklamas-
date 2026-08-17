'use strict';

const { esc } = require('./utils');
const { CATEGORY_LABELS } = require('./db');

const SITE_NAME = 'VAR Yoklaması';
const TAGLINE = 'Haftanın tartışmalı pozisyonlarına halk oyu';

function layout({ title, body, activeAdmin = false, showAdminLink = true }) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} · ${esc(SITE_NAME)}</title>
<link rel="stylesheet" href="/style.css">
<meta name="description" content="${esc(TAGLINE)}">
</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/">
      <span class="brand-mark">VAR</span>
      <span class="brand-text">Yoklaması</span>
    </a>
    ${showAdminLink ? `<a class="admin-link" href="${activeAdmin ? '/admin' : '/admin/login'}">${activeAdmin ? 'Yönetim Paneli' : 'Yönetici Girişi'}</a>` : ''}
  </div>
</header>
<main class="wrap main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>VAR Yoklaması, haftanın tartışmalı futbol pozisyonları hakkında halkın görüşünü ölçen bağımsız bir oylama sitesidir. Sonuçlar resmi bir karar niteliği taşımaz.</p>
  </div>
</footer>
<script src="/app.js"></script>
</body>
</html>`;
}

function categoryOptions(selected) {
  return Object.entries(CATEGORY_LABELS)
    .map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`)
    .join('');
}

function resultBar(position) {
  const { counts, myVote } = position;
  if (counts.total === 0 && !myVote) {
    return `
    <form class="vote-form" data-position-id="${position.id}" action="/vote" method="POST">
      <input type="hidden" name="position_id" value="${position.id}">
      <button class="vote-btn vote-btn-dogru" type="submit" name="choice" value="dogru">Doğru</button>
      <button class="vote-btn vote-btn-yanlis" type="submit" name="choice" value="yanlis">Yanlış</button>
    </form>
    <p class="vote-empty-hint">Henüz oy verilmedi. İlk oyu sen ver!</p>`;
  }
  if (!myVote) {
    return `
    <form class="vote-form" data-position-id="${position.id}" action="/vote" method="POST">
      <input type="hidden" name="position_id" value="${position.id}">
      <button class="vote-btn vote-btn-dogru" type="submit" name="choice" value="dogru">Doğru</button>
      <button class="vote-btn vote-btn-yanlis" type="submit" name="choice" value="yanlis">Yanlış</button>
    </form>
    ${resultsMarkup(position)}`;
  }
  return `<p class="voted-note">Oyun kaydedildi: <strong>${myVote === 'dogru' ? 'Doğru' : 'Yanlış'}</strong></p>${resultsMarkup(position)}`;
}

function resultsMarkup(position) {
  const { counts } = position;
  return `
  <div class="results" data-position-id="${position.id}">
    <div class="result-row">
      <span class="result-label">Doğru</span>
      <div class="bar-track"><div class="bar-fill bar-dogru" style="width:${counts.dogruPct}%"></div></div>
      <span class="result-pct">${counts.dogruPct}%</span>
    </div>
    <div class="result-row">
      <span class="result-label">Yanlış</span>
      <div class="bar-track"><div class="bar-fill bar-yanlis" style="width:${counts.yanlisPct}%"></div></div>
      <span class="result-pct">${counts.yanlisPct}%</span>
    </div>
    <p class="total-votes">${counts.total} oy</p>
  </div>`;
}

function positionCard(position) {
  const img = position.image_path
    ? `<img class="position-image" src="/uploads/${esc(position.image_path)}" alt="${esc(position.title)}" loading="lazy">`
    : '';
  return `
  <article class="position-card" id="pos-${position.id}">
    <div class="position-card-head">
      <span class="category-badge">${esc(CATEGORY_LABELS[position.category] || position.category)}</span>
      ${position.match_info ? `<span class="match-info">${esc(position.match_info)}</span>` : ''}
    </div>
    ${img}
    <h3 class="position-title">${esc(position.title)}</h3>
    <p class="position-desc">${esc(position.description)}</p>
    <div class="vote-area">
      ${resultBar(position)}
    </div>
  </article>`;
}

function groupByWeek(positions) {
  const map = new Map();
  for (const p of positions) {
    const key = p.week_label || 'Diğer';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  return map;
}

function renderHome(positions) {
  const groups = groupByWeek(positions);
  let body = '';
  if (positions.length === 0) {
    body = `<div class="empty-state">
      <h1>Henüz pozisyon eklenmedi</h1>
      <p>Yönetici panelinden haftanın tartışmalı pozisyonlarını ekleyebilirsin.</p>
    </div>`;
  } else {
    body += `<div class="intro">
      <h1>Bu haftanın tartışmalı pozisyonları</h1>
      <p>${esc(TAGLINE)}. Her pozisyon için sadece bir kez oy kullanabilirsin.</p>
    </div>`;
    for (const [week, items] of groups) {
      body += `<section class="week-section">
        <h2 class="week-title">${esc(week)}</h2>
        <div class="position-grid">
          ${items.map(positionCard).join('\n')}
        </div>
      </section>`;
    }
  }
  return layout({ title: 'Anasayfa', body });
}

function renderAdminLogin(error) {
  const body = `
  <div class="admin-login-wrap">
    <h1>Yönetici Girişi</h1>
    ${error ? `<p class="form-error">${esc(error)}</p>` : ''}
    <form method="POST" action="/admin/login" class="admin-form">
      <label>Şifre
        <input type="password" name="password" required autofocus>
      </label>
      <button type="submit" class="primary-btn">Giriş Yap</button>
    </form>
  </div>`;
  return layout({ title: 'Yönetici Girişi', body, showAdminLink: false });
}

function positionFormFields(position) {
  const p = position || {};
  return `
    <label>Başlık
      <input type="text" name="title" required maxlength="200" value="${esc(p.title)}" placeholder="Örn. 65. dakika penaltı beklentisi">
    </label>
    <label>Açıklama
      <textarea name="description" required rows="4" placeholder="Pozisyonu kısaca anlat...">${esc(p.description)}</textarea>
    </label>
    <label>Maç Bilgisi
      <input type="text" name="match_info" maxlength="200" value="${esc(p.match_info)}" placeholder="Örn. Galatasaray - Fenerbahçe, 17.08.2026">
    </label>
    <div class="form-row">
      <label>Kategori
        <select name="category">${categoryOptions(p.category)}</select>
      </label>
      <label>Hafta Etiketi
        <input type="text" name="week_label" maxlength="100" value="${esc(p.week_label)}" placeholder="Örn. 3. Hafta (14-17 Ağustos)">
      </label>
    </div>
    <label>Görsel ${position ? '(değiştirmek için yeni dosya seç)' : ''}
      <input type="file" name="image" accept="image/png,image/jpeg,image/gif,image/webp">
    </label>
    ${position && position.image_path ? `<p class="current-image-note">Mevcut görsel: ${esc(position.image_path)}</p>` : ''}
  `;
}

function renderAdminDashboard({ positions, message, error }) {
  const rows = positions
    .map((p) => `
    <tr>
      <td>${esc(p.week_label)}</td>
      <td>${esc(CATEGORY_LABELS[p.category] || p.category)}</td>
      <td>${esc(p.title)}</td>
      <td>${p.counts ? p.counts.total : ''}</td>
      <td class="admin-actions">
        <a href="/admin/positions/${p.id}/edit">Düzenle</a>
        <form method="POST" action="/admin/positions/${p.id}/delete" onsubmit="return confirm('Bu pozisyonu silmek istediğine emin misin?');">
          <button type="submit" class="link-btn danger">Sil</button>
        </form>
      </td>
    </tr>`)
    .join('');

  const body = `
  <div class="admin-dashboard">
    <div class="admin-dashboard-head">
      <h1>Yönetim Paneli</h1>
      <form method="POST" action="/admin/logout"><button type="submit" class="link-btn">Çıkış Yap</button></form>
    </div>
    ${message ? `<p class="form-success">${esc(message)}</p>` : ''}
    ${error ? `<p class="form-error">${esc(error)}</p>` : ''}

    <section class="admin-section">
      <h2>Yeni Pozisyon Ekle</h2>
      <form method="POST" action="/admin/positions" enctype="multipart/form-data" class="admin-form">
        ${positionFormFields(null)}
        <button type="submit" class="primary-btn">Ekle</button>
      </form>
    </section>

    <section class="admin-section">
      <h2>Mevcut Pozisyonlar (${positions.length})</h2>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Hafta</th><th>Kategori</th><th>Başlık</th><th>Oy</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">Henüz pozisyon yok.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  </div>`;
  return layout({ title: 'Yönetim Paneli', body, activeAdmin: true });
}

function renderAdminEdit(position, error) {
  const body = `
  <div class="admin-dashboard">
    <h1>Pozisyonu Düzenle</h1>
    ${error ? `<p class="form-error">${esc(error)}</p>` : ''}
    <form method="POST" action="/admin/positions/${position.id}/edit" enctype="multipart/form-data" class="admin-form">
      ${positionFormFields(position)}
      <div class="form-actions">
        <button type="submit" class="primary-btn">Kaydet</button>
        <a href="/admin" class="secondary-btn">Vazgeç</a>
      </div>
    </form>
  </div>`;
  return layout({ title: 'Pozisyonu Düzenle', body, activeAdmin: true });
}

module.exports = {
  layout,
  renderHome,
  renderAdminLogin,
  renderAdminDashboard,
  renderAdminEdit,
  resultsMarkup,
};
