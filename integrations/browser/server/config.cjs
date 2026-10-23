'use strict';
const net = require('node:net');
const path = require('node:path');
const { canonicalIP } = require('./network.cjs');
const { resolveAnswerProfile } = require('./answer-profile.cjs');
function configError(code) { const error = new Error(code); error.code = code; return error; }
const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
// Firefox and Safari may assign an origin per installation. These are syntax
// checks only: an Origin header does not authenticate a browser or publisher.
const WEBEXTENSION_ORIGIN = /^(?:moz-extension|safari-web-extension):\/\/[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$/u;
function isWebExtensionOrigin(value) {
  return typeof value === 'string' && WEBEXTENSION_ORIGIN.test(value);
}
function configuredOrigin(entry) {
  if (typeof entry !== 'string' || entry.length > 300 || entry === 'null' || entry.includes('*')) throw configError('INVALID_ORIGIN_CONFIGURATION');
  if (isWebExtensionOrigin(entry)) return entry;
  let url;
  try { url = new URL(entry); } catch { throw configError('INVALID_ORIGIN_CONFIGURATION'); }
  if (!['http:', 'https:', 'chrome-extension:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw configError('INVALID_ORIGIN_CONFIGURATION');
  if (url.protocol === 'chrome-extension:' && !/^[a-p]{32}$/u.test(url.hostname)) throw configError('INVALID_ORIGIN_CONFIGURATION');
  const origin = url.protocol === 'chrome-extension:' ? `chrome-extension://${url.hostname}` : url.origin;
  if (entry !== origin) throw configError('INVALID_ORIGIN_CONFIGURATION');
  return origin;
}
function allowsOrigin(origin, configuration) {
  return typeof origin === 'string' && (configuration.origins.has(origin) ||
    (configuration.allowWebExtensionOrigins === true && isWebExtensionOrigin(origin)) ||
    (origin === 'null' && configuration.allowFile && configuration.loopback));
}
function readConfiguration() {
  if (Number(process.versions.node.split('.')[0]) < 24) throw configError('NODE_24_REQUIRED');
  // Operator-only selection. Unknown/missing candidate data stops startup, never falls back.
  const answerProfile = resolveAnswerProfile(process.env.BEFOREWORD_ANSWER_PROFILE).profile;
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (/[\r\n]/u.test(apiKey)) throw configError('INVALID_API_KEY_CONFIGURATION');
  const model = process.env.BEFOREWORD_MODEL ?? 'gpt-6.1-sol';
  if (!MODEL_NAME.test(model)) throw configError('INVALID_MODEL_CONFIGURATION');
  const host = process.env.BEFOREWORD_HOST || '127.0.0.1';
  if (host !== 'localhost' && !net.isIP(host)) throw configError('INVALID_BIND_CONFIGURATION');
  const port = Number(process.env.BEFOREWORD_PORT || process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw configError('INVALID_PORT_CONFIGURATION');
  const loopback = ['127.0.0.1', '::1', 'localhost'].includes(host);
  const allowFile = process.env.BEFOREWORD_ALLOW_FILE_ORIGIN === '1';
  if (allowFile && !loopback) throw configError('FILE_ORIGIN_REQUIRES_LOOPBACK');
  const dynamicOriginSetting = process.env.BEFOREWORD_ALLOW_WEBEXTENSION_ORIGINS;
  if (dynamicOriginSetting !== undefined && !['false', 'true'].includes(dynamicOriginSetting)) throw configError('INVALID_WEBEXTENSION_ORIGIN_CONFIGURATION');
  const allowWebExtensionOrigins = dynamicOriginSetting === 'true';
  const origins = new Set();
  const originList = process.env.BEFOREWORD_ALLOWED_ORIGINS || '';
  if (originList.length > 8192) throw configError('INVALID_ORIGIN_CONFIGURATION');
  for (const entry of originList.split(',').map(value => value.trim()).filter(Boolean)) {
    if (origins.size >= 32) throw configError('INVALID_ORIGIN_CONFIGURATION');
    const origin = configuredOrigin(entry);
    if (!loopback && origin.startsWith('http:')) throw configError('PUBLIC_BIND_REQUIRES_HTTPS_ORIGINS');
    origins.add(origin);
  }
  if (!origins.size && !allowFile && !allowWebExtensionOrigins) throw configError('ALLOWED_ORIGINS_REQUIRED');
  if (!loopback && process.env.BEFOREWORD_BEHIND_TLS_PROXY !== '1') throw configError('PUBLIC_BIND_REQUIRES_TLS_PROXY');
  const databasePath = process.env.BEFOREWORD_DATABASE_PATH || '';
  if (!path.isAbsolute(databasePath) || path.normalize(databasePath).split(path.sep).some(part => part.toLowerCase() === 'public_html') ||
      !/\.sqlite(?:3)?$/iu.test(databasePath)) throw configError('PRIVATE_DATABASE_PATH_REQUIRED');
  const networkSalt = process.env.BEFOREWORD_NETWORK_SALT || '';
  if (networkSalt.length < 32 || networkSalt.length > 256 || /[^\x21-\x7E]/u.test(networkSalt)) throw configError('NETWORK_SALT_REQUIRED');
  const trustedProxyIPs = new Set();
  const proxyList = process.env.BEFOREWORD_TRUSTED_PROXY_IPS || '';
  if (proxyList.length > 1024) throw configError('INVALID_PROXY_CONFIGURATION');
  for (const raw of proxyList.split(',').map(value => value.trim()).filter(Boolean)) {
    const ip = canonicalIP(raw);
    if (!ip || trustedProxyIPs.size >= 16) throw configError('INVALID_PROXY_CONFIGURATION');
    trustedProxyIPs.add(ip);
  }
  function lowerLimit(name, maximum) {
    const value = process.env[name] || String(maximum);
    if (!/^\d+$/u.test(value) || Number(value) < 1 || Number(value) > maximum) throw configError('INVALID_LIMIT_CONFIGURATION');
    return Number(value);
  }
  const dailyLimit = lowerLimit('BEFOREWORD_DAILY_LIMIT', 100);
  const monthlyLimit = lowerLimit('BEFOREWORD_MONTHLY_LIMIT', 1000);
  return { answerProfile, apiKey, model, host, port, loopback, allowFile, allowWebExtensionOrigins, origins, databasePath, networkSalt, trustedProxyIPs, dailyLimit, monthlyLimit };
}
module.exports = { readConfiguration, configuredOrigin, isWebExtensionOrigin, allowsOrigin };
