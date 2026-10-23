#!/usr/bin/env node
'use strict';
// Local configuration/store check only: no network and no environment values printed.
try {
  const { readConfiguration } = require('./config.cjs');
  const { QuotaStore } = require('./store.cjs');
  const Core = require('../extension/analysis-core.js');
  const { answerProfileMetadata } = require('./answer-profile.cjs');
  const configuration = readConfiguration();
  const store = new QuotaStore(configuration);
  try { store.health(); } finally { store.close(); }
  Core.buildRequest({ text: 'Configuration check.', language: 'en' });
  const ready = Boolean(configuration.apiKey.trim());
  const instructionProfile = answerProfileMetadata(configuration.answerProfile);
  process.stdout.write(JSON.stringify({ ok: true, ready, checks: { node24: true, sqlite: true, privateStore: true, instructions: true, exactOrigins: true }, providerTested: false, ...(instructionProfile ? { instructionProfile } : {}) }) + '\n');
  if (!ready) process.exitCode = 1;
} catch (error) {
  const known = new Set(['NODE_24_REQUIRED', 'ANSWER_PROFILE_UNAVAILABLE', 'INVALID_ANSWER_PROFILE_CONFIGURATION', 'INVALID_API_KEY_CONFIGURATION', 'INVALID_BIND_CONFIGURATION', 'INVALID_PORT_CONFIGURATION',
    'FILE_ORIGIN_REQUIRES_LOOPBACK', 'INVALID_ORIGIN_CONFIGURATION', 'ALLOWED_ORIGINS_REQUIRED', 'PUBLIC_BIND_REQUIRES_HTTPS_ORIGINS',
    'PUBLIC_BIND_REQUIRES_TLS_PROXY', 'PRIVATE_DATABASE_PATH_REQUIRED', 'NETWORK_SALT_REQUIRED', 'INVALID_PROXY_CONFIGURATION', 'INVALID_LIMIT_CONFIGURATION', 'STORE_UNAVAILABLE']);
  process.stdout.write(JSON.stringify({ ok: false, ready: false, error: { code: known.has(error?.code) ? error.code : 'CONFIGURATION_ERROR' }, providerTested: false }) + '\n');
  process.exitCode = 1;
}
