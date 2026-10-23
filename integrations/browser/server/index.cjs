#!/usr/bin/env node
'use strict';
const http = require('node:http');
const Core = require('../extension/analysis-core.js');
const { readConfiguration, allowsOrigin } = require('./config.cjs');
const { QuotaStore, TRIAL_LIMIT } = require('./store.cjs');
const { networkIdentifier } = require('./network.cjs');
const { parseAnswerInput, answerIdentity, answer, PROVIDERS, MAX_HISTORY, MAX_TOTAL_CHARS } = require('./answer.cjs');
const { answerProfileMetadata } = require('./answer-profile.cjs');
const MODEL = 'gpt-6.1-sol';
const UPSTREAM_URL = 'https://api.openai.com/v1/chat/completions';
const INPUT_BYTES = 64 * 1024;
const UPSTREAM_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 90_000;
const BODY_TIMEOUT_MS = 10_000;
function failure(code, status = 500, retryAfter) {
  const error = new Error(code); error.code = code; error.status = status;
  if (retryAfter !== undefined) error.retryAfter = retryAfter;
  return error;
}
function applyOrigin(request, response, configuration) {
  const origin = request.headers.origin;
  response.setHeader('Vary', 'Origin');
  if (origin === undefined) throw failure('ORIGIN_REQUIRED', 403);
  if (!allowsOrigin(origin, configuration)) throw failure('ORIGIN_NOT_ALLOWED', 403);
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Expose-Headers', 'Retry-After');
  return origin;
}
function bearerToken(request) {
  const header = request.headers.authorization;
  if (typeof header !== 'string' || !/^Bearer [A-Za-z0-9_-]{43}$/u.test(header)) throw failure('INVALID_SESSION', 401);
  return header.slice(7);
}
function writeJson(response, status, value, retryAfter) {
  if (response.destroyed || response.writableEnded) return;
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (retryAfter !== undefined) response.setHeader('Retry-After', String(retryAfter));
  response.end(JSON.stringify(value));
}

function readBody(request, signal, timeoutMs, maximumBytes = INPUT_BYTES) {
  return new Promise((resolve, reject) => {
    const declared = request.headers['content-length'];
    if (declared !== undefined && (!/^\d+$/u.test(declared) || Number(declared) > maximumBytes)) {
      request.resume(); reject(failure('BODY_TOO_LARGE', 413)); return;
    }
    let total = 0;
    const chunks = [];
    const timer = setTimeout(() => done(failure('BODY_TIMEOUT', 408)), timeoutMs);
    timer.unref?.();
    function cleanup() {
      clearTimeout(timer);
      request.removeListener('data', onData); request.removeListener('end', onEnd);
      request.removeListener('error', onError); signal.removeEventListener('abort', onAbort);
    }
    function done(error, value) { cleanup(); if (error) { request.resume(); reject(error); } else resolve(value); }
    function onData(chunk) {
      total += chunk.length;
      if (total > maximumBytes) { done(failure('BODY_TOO_LARGE', 413)); return; }
      chunks.push(chunk);
    }
    function onEnd() {
      try { done(null, new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, total))); }
      catch { done(failure('INVALID_INPUT', 400)); }
    }
    function onError() { done(failure('REQUEST_ABORTED', 499)); }
    function onAbort() { done(failure('REQUEST_ABORTED', 499)); }
    request.on('data', onData); request.on('end', onEnd); request.on('error', onError);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

function parseInput(raw) {
  let envelope;
  try { envelope = JSON.parse(raw); } catch { throw failure('INVALID_INPUT', 400); }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) ||
      !Object.hasOwn(envelope, 'text') || !Object.hasOwn(envelope, 'language') ||
      Object.keys(envelope).some(key => !['text', 'language', 'reportVersion', 'trialVersion'].includes(key)) ||
      (Object.hasOwn(envelope, 'reportVersion') && ![2, Core.REPORT_VERSION].includes(envelope.reportVersion)) ||
      (Object.hasOwn(envelope, 'trialVersion') && envelope.trialVersion !== 2)) {
    throw failure('INVALID_INPUT', 400);
  }
  const input = { text: envelope.text, language: envelope.language };
  try { Core.validateInput(input); } catch (error) {
    const allowed = new Set(['INVALID_INPUT', 'INPUT_TOO_LONG', 'EMPTY_INPUT', 'INVALID_LANGUAGE']);
    throw failure(allowed.has(error.code) ? error.code : 'INVALID_INPUT', 400);
  }
  rejectDuplicateFields(raw, envelope, 'INVALID_INPUT');
  return { input, reportVersion: envelope.reportVersion, trialLimit: envelope.trialVersion === 2 ? TRIAL_LIMIT : 6 };
}

