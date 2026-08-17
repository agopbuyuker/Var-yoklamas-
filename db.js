'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

// DATA_DIR ortam degiskeni verilirse (orn. Render/Railway kalici disk baglama
// yolu) onu kullan; aksi halde proje icindeki ./data klasorunu kullan.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'app.db');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    match_info TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Diger',
    week_label TEXT NOT NULL DEFAULT '',
    image_path TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position_id INTEGER NOT NULL,
    voter_id TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    choice TEXT NOT NULL CHECK (choice IN ('dogru', 'yanlis')),
    created_at TEXT NOT NULL,
    UNIQUE(position_id, voter_id),
    FOREIGN KEY(position_id) REFERENCES positions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_votes_position ON votes(position_id);
`);

const CATEGORIES = ['Penalti', 'Kirmizi Kart', 'Sari Kart', 'Ofsayt', 'Faul', 'VAR Karari', 'Diger'];
// Turkish characters kept for display purposes below; internal values use ASCII to avoid encoding issues.
const CATEGORY_LABELS = {
  'Penalti': 'Penaltı',
  'Kirmizi Kart': 'Kırmızı Kart',
  'Sari Kart': 'Sarı Kart',
  'Ofsayt': 'Ofsayt',
  'Faul': 'Faul',
  'VAR Karari': 'VAR Kararı',
  'Diger': 'Diğer',
};

function nowIso() {
  return new Date().toISOString();
}

function createPosition({ title, description, matchInfo, category, weekLabel, imagePath }) {
  const stmt = db.prepare(`
    INSERT INTO positions (title, description, match_info, category, week_label, image_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(title, description, matchInfo || '', category || 'Diger', weekLabel || '', imagePath || null, nowIso());
  return Number(info.lastInsertRowid);
}

function updatePosition(id, { title, description, matchInfo, category, weekLabel, imagePath, keepImage }) {
  if (imagePath || !keepImage) {
    db.prepare(`
      UPDATE positions SET title = ?, description = ?, match_info = ?, category = ?, week_label = ?, image_path = ?
      WHERE id = ?
    `).run(title, description, matchInfo || '', category || 'Diger', weekLabel || '', imagePath || null, id);
  } else {
    db.prepare(`
      UPDATE positions SET title = ?, description = ?, match_info = ?, category = ?, week_label = ?
      WHERE id = ?
    `).run(title, description, matchInfo || '', category || 'Diger', weekLabel || '', id);
  }
}

function getPosition(id) {
  return db.prepare('SELECT * FROM positions WHERE id = ?').get(id);
}

function deletePosition(id) {
  const pos = getPosition(id);
  db.prepare('DELETE FROM positions WHERE id = ?').run(id);
  return pos;
}

function listPositions() {
  return db.prepare('SELECT * FROM positions ORDER BY id DESC').all();
}

function listPositionsWithResults(voterId) {
  const positions = listPositions();
  return positions.map((p) => attachResults(p, voterId));
}

function getVoteCounts(positionId) {
  const rows = db.prepare('SELECT choice, COUNT(*) as c FROM votes WHERE position_id = ? GROUP BY choice').all(positionId);
  let dogru = 0;
  let yanlis = 0;
  for (const r of rows) {
    if (r.choice === 'dogru') dogru = Number(r.c);
    if (r.choice === 'yanlis') yanlis = Number(r.c);
  }
  return { dogru, yanlis, total: dogru + yanlis };
}

function getMyVote(positionId, voterId) {
  if (!voterId) return null;
  const row = db.prepare('SELECT choice FROM votes WHERE position_id = ? AND voter_id = ?').get(positionId, voterId);
  return row ? row.choice : null;
}

function attachResults(position, voterId) {
  const counts = getVoteCounts(position.id);
  const myVote = getMyVote(position.id, voterId);
  const dogruPct = counts.total > 0 ? Math.round((counts.dogru / counts.total) * 100) : 0;
  const yanlisPct = counts.total > 0 ? 100 - dogruPct : 0;
  return { ...position, counts: { ...counts, dogruPct, yanlisPct }, myVote };
}

function castVote({ positionId, voterId, ipHash, choice }) {
  const existing = db.prepare('SELECT id FROM votes WHERE position_id = ? AND voter_id = ?').get(positionId, voterId);
  if (existing) {
    const err = new Error('ALREADY_VOTED');
    err.code = 'ALREADY_VOTED';
    throw err;
  }
  db.prepare(`
    INSERT INTO votes (position_id, voter_id, ip_hash, choice, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(positionId, voterId, ipHash, choice, nowIso());
}

module.exports = {
  db,
  UPLOADS_DIR,
  CATEGORIES,
  CATEGORY_LABELS,
  createPosition,
  updatePosition,
  getPosition,
  deletePosition,
  listPositions,
  listPositionsWithResults,
  getVoteCounts,
  getMyVote,
  attachResults,
  castVote,
};
