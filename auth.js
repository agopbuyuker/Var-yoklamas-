'use strict';

const crypto = require('crypto');
const { timingSafeEqualStr } = require('./utils');

// In-memory session store. Fine for a single-process deployment; if you
// later run multiple instances behind a load balancer, swap this for a
// shared store (e.g. Redis).
const sessions = new Map();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 gun

function createSession() {
  const id = crypto.randomBytes(32).toString('hex');
  sessions.set(id, { createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
  return id;
}

function isValidSession(id) {
  if (!id) return false;
  const s = sessions.get(id);
  if (!s) return false;
  if (Date.now() > s.expiresAt) {
    sessions.delete(id);
    return false;
  }
  return true;
}

function destroySession(id) {
  sessions.delete(id);
}

function checkAdminPassword(input) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return timingSafeEqualStr(input || '', expected);
}

// Periodically clean up expired sessions.
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now > s.expiresAt) sessions.delete(id);
  }
}, 60 * 60 * 1000).unref();

module.exports = { createSession, isValidSession, destroySession, checkAdminPassword };