// These envelopes contain only validated strings and optional numeric versions.
// Scan their written keys as well: JSON.parse would discard duplicates.
function rejectDuplicateFields(raw, envelope, code) {
  let at = raw.indexOf('{') + 1;
  const keys = new Set();
  const whitespace = () => { while (/[\t\r\n ]/u.test(raw[at] || '\0')) at += 1; };
  function stringToken() {
    if (raw[at] !== '"') throw failure(code, 400);
    const start = at++;
    while (at < raw.length && raw[at] !== '"') at += raw[at] === '\\' ? 2 : 1;
    at += 1;
    return JSON.parse(raw.slice(start, at));
  }
  while (at < raw.length) {
    whitespace(); if (raw[at] === '}') break;
    const key = stringToken();
    if (keys.has(key)) throw failure(code, 400);
    keys.add(key); whitespace(); at += 1; whitespace();
    if (key === 'reportVersion' || key === 'trialVersion') { while (/[\d.eE+-]/u.test(raw[at] || '\0')) at += 1; }
    else stringToken();
    whitespace();
    if (raw[at] === '}') break;
    at += 1;
  }
  if (keys.size !== Object.keys(envelope).length) throw failure(code, 400);
}

function parseSessionInput(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { throw failure('INVALID_SESSION_REQUEST', 400); }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !Object.hasOwn(value, 'installationId') || typeof value.installationId !== 'string' ||
      Object.keys(value).some(key => !['installationId', 'trialVersion'].includes(key)) ||
      (Object.hasOwn(value, 'trialVersion') && value.trialVersion !== 2)) {
    throw failure('INVALID_SESSION_REQUEST', 400);
  }
  rejectDuplicateFields(raw, value, 'INVALID_SESSION_REQUEST');
  return { installationId: value.installationId, trialLimit: value.trialVersion === 2 ? TRIAL_LIMIT : 6 };
}

async function readProviderBody(response) {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > UPSTREAM_BYTES)) {
    void response.body?.cancel().catch(() => {});
    throw failure('UPSTREAM_RESPONSE_TOO_LARGE', 502);
  }
  if (!response.body?.getReader) throw failure('UPSTREAM_INVALID_RESPONSE', 502);
  const reader = response.body.getReader();
  const chunks = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > UPSTREAM_BYTES) {
        await reader.cancel().catch(() => {});
        throw failure('UPSTREAM_RESPONSE_TOO_LARGE', 502);
      }
      chunks.push(value);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, total));
  } catch (error) {
    if (error.code === 'UPSTREAM_RESPONSE_TOO_LARGE') throw error;
    throw failure('UPSTREAM_INVALID_RESPONSE', 502);
  } finally { reader.releaseLock(); }
}

