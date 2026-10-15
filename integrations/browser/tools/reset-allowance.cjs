#!/usr/bin/env node
'use strict';
// Explicit operator action only. Never imported by the HTTP service.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const applicationRoot = process.env.BEFOREWORD_APP_ROOT || path.resolve(__dirname, '..');
if (!path.isAbsolute(applicationRoot)) throw new Error('ABSOLUTE_APP_ROOT_REQUIRED');
const { readConfiguration } = require(path.join(applicationRoot, 'server/config.cjs'));
const { TRIAL_LIMIT } = require(path.join(applicationRoot, 'server/store.cjs'));
function stop(code) { const error = new Error(code); error.code = code; throw error; }
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function privateFile(filename, existing) {
  if (!path.isAbsolute(filename)) stop('PRIVATE_PATH_REQUIRED');
  const parent = fs.realpathSync(path.dirname(filename));
  if (parent.split(path.sep).some(part => part.toLowerCase() === 'public_html')) stop('PRIVATE_PATH_REQUIRED');
  const directory = fs.statSync(parent);
  if ((directory.mode & 0o077) || (process.getuid && directory.uid !== process.getuid())) stop('PRIVATE_PATH_REQUIRED');
  const result = path.join(parent, path.basename(filename));
  if (existing) {
    const stat = fs.lstatSync(result);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) ||
        (process.getuid && stat.uid !== process.getuid())) stop('PRIVATE_PATH_REQUIRED');
  }
  return result;
}
function resetAllowance(db, { installationHash, origin, expectedCompleted, backupPath, now = Date.now() }) {
  if (!/^[0-9a-f]{64}$/u.test(installationHash || '') || typeof origin !== 'string' || origin.length > 300 ||
      !Number.isInteger(expectedCompleted) || expectedCompleted < 1 || expectedCompleted > TRIAL_LIMIT) stop('EXACT_TARGET_REQUIRED');
  const backup = privateFile(backupPath, false);
  let begun = false;
  try {
    db.exec('BEGIN IMMEDIATE'); begun = true;
    if (db.prepare("SELECT value FROM metadata WHERE key='version'").get()?.value !== '3') stop('SCHEMA_3_REQUIRED');
    const trial = db.prepare('SELECT * FROM trials WHERE installation_hash=?').get(installationHash);
    if (!trial || trial.origin !== origin || trial.completed !== expectedCompleted) stop('TARGET_CHANGED');
    if (db.prepare('SELECT count(*) AS n FROM leases WHERE installation_hash=? AND expires_at>?').get(installationHash, now).n) stop('ACTIVE_ANALYSIS');
    const sessions = db.prepare('SELECT * FROM sessions WHERE installation_hash=? ORDER BY token_hash').all(installationHash);
    if (!sessions.length || sessions.some(row => row.origin !== origin)) stop('TARGET_SESSION_REQUIRED');
    const unaffected = () => digest({
      metadata: db.prepare('SELECT * FROM metadata ORDER BY key').all(),
      counters: db.prepare('SELECT * FROM counters ORDER BY key').all(),
      leases: db.prepare('SELECT * FROM leases ORDER BY id').all(),
      trials: db.prepare('SELECT * FROM trials WHERE installation_hash<>? ORDER BY installation_hash').all(installationHash),
      sessions: db.prepare('SELECT * FROM sessions WHERE installation_hash IS NULL OR installation_hash<>? ORDER BY token_hash').all(installationHash),
    });
    const preserved = unaffected();
    const saved = { operation: 'reset-one-installation-allowance', version: 1, createdAt: new Date(now).toISOString(),
      trial, sessions, unaffectedSha256: preserved, resetFields: ['trials.completed', 'sessions.used'],
      countersPolicy: 'All network, issuance and global budget counters are preserved.' };
    const fd = fs.openSync(backup, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(saved, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    const changed = db.prepare('UPDATE trials SET completed=0 WHERE installation_hash=? AND origin=? AND completed=?').run(installationHash, origin, expectedCompleted);
    if (changed.changes !== 1) stop('TARGET_CHANGED');
    db.prepare('UPDATE sessions SET used=0 WHERE installation_hash=?').run(installationHash);
    if (unaffected() !== preserved) stop('OUT_OF_SCOPE_CHANGE');
    db.exec('COMMIT'); begun = false;
    return { reset: true, limit: TRIAL_LIMIT, remaining: TRIAL_LIMIT, trialsChanged: 1,
      targetSessions: sessions.length, budgetCountersPreserved: true, otherInstallationsPreserved: true,
      backupFile: path.basename(backup) };
  } catch (error) {
    if (begun) { try { db.exec('ROLLBACK'); } catch {} }
    throw error;
  }
}
function run() {
  const pairs = process.argv.slice(2); const values = {};
  if (pairs.length !== 8) stop('ARGUMENTS_REQUIRED');
  for (let index = 0; index < pairs.length; index += 2) {
    const name = pairs[index];
    if (!['--installation-hash', '--origin', '--expected-completed', '--backup-file'].includes(name) || Object.hasOwn(values, name)) stop('ARGUMENTS_REQUIRED');
    values[name] = pairs[index + 1];
  }
  if (!/^[1-8]$/u.test(values['--expected-completed'] || '')) stop('EXACT_TARGET_REQUIRED');
  const configuration = readConfiguration();
  if (!configuration.origins.has(values['--origin'])) stop('ORIGIN_NOT_CONFIGURED');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(privateFile(configuration.databasePath, true));
  try {
    db.exec('PRAGMA busy_timeout=2000; PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF;');
    const fingerprint = crypto.createHash('sha256').update('beforeword-store-salt-v1\0' + configuration.networkSalt).digest('hex');
    if (db.prepare("SELECT value FROM metadata WHERE key='salt_fingerprint'").get()?.value !== fingerprint) stop('STORE_IDENTITY_MISMATCH');
    const result = resetAllowance(db, { installationHash: values['--installation-hash'], origin: values['--origin'],
      expectedCompleted: Number(values['--expected-completed']), backupPath: values['--backup-file'] });
    process.stdout.write(JSON.stringify(result) + '\n');
  } finally { db.close(); }
}
if (require.main === module) {
  try { run(); }
  catch (error) {
    const known = new Set(['EXACT_TARGET_REQUIRED', 'PRIVATE_PATH_REQUIRED', 'SCHEMA_3_REQUIRED', 'TARGET_CHANGED', 'ACTIVE_ANALYSIS',
      'TARGET_SESSION_REQUIRED', 'OUT_OF_SCOPE_CHANGE', 'ARGUMENTS_REQUIRED', 'ORIGIN_NOT_CONFIGURED', 'STORE_IDENTITY_MISMATCH', 'EEXIST']);
    process.stderr.write(JSON.stringify({ reset: false, code: known.has(error.code) ? error.code : 'RESET_UNAVAILABLE' }) + '\n');
    process.exitCode = 1;
  }
}
module.exports = { resetAllowance };
