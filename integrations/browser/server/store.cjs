'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SESSION_TTL = DAY;
const LEASE_TTL = 120_000;
const TRIAL_LIMIT = 8;
const ANSWER_REQUEST_TTL = 7 * DAY;
const MAX_ANSWER_REQUESTS = 20000;
const POLICY = Object.freeze({ session: 10, networkHour: 10, networkDay: 30, issueHour: 3, issueDay: 10,
  globalDay: 100, globalMonth: 1000, globalIssueDay: 1000, concurrent: 2, maxSessions: 2048, maxCounters: 8192,
  maxTrials: 100_000 });
function fail(code = 'STORE_UNAVAILABLE', status = 503, retryAfter) {
  const error = new Error(code); error.code = code; error.status = status;
  if (retryAfter !== undefined) error.retryAfter = retryAfter;
  throw error;
}
const HASH = /^[0-9a-f]{64}$/u;
function tokenHash(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(token)) fail('INVALID_SESSION', 401);
  return crypto.createHash('sha256').update(token).digest('hex');
}
function installationHash(installationId) {
  if (typeof installationId !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(installationId) ||
      Buffer.from(installationId, 'base64url').toString('base64url') !== installationId) fail('INVALID_SESSION_REQUEST', 400);
  return crypto.createHash('sha256').update('beforeword-installation-v1\0' + installationId).digest('hex');
}
function trialValue(completed, limit = TRIAL_LIMIT) {
  if (![6, TRIAL_LIMIT].includes(limit)) fail();
  if (!Number.isSafeInteger(completed) || completed < 0 || completed > TRIAL_LIMIT) fail();
  return { limit, remaining: Math.max(0, limit - completed) };
}
function trialExhausted(limit = TRIAL_LIMIT) {
  const error = new Error('TRIAL_EXHAUSTED');
  error.code = 'TRIAL_EXHAUSTED'; error.status = 429; error.trial = trialValue(TRIAL_LIMIT, limit);
  throw error;
}
function windowBounds(now) {
  const date = new Date(now);
  const day = Math.floor(now / DAY) * DAY;
  const month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  return { hour: Math.floor(now / HOUR) * HOUR, day, month, nextMonth: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) };
}
function privateDatabasePath(filename) {
  const parent = path.dirname(filename);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const realParent = fs.realpathSync(parent);
  if (realParent.split(path.sep).some(part => part.toLowerCase() === 'public_html')) fail();
  // Require a dedicated private directory rather than changing an existing public directory.
  const directoryStat = fs.statSync(realParent);
  if (process.getuid && directoryStat.uid !== process.getuid()) fail();
  if ((directoryStat.mode & 0o077) !== 0) fail();
  const destination = path.join(realParent, path.basename(filename));
  try { fs.closeSync(fs.openSync(destination, 'ax', 0o600)); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const stat = fs.lstatSync(destination);
  if (!stat.isFile() || stat.isSymbolicLink() || (process.getuid && stat.uid !== process.getuid())) fail();
  fs.chmodSync(destination, 0o600);
  return destination;
}
class QuotaStore {
  constructor(configuration, { now = Date.now } = {}) {
    this.now = now; this.db = null; this.dailyLimit = configuration.dailyLimit; this.monthlyLimit = configuration.monthlyLimit;
    this.requestSalt = configuration.networkSalt;
    try {
      const { DatabaseSync } = require('node:sqlite');
      const filename = privateDatabasePath(configuration.databasePath);
      this.db = new DatabaseSync(filename);
      this.db.exec('PRAGMA busy_timeout=2000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF;');
      this.transaction(() => {
        const existing = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        const names = new Set(existing.map(row => row.name));
        const fingerprint = crypto.createHash('sha256').update('beforeword-store-salt-v1\0' + configuration.networkSalt).digest('hex');
        if (!existing.length) {
          this.db.exec(`CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE trials (installation_hash TEXT PRIMARY KEY, origin TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0 CHECK(completed BETWEEN 0 AND 8));
            CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, network_hash TEXT NOT NULL, origin TEXT NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, installation_hash TEXT REFERENCES trials(installation_hash));
            CREATE TABLE counters (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
            CREATE TABLE leases (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, installation_hash TEXT REFERENCES trials(installation_hash));`);
          for (const [key, value] of [['version', '3'], ['salt_fingerprint', fingerprint]]) {
            this.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?)').run(key, value);
          }
        } else {
          if (!['metadata', 'sessions', 'counters', 'leases'].every(name => names.has(name))) fail();
          const version = this.db.prepare('SELECT value FROM metadata WHERE key=?').get('version')?.value;
          if (!['1', '2', '3'].includes(version) ||
              this.db.prepare('SELECT value FROM metadata WHERE key=?').get('salt_fingerprint')?.value !== fingerprint) fail();
          if (version === '1') {
            // Preserve all attempt counters and active leases. Legacy sessions have no
            // installation association and must be refreshed by the updated client.
            this.db.exec(`CREATE TABLE trials (installation_hash TEXT PRIMARY KEY, origin TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0 CHECK(completed BETWEEN 0 AND 8));
              ALTER TABLE sessions ADD COLUMN installation_hash TEXT REFERENCES trials(installation_hash);
              ALTER TABLE leases ADD COLUMN installation_hash TEXT REFERENCES trials(installation_hash);
              UPDATE metadata SET value='3' WHERE key='version';`);
          } else if (!names.has('trials') || !['sessions', 'leases'].every(table =>
            this.db.prepare(`PRAGMA table_info(${table})`).all().some(column => column.name === 'installation_hash'))) fail();
          if (version === '2') {
            // Rebuild the referenced tables together inside this transaction. Keep
            // every completed report, session, active lease and abuse counter.
            this.db.exec(`CREATE TABLE trials_v3 (installation_hash TEXT PRIMARY KEY, origin TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0 CHECK(completed BETWEEN 0 AND 8));
              INSERT INTO trials_v3 SELECT installation_hash,origin,completed FROM trials;
              CREATE TABLE sessions_v3 (token_hash TEXT PRIMARY KEY, network_hash TEXT NOT NULL, origin TEXT NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, installation_hash TEXT REFERENCES trials_v3(installation_hash));
              INSERT INTO sessions_v3 SELECT token_hash,network_hash,origin,expires_at,used,installation_hash FROM sessions;
              CREATE TABLE leases_v3 (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, installation_hash TEXT REFERENCES trials_v3(installation_hash));
              INSERT INTO leases_v3 SELECT id,expires_at,installation_hash FROM leases;
              DROP TABLE leases;
              DROP TABLE sessions;
              DROP TABLE trials;
              ALTER TABLE trials_v3 RENAME TO trials;
              ALTER TABLE sessions_v3 RENAME TO sessions;
              ALTER TABLE leases_v3 RENAME TO leases;
              UPDATE metadata SET value='3' WHERE key='version';`);
          }
        }
        this.db.exec('CREATE INDEX IF NOT EXISTS leases_installation ON leases(installation_hash);');
        // Additive migration only. Existing trials, counters, sessions, leases,
        // credentials and schema-version compatibility remain untouched.
        this.db.exec(`CREATE TABLE IF NOT EXISTS answer_requests (
          id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('started','completed','failed')),
          lease_id TEXT, expires_at INTEGER NOT NULL, error_code TEXT, error_status INTEGER);
          CREATE INDEX IF NOT EXISTS answer_requests_expiry ON answer_requests(expires_at);`);
      });
      fs.chmodSync(filename, 0o600);
    } catch {
      try { this.db?.close(); } catch {}
      this.db = null; fail();
    }
  }
  transaction(operation) {
    let begun = false;
    try {
      if (!this.db) fail();
      this.db.exec('BEGIN IMMEDIATE'); begun = true;
      const value = operation(); this.db.exec('COMMIT'); return value;
    } catch (error) {
      if (begun) { try { this.db.exec('ROLLBACK'); } catch {} }
      if (['INVALID_SESSION', 'INVALID_SESSION_REQUEST', 'SESSION_EXPIRED', 'SESSION_LIMIT', 'NETWORK_LIMIT', 'SESSION_ISSUANCE_LIMIT', 'DAILY_LIMIT', 'MONTHLY_LIMIT', 'SERVICE_BUSY', 'STORE_UNAVAILABLE', 'TRIAL_EXHAUSTED', 'REQUEST_ID_CONFLICT'].includes(error?.code)) throw error;
      fail();
    }
  }
  cleanup(now) {
    this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now);
    this.db.prepare('DELETE FROM counters WHERE expires_at<=?').run(now);
    this.db.prepare('DELETE FROM leases WHERE expires_at<=?').run(now);
    this.db.prepare('DELETE FROM answer_requests WHERE expires_at<=?').run(now);
  }
  increment(key, limit, expiresAt, code, now) {
    const current = this.db.prepare('SELECT count,expires_at FROM counters WHERE key=?').get(key);
    if (current && current.count >= limit) fail(code, 429, Math.max(1, Math.ceil((current.expires_at - now) / 1000)));
    if (!current && this.db.prepare('SELECT count(*) AS total FROM counters').get().total >= POLICY.maxCounters) fail('SERVICE_BUSY', 429, 60);
    this.db.prepare('INSERT INTO counters(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key, expiresAt);
  }
  session(token, network, origin, now) {
    if (!HASH.test(network)) fail('INVALID_SESSION', 401);
    const row = this.db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(tokenHash(token));
    if (!row || row.network_hash !== network || row.origin !== origin || !HASH.test(row.installation_hash)) fail('INVALID_SESSION', 401);
    if (row.expires_at <= now) fail('SESSION_EXPIRED', 401);
    return row;
  }
  trial(installation, origin) {
    const row = this.db.prepare('SELECT * FROM trials WHERE installation_hash=?').get(installation);
    if (!row || row.origin !== origin) fail();
    trialValue(row.completed);
    return row;
  }
  issue(network, origin, installationId, trialLimit = TRIAL_LIMIT) {
    const installation = installationHash(installationId);
    return this.transaction(() => {
      const now = this.now(); const window = windowBounds(now); this.cleanup(now);
      if (!HASH.test(network) || typeof origin !== 'string' || origin.length > 300) fail();
      let trial = this.db.prepare('SELECT * FROM trials WHERE installation_hash=?').get(installation);
      if (trial && trial.origin !== origin) fail('INVALID_SESSION_REQUEST', 400);
      if (!trial) {
        if (this.db.prepare('SELECT count(*) AS total FROM trials').get().total >= POLICY.maxTrials) fail('SERVICE_BUSY', 429, 60);
        this.db.prepare('INSERT INTO trials(installation_hash,origin,completed) VALUES(?,?,0)').run(installation, origin);
        trial = { completed: 0 };
      }
      const allowance = trialValue(trial.completed, trialLimit);
      if (allowance.remaining === 0) trialExhausted(trialLimit);
      if (this.db.prepare('SELECT count(*) AS total FROM sessions').get().total >= POLICY.maxSessions) fail('SERVICE_BUSY', 429, 60);
      this.increment(`issue:h:${network}:${window.hour}`, POLICY.issueHour, window.hour + HOUR, 'SESSION_ISSUANCE_LIMIT', now);
      this.increment(`issue:d:${network}:${window.day}`, POLICY.issueDay, window.day + DAY, 'SESSION_ISSUANCE_LIMIT', now);
      this.increment(`issue:g:${window.day}`, POLICY.globalIssueDay, window.day + DAY, 'SESSION_ISSUANCE_LIMIT', now);
      const token = crypto.randomBytes(32).toString('base64url'); const expiresAt = now + SESSION_TTL;
      this.db.prepare('INSERT INTO sessions(token_hash,network_hash,origin,expires_at,used,installation_hash) VALUES(?,?,?,?,0,?)').run(tokenHash(token), network, origin, expiresAt, installation);
      return { token, expiresAt, trial: allowance };
    });
  }
  authorize(token, network, origin) {
    try { this.session(token, network, origin, this.now()); return true; }
    catch (error) { if (['INVALID_SESSION', 'SESSION_EXPIRED'].includes(error?.code)) throw error; fail(); }
  }
  acquire(token, network, origin, trialLimit = TRIAL_LIMIT) {
    return this.transaction(() => this.acquireInside(token, network, origin, trialLimit));
  }
  acquireInside(token, network, origin, trialLimit = TRIAL_LIMIT) {
      const now = this.now(); const window = windowBounds(now);
      const session = this.session(token, network, origin, now); this.cleanup(now);
      const trial = this.trial(session.installation_hash, origin);
      if (trialValue(trial.completed, trialLimit).remaining === 0) trialExhausted(trialLimit);
      const pending = this.db.prepare('SELECT count(*) AS total FROM leases WHERE installation_hash=?').get(session.installation_hash).total;
      if (trial.completed + pending >= trialLimit) fail('SERVICE_BUSY', 429, 2);
      if (this.db.prepare('SELECT count(*) AS total FROM leases').get().total >= POLICY.concurrent) fail('SERVICE_BUSY', 429, 2);
      if (session.used >= POLICY.session) fail('SESSION_LIMIT', 429, Math.max(1, Math.ceil((session.expires_at - now) / 1000)));
      this.increment(`analysis:h:${network}:${window.hour}`, POLICY.networkHour, window.hour + HOUR, 'NETWORK_LIMIT', now);
      this.increment(`analysis:d:${network}:${window.day}`, POLICY.networkDay, window.day + DAY, 'NETWORK_LIMIT', now);
      this.increment(`analysis:g:d:${window.day}`, this.dailyLimit, window.day + DAY, 'DAILY_LIMIT', now);
      this.increment(`analysis:g:m:${window.month}`, this.monthlyLimit, window.nextMonth, 'MONTHLY_LIMIT', now);
      this.db.prepare('UPDATE sessions SET used=used+1 WHERE token_hash=?').run(session.token_hash);
      const lease = crypto.randomUUID();
      this.db.prepare('INSERT INTO leases(id,expires_at,installation_hash) VALUES(?,?,?)').run(lease, now + LEASE_TTL, session.installation_hash);
      return lease;
  }
  complete(lease) {
    return this.transaction(() => this.completeInside(lease));
  }
  completeInside(lease) {
      const reservation = this.db.prepare('SELECT * FROM leases WHERE id=?').get(lease);
      // An expired or already finalized reservation can never produce a report.
      if (!reservation || !HASH.test(reservation.installation_hash) || reservation.expires_at <= this.now()) fail();
      const row = this.db.prepare('SELECT completed FROM trials WHERE installation_hash=?').get(reservation.installation_hash);
      if (!row || trialValue(row.completed).remaining === 0) fail();
      this.db.prepare('UPDATE trials SET completed=completed+1 WHERE installation_hash=?').run(reservation.installation_hash);
      this.db.prepare('DELETE FROM leases WHERE id=?').run(lease);
      return trialValue(row.completed + 1);
  }
  allowance(token, network, origin) {
    const session = this.session(token, network, origin, this.now());
    return trialValue(this.trial(session.installation_hash, origin).completed);
  }
  reserveAnswer({ token, network, origin, identity, personal = false }) {
    return this.transaction(() => {
      const now = this.now(); this.cleanup(now);
      const session = personal ? null : this.session(token, network, origin, now);
      const owner = personal ? identity.owner : session.installation_hash;
      if (!HASH.test(owner) || !HASH.test(identity.fingerprint) || !HASH.test(network)) fail();
      const id = crypto.createHmac('sha256', this.requestSalt)
        .update('beforeword-answer-request-v1\0' + (personal ? 'personal' : 'shared') + '\0' + owner + '\0' + identity.requestId).digest('hex');
      const existing = this.db.prepare('SELECT * FROM answer_requests WHERE id=?').get(id);
      const trial = personal ? null : trialValue(this.trial(session.installation_hash, origin).completed);
      if (existing) {
        if (!HASH.test(existing.fingerprint) || !['started', 'completed', 'failed'].includes(existing.state) ||
            (existing.state === 'started' && typeof existing.lease_id !== 'string')) fail();
        if (existing.fingerprint !== identity.fingerprint) fail('REQUEST_ID_CONFLICT', 409);
        // A crashed process leaves a durable pending marker. Never resubmit a
        // possibly paid provider call once its lease disappears.
        const active = existing.lease_id && this.db.prepare('SELECT id FROM leases WHERE id=?').get(existing.lease_id);
        return { id, state: existing.state === 'started' && !active ? 'interrupted' : existing.state,
          errorCode: existing.error_code, errorStatus: existing.error_status, trial };
      }
      if (this.db.prepare('SELECT count(*) AS total FROM answer_requests').get().total >= MAX_ANSWER_REQUESTS) fail('SERVICE_BUSY', 429, 60);
      let lease;
      if (personal) {
        const window = windowBounds(now);
        if (this.db.prepare('SELECT count(*) AS total FROM leases').get().total >= POLICY.concurrent) fail('SERVICE_BUSY', 429, 2);
        // Own-key requests never consume service trial slots or its paid budget.
        // Independent ingress caps protect the same worker/database resources.
        this.increment(`personal:h:${network}:${window.hour}`, 30, window.hour + HOUR, 'NETWORK_LIMIT', now);
        this.increment(`personal:d:${network}:${window.day}`, 100, window.day + DAY, 'NETWORK_LIMIT', now);
        this.increment(`personal:g:${window.day}`, 1000, window.day + DAY, 'DAILY_LIMIT', now);
        lease = crypto.randomUUID();
        this.db.prepare('INSERT INTO leases(id,expires_at,installation_hash) VALUES(?,?,NULL)').run(lease, now + LEASE_TTL);
      } else lease = this.acquireInside(token, network, origin, TRIAL_LIMIT);
      this.db.prepare('INSERT INTO answer_requests(id,fingerprint,state,lease_id,expires_at) VALUES(?,?,\'started\',?,?)')
        .run(id, identity.fingerprint, lease, now + ANSWER_REQUEST_TTL);
      return { id, state: 'new', lease, trial };
    });
  }
  finishAnswer(id, lease, personal = false) {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM answer_requests WHERE id=?').get(id);
      if (!row || row.state !== 'started' || row.lease_id !== lease) fail();
      let trial = null;
      if (personal) {
        const held = this.db.prepare('SELECT * FROM leases WHERE id=?').get(lease);
        if (!held || held.expires_at <= this.now()) fail();
        this.db.prepare('DELETE FROM leases WHERE id=?').run(lease);
      } else trial = this.completeInside(lease);
      this.db.prepare('UPDATE answer_requests SET state=\'completed\',lease_id=NULL WHERE id=?').run(id);
      return trial;
    });
  }
  failAnswer(id, lease, code, status) {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM answer_requests WHERE id=?').get(id);
      if (row?.state !== 'started' || row.lease_id !== lease) return;
      this.db.prepare('UPDATE answer_requests SET state=\'failed\',lease_id=NULL,error_code=?,error_status=? WHERE id=?')
        .run(code, status, id);
      this.db.prepare('DELETE FROM leases WHERE id=?').run(lease);
    });
  }
  release(lease) {
    try { this.db.prepare('DELETE FROM leases WHERE id=?').run(lease); }
    catch { fail(); }
  }
  health() { try { if (!this.db) fail(); this.db.prepare('SELECT 1').get(); return true; } catch { fail(); } }
  close() { if (this.db) { this.db.close(); this.db = null; } }
}
module.exports = { QuotaStore, POLICY, SESSION_TTL, LEASE_TTL, TRIAL_LIMIT, tokenHash, installationHash, windowBounds };