async function analyze(input, configuration, fetchImpl, signal, reportVersion = 1) {
  const prompt = Core.buildRequest(input, { reportVersion });
  const response = await fetchImpl(UPSTREAM_URL, {
    method: 'POST', redirect: 'error', signal,
    headers: { Authorization: `Bearer ${configuration.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: configuration.model, store: false, reasoning_effort: 'medium', max_completion_tokens: 8192,
      messages: [{ role: 'developer', content: prompt.system }, { role: 'user', content: prompt.user }],
      response_format: { type: 'json_schema', json_schema: { name: 'beforeword_analysis', strict: true, schema: Core.schemaForVersion(reportVersion) } },
    }),
  });
  if (!response.ok) {
    // Error bodies may contain submitted text or provider diagnostics. Never read them.
    void response.body?.cancel().catch(() => {});
    throw failure(response.status === 429 ? 'UPSTREAM_RATE_LIMITED' : 'UPSTREAM_UNAVAILABLE', 502);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!/^application\/json(?:\s*;|$)/iu.test(contentType)) {
    void response.body?.cancel().catch(() => {});
    throw failure('UPSTREAM_INVALID_RESPONSE', 502);
  }
  let envelope;
  try { envelope = JSON.parse(await readProviderBody(response)); }
  catch (error) { if (error.code) throw error; throw failure('UPSTREAM_INVALID_RESPONSE', 502); }
  const choice = envelope?.choices?.[0];
  if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') throw failure('MODEL_REFUSAL', 502);
  if (choice?.finish_reason === 'length') throw failure('MODEL_OUTPUT_INCOMPLETE', 502);
  if (!Array.isArray(envelope?.choices) || envelope.choices.length !== 1 || choice?.finish_reason !== 'stop' ||
      choice?.message?.tool_calls?.length || typeof choice?.message?.content !== 'string') {
    throw failure('UPSTREAM_INVALID_RESPONSE', 502);
  }
  const raw = choice.message.content;
  try {
    const checked = Core.validateReport(raw, input);
    if (checked.items.some(item => Object.hasOwn(item, 'grounds') !== (reportVersion < 3))) {
      throw failure('INVALID_REPORT', 502);
    }
  }
  catch (error) {
    // Return only bounded categories; never expose the raw model response or
    // validator diagnostics. All failed reports still release their lease.
    throw failure(error?.code === 'INVALID_CITATION' ? 'INVALID_CITATION' : error?.code === 'REPORT_TOO_LARGE' ? 'RESPONSE_TOO_LARGE' : 'INVALID_REPORT', 502);
  }
  // Core adds derived offsets; return only the raw schema for browser validation.
  return { report: JSON.parse(raw), model: configuration.model };
}

function createAnalysisServer({ fetchImpl = globalThis.fetch, now = Date.now,
  upstreamTimeoutMs = UPSTREAM_TIMEOUT_MS, bodyTimeoutMs = BODY_TIMEOUT_MS, shutdownSignal, passengerMode = false } = {}) {
  const configuration = readConfiguration();
  configuration.passenger = Boolean(global.PhusionPassenger) && passengerMode === true;
  const store = new QuotaStore(configuration, { now });
  const activeControllers = new Set();
  // Response replay is intentionally ephemeral. SQLite contains only keyed
  // request fingerprints and states, never prompts, answers or API keys.
  const answerCache = new Map();
  function forgetAnswer(id) {
    const entry = answerCache.get(id);
    if (entry) clearTimeout(entry.timer);
    answerCache.delete(id);
  }
  function cachedAnswer(id) {
    for (const [key, entry] of answerCache) if (entry.expiresAt <= now()) forgetAnswer(key);
    return answerCache.get(id)?.result;
  }
  function cacheAnswer(id, result) {
    cachedAnswer(id);
    if (answerCache.size >= 64) forgetAnswer(answerCache.keys().next().value);
    const timer = setTimeout(() => forgetAnswer(id), 15 * 60 * 1000); timer.unref?.();
    answerCache.set(id, { result, expiresAt: now() + 15 * 60 * 1000, timer });
  }
  let receiving = 0;
  const abortAll = () => { for (const controller of activeControllers) controller.abort(); };
  shutdownSignal?.addEventListener('abort', abortAll, { once: true });
  const server = http.createServer({ maxHeaderSize: 8192 }, async (request, response) => {
    let controller; let deadline; let timedOut = false; let admitted = false; let lease; let answerReceipt; let replayTrial;
    request.on('error', () => {});
    try {
      const origin = applyOrigin(request, response, configuration);
      const requestPath = request.url;
      const allowedMethod = ['/api/analyze', '/api/session', '/api/answer', '/api/answer/personal'].includes(requestPath) ? 'POST' :
        ['/health', '/api/capabilities'].includes(requestPath) ? 'GET' : null;
      if (request.method === 'OPTIONS') {
        const requestedHeaders = String(request.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
        if (!allowedMethod || request.headers['access-control-request-method'] !== allowedMethod ||
            requestedHeaders.some(header => !['authorization', 'content-type'].includes(header))) throw failure('PREFLIGHT_NOT_ALLOWED', 403);
        response.statusCode = 204;
        response.setHeader('Access-Control-Allow-Methods', allowedMethod);
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        response.setHeader('Access-Control-Max-Age', '600');
        response.setHeader('Cache-Control', 'no-store'); response.end(); return;
      }
      if (!allowedMethod) throw failure('NOT_FOUND', 404);
      if (request.method !== allowedMethod) { response.setHeader('Allow', allowedMethod); throw failure('METHOD_NOT_ALLOWED', 405); }
      if (requestPath === '/health') { store.health(); writeJson(response, 200, { ready: Boolean(configuration.apiKey.trim()) }); return; }
      if (requestPath === '/api/capabilities') {
        const instructionProfile = answerProfileMetadata(configuration.answerProfile);
        store.health(); writeJson(response, 200, { answer: true, personalProviders: Object.keys(PROVIDERS),
          historyMessages: MAX_HISTORY, conversationChars: MAX_TOTAL_CHARS, trialLimit: TRIAL_LIMIT, idempotencyHours: 168,
          ...(instructionProfile ? { instructionProfile } : {}) }); return;
      }
      if (requestPath !== '/api/answer/personal' && !configuration.apiKey.trim()) throw failure('SERVICE_NOT_CONFIGURED', 503);
      if (shutdownSignal?.aborted) throw failure('SERVICE_UNAVAILABLE', 503);
      if (!/^application\/json(?:\s*;|$)/iu.test(String(request.headers['content-type'] || '')) ||
          (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity')) throw failure('UNSUPPORTED_MEDIA_TYPE', 415);
      const network = networkIdentifier(request, configuration);
      let token;
      if (['/api/analyze', '/api/answer'].includes(requestPath)) {
        token = bearerToken(request);
        store.authorize(token, network, origin); // All refreshable 401s precede provider work.
      }
      if (receiving >= 8) throw failure('SERVICE_BUSY', 429, 2);
      receiving += 1; admitted = true;
      controller = new AbortController(); activeControllers.add(controller);
      request.once('aborted', () => controller.abort());
      response.once('close', () => { if (!response.writableEnded) controller.abort(); });
      const raw = await readBody(request, controller.signal, bodyTimeoutMs, requestPath === '/api/session' ? 1024 : INPUT_BYTES);
      if (controller.signal.aborted) throw failure('REQUEST_ABORTED', 499);
      if (requestPath === '/api/session') {
        const { installationId, trialLimit } = parseSessionInput(raw);
        writeJson(response, 200, store.issue(network, origin, installationId, trialLimit)); return;
      }
      if (['/api/answer', '/api/answer/personal'].includes(requestPath)) {
        const personal = requestPath === '/api/answer/personal';
        const input = parseAnswerInput(raw, personal);
        const identity = answerIdentity(input, configuration, personal, origin);
        const reservation = store.reserveAnswer({ token, network, origin, identity, personal });
        replayTrial = reservation.trial;
        if (reservation.state === 'completed') {
          const cached = cachedAnswer(reservation.id);
          if (cached) { writeJson(response, 200, { ...cached, trial: reservation.trial }); return; }
          throw failure('REQUEST_ALREADY_COMPLETED', 409);
        }
        if (reservation.state === 'started') throw failure('REQUEST_IN_PROGRESS', 409, 2);
        if (reservation.state === 'interrupted') throw failure('REQUEST_INTERRUPTED', 409);
        if (reservation.state === 'failed') throw failure(reservation.errorCode, reservation.errorStatus);
        lease = reservation.lease; answerReceipt = reservation.id;
        deadline = setTimeout(() => { timedOut = true; controller.abort(); }, upstreamTimeoutMs);
        deadline.unref?.();
        const result = await answer(input, configuration, fetchImpl, controller.signal, readProviderBody, personal);
        if (controller.signal.aborted) throw failure(timedOut ? 'UPSTREAM_TIMEOUT' : 'REQUEST_ABORTED', timedOut ? 504 : 499);
        const trial = store.finishAnswer(answerReceipt, lease, personal);
        const completed = { ...result, ...(personal ? { provider: input.provider } : {}), trial };
        lease = null;
        cacheAnswer(answerReceipt, completed);
        writeJson(response, 200, completed); return;
      }
      const { input, reportVersion, trialLimit } = parseInput(raw);
      lease = store.acquire(token, network, origin, trialLimit);
      deadline = setTimeout(() => { timedOut = true; controller.abort(); }, upstreamTimeoutMs);
      deadline.unref?.();
      const result = await analyze(input, configuration, fetchImpl, controller.signal, reportVersion ?? 1);
      if (controller.signal.aborted) throw failure(timedOut ? 'UPSTREAM_TIMEOUT' : 'REQUEST_ABORTED', timedOut ? 504 : 499);
      // Versionless clients require strings in these fields. The provider uses
      // the legacy schema for them; compact reports are never padded with filler.
      if (reportVersion === undefined) result.report = Core.toLegacyReport(result.report, input);
      // Only a validated completion consumes a trial analysis. Commit before replying
      // so disconnect/retry cannot turn an already completed analysis into a free one.
      const balance = store.complete(lease); lease = null;
      const trial = { limit: trialLimit, remaining: Math.max(0, trialLimit - (TRIAL_LIMIT - balance.remaining)) };
      writeJson(response, 200, { ...result, trial });
    } catch (error) {
      const safeCodes = new Set([
        'ORIGIN_REQUIRED', 'ORIGIN_NOT_ALLOWED', 'PREFLIGHT_NOT_ALLOWED', 'INVALID_SESSION', 'SESSION_EXPIRED', 'INVALID_SESSION_REQUEST',
        'NOT_FOUND', 'METHOD_NOT_ALLOWED', 'SERVICE_NOT_CONFIGURED', 'SERVICE_UNAVAILABLE', 'SERVICE_BUSY', 'STORE_UNAVAILABLE',
        'SESSION_LIMIT', 'NETWORK_LIMIT', 'SESSION_ISSUANCE_LIMIT', 'DAILY_LIMIT', 'MONTHLY_LIMIT', 'TRIAL_EXHAUSTED', 'UNSUPPORTED_MEDIA_TYPE',
        'BODY_TOO_LARGE', 'BODY_TIMEOUT', 'INVALID_INPUT', 'INPUT_TOO_LONG', 'EMPTY_INPUT', 'INVALID_LANGUAGE',
        'REQUEST_ABORTED', 'UPSTREAM_TIMEOUT', 'UPSTREAM_RATE_LIMITED', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_RESPONSE_TOO_LARGE',
        'UPSTREAM_INVALID_RESPONSE', 'MODEL_REFUSAL', 'MODEL_OUTPUT_INCOMPLETE', 'INVALID_REPORT', 'INVALID_CITATION', 'RESPONSE_TOO_LARGE',
        'ANSWER_PROFILE_UNAVAILABLE', 'INVALID_ANSWER_PROFILE_CONFIGURATION', 'INVALID_HISTORY', 'CONVERSATION_TOO_LONG', 'INVALID_MODEL', 'INVALID_API_KEY', 'UNSUPPORTED_PROVIDER', 'PROVIDER_AUTH',
        'REQUEST_ID_CONFLICT', 'REQUEST_ALREADY_COMPLETED', 'REQUEST_IN_PROGRESS', 'REQUEST_INTERRUPTED', 'INSTRUCTIONS_UNAVAILABLE',
      ]);
      const mapped = timedOut ? failure('UPSTREAM_TIMEOUT', 504) :
        controller?.signal.aborted ? failure('REQUEST_ABORTED', 499) :
          safeCodes.has(error?.code) ? error : failure('UPSTREAM_UNAVAILABLE', 502);
      if (mapped.status === 401) response.setHeader('WWW-Authenticate', 'Bearer');
      if (answerReceipt && lease) {
        try { store.failAnswer(answerReceipt, lease, mapped.code, mapped.status); lease = null; } catch {}
      }
      const trial = mapped.code === 'TRIAL_EXHAUSTED' ? mapped.trial : replayTrial;
      writeJson(response, mapped.status, { error: { code: mapped.code }, ...(trial ? { trial } : {}) }, mapped.retryAfter);
      request.resume();
    } finally {
      clearTimeout(deadline);
      if (lease) { try { store.release(lease); } catch {} } // Failed cleanup leaves a conservative expiring lease.
      if (controller) activeControllers.delete(controller);
      if (admitted) receiving -= 1;
    }
  });
  server.headersTimeout = 10_000; server.requestTimeout = 15_000; server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 32; server.maxRequestsPerSocket = 20; server.maxConnections = 64;
  server.on('close', () => {
    abortAll(); for (const id of answerCache.keys()) forgetAnswer(id);
    shutdownSignal?.removeEventListener('abort', abortAll); store.close();
  });
  server.on('clientError', (_error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
  return server;
}
function startServer() {
  try {
    const configuration = readConfiguration();
    const shutdown = new AbortController();
    const server = createAnalysisServer({ shutdownSignal: shutdown.signal, passengerMode: Boolean(global.PhusionPassenger) });
    server.once('error', () => { process.stderr.write('beforeword service could not listen (LISTEN_FAILED).\n'); process.exitCode = 1; });
    if (global.PhusionPassenger) server.listen('passenger', () => { process.stdout.write('beforeword analysis service started.\n'); });
    else server.listen(configuration.port, configuration.host, () => { process.stdout.write('beforeword analysis service started.\n'); });
    const stop = () => { shutdown.abort(); server.close(); server.closeIdleConnections(); };
    process.once('SIGTERM', stop); process.once('SIGINT', stop);
    return server;
  } catch (error) {
    const known = new Set(['NODE_24_REQUIRED', 'ANSWER_PROFILE_UNAVAILABLE', 'INVALID_ANSWER_PROFILE_CONFIGURATION', 'INVALID_API_KEY_CONFIGURATION', 'INVALID_BIND_CONFIGURATION', 'INVALID_PORT_CONFIGURATION',
      'FILE_ORIGIN_REQUIRES_LOOPBACK', 'INVALID_ORIGIN_CONFIGURATION', 'ALLOWED_ORIGINS_REQUIRED', 'PUBLIC_BIND_REQUIRES_HTTPS_ORIGINS',
      'PUBLIC_BIND_REQUIRES_TLS_PROXY', 'PRIVATE_DATABASE_PATH_REQUIRED', 'NETWORK_SALT_REQUIRED', 'INVALID_PROXY_CONFIGURATION', 'INVALID_LIMIT_CONFIGURATION', 'STORE_UNAVAILABLE']);
    process.stderr.write(`beforeword service could not start (${known.has(error?.code) ? error.code : 'CONFIGURATION_ERROR'}).\n`);
    process.exitCode = 1; return null;
  }
}
if (require.main === module) {
  if (global.PhusionPassenger) global.PhusionPassenger.configure({ autoInstall: false });
  startServer();
}
module.exports = { createAnalysisServer, startServer, analyze, MODEL, UPSTREAM_URL };
