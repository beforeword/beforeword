#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { fork, spawnSync } = require('node:child_process');
const { createAnalysisServer, MODEL, UPSTREAM_URL } = require('../server/index.cjs');
const { resetAllowance } = require('../tools/reset-allowance.cjs');
const { readConfiguration } = require('../server/config.cjs');
const { QuotaStore, tokenHash, installationHash, SESSION_TTL, LEASE_TTL, POLICY, TRIAL_LIMIT } = require('../server/store.cjs');
const { clientAddress, networkIdentifier } = require('../server/network.cjs');
const Core = require('../extension/analysis-core.js');
const KEY = 'fixture-key-no-real-credentials';
const SALT = 'fixture-network-salt-not-a-real-secret-123456789';
const ORIGIN = 'https://beforeword.example';
const EXTENSION_ORIGIN = 'chrome-extension://' + 'a'.repeat(32);
const INPUT = { text: 'Жизнь — слово.\r\nЖизнь.', language: 'ru' };
const INITIAL = Date.UTC(2026, 0, 1, 12);
const ENV_KEYS = ['OPENAI_API_KEY', 'BEFOREWORD_HOST', 'BEFOREWORD_PORT', 'PORT', 'BEFOREWORD_ALLOWED_ORIGINS',
  'BEFOREWORD_ALLOW_FILE_ORIGIN', 'BEFOREWORD_BEHIND_TLS_PROXY', 'BEFOREWORD_DATABASE_PATH', 'BEFOREWORD_NETWORK_SALT',
  'BEFOREWORD_TRUSTED_PROXY_IPS', 'BEFOREWORD_DAILY_LIMIT', 'BEFOREWORD_MONTHLY_LIMIT'];
function environment(databasePath, overrides = {}) {
  return { OPENAI_API_KEY: KEY, BEFOREWORD_HOST: '127.0.0.1', BEFOREWORD_PORT: '8787',
    BEFOREWORD_ALLOWED_ORIGINS: ORIGIN, BEFOREWORD_DATABASE_PATH: databasePath, BEFOREWORD_NETWORK_SALT: SALT, ...overrides };
}
function withEnv(values, callback) {
  const previous = new Map(ENV_KEYS.map(key => [key, process.env[key]]));
  try {
    for (const key of ENV_KEYS) { if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key]; }
    return callback();
  } finally { for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}
function report() { return { language: 'ru', items: [{ quote: { text: 'Жизнь', occurrence: 1 },
  reading: 'Возможное чтение этой записи.', attribution: 'Предложенное отношение между написаниями.',
  grounds: { kind: 'not_supplied', explanation: 'Дополнительное основание в записи не предъявлено.', citations: [] },
  limit: 'Это предложенное чтение; цитата не устанавливает его выводов.' }] }; }
const completion = (value = report()) => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });
const listen = server => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const network = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const installation = value => crypto.createHash('sha256').update('fixture-installation:' + String(value)).digest('base64url');
async function errorResponse(response, status, code) {
  assert.equal(response.status, status); assert.deepEqual(await response.json(), { error: { code },
    ...(code === 'TRIAL_EXHAUSTED' ? { trial: { limit: 8, remaining: 0 } } : {}) });
}
function storeFixture(overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'beforeword-store-'));
  const env = environment(path.join(directory, 'quota.sqlite'), overrides);
  const config = withEnv(env, readConfiguration);
  const clock = { value: INITIAL }; const stores = [];
  return { directory, env, config, clock,
    open() { const store = new QuotaStore(config, { now: () => clock.value }); stores.push(store); return store; },
    stop() { for (const store of stores) store.close(); fs.rmSync(directory, { recursive: true, force: true }); } };
}
async function fixture({ env = {}, providerHandler, fetchImpl, upstreamTimeoutMs, bodyTimeoutMs, count = 1 } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'beforeword-http-'));
  const values = environment(path.join(directory, 'quota.sqlite'), env);
  const calls = []; const clock = { value: INITIAL }; const servers = [];
  const provider = http.createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    calls.push({ path: request.url, headers: request.headers, body: JSON.parse(body) });
    if (providerHandler) return providerHandler(request, response, calls.at(-1));
    response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(completion()));
  });
  await listen(provider);
  const shutdown = new AbortController();
  const transport = fetchImpl || ((url, options) => {
    assert.equal(url, UPSTREAM_URL); assert.equal(options.redirect, 'error');
    return fetch(`http://127.0.0.1:${provider.address().port}/fixture-provider`, options);
  });
  async function addServer() {
    const server = withEnv(values, () => createAnalysisServer({ fetchImpl: transport, now: () => clock.value,
      upstreamTimeoutMs, bodyTimeoutMs, shutdownSignal: shutdown.signal }));
    await listen(server); servers.push(server); return servers.length - 1;
  }
  for (let index = 0; index < count; index += 1) await addServer();
  let cachedToken;
  async function request({ path: requestPath = '/api/analyze', method = 'POST', input = { ...INPUT, trialVersion: 2 }, body,
    token, origin = ORIGIN, headers = {}, signal, serverIndex = 0 } = {}) {
    if (requestPath === '/api/analyze' && method === 'POST' && token === undefined) {
      if (!cachedToken) { const response = await session(); assert.equal(response.status, 200); cachedToken = (await response.json()).token; }
      token = cachedToken;
    }
    const sentHeaders = { ...headers };
    if (token !== undefined && token !== null) sentHeaders.Authorization = `Bearer ${token}`;
    if (origin !== null) sentHeaders.Origin = origin;
    if (method === 'POST' && sentHeaders['Content-Type'] === undefined) sentHeaders['Content-Type'] = 'application/json';
    return fetch(`http://127.0.0.1:${servers[serverIndex].address().port}${requestPath}`, { method, headers: sentHeaders,
      body: method === 'POST' ? (body === undefined ? JSON.stringify(input) : body) : undefined, signal });
  }
  const installationId = crypto.randomBytes(32).toString('base64url');
  const session = options => request({ path: '/api/session', input: { installationId, trialVersion: 2 }, ...options });
  function trialRows() {
    const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(values.BEFOREWORD_DATABASE_PATH);
    try { return db.prepare('SELECT * FROM trials').all().map(row => ({ ...row })); } finally { db.close(); }
  }
  return { calls, servers, directory, values, clock, shutdown, request, session, addServer, installationId, trialRows,
    async stop() { shutdown.abort(); for (const server of servers) if (server.listening) await close(server); await close(provider); fs.rmSync(directory, { recursive: true, force: true }); } };
}

if (process.argv[2] === 'quota-worker') {
  const store = new QuotaStore(readConfiguration(), { now: () => INITIAL });
  process.on('message', message => {
    if (message.command === 'stop') { store.close(); process.exit(0); }
    try {
      const lease = store.acquire(message.token, message.network, ORIGIN);
      process.send({ id: message.id, ok: true, lease });
    } catch (error) { process.send({ id: message.id, ok: false, code: error.code }); }
  });
  process.send({ ready: true });
} else {
const test = require('node:test');
test('anonymous session has a bounded random token, 24-hour expiry, and sends no text upstream', async () => {
  const app = await fixture();
  try {
    const response = await app.session(); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const session = await response.json(); assert.match(session.token, /^[A-Za-z0-9_-]{43}$/u);
    assert.equal(session.expiresAt, INITIAL + SESSION_TTL); assert.deepEqual(session.trial, { limit: 8, remaining: 8 });
    const other = await (await app.session()).json(); assert.notEqual(other.token, session.token);
    for (const input of [{}, { text: 'must never be accepted' }, null, [], '', { installationId: 'short' },
      { installationId: 'A'.repeat(42) + '=' }, { installationId: 'A'.repeat(42) + 'B' },
      { installationId: app.installationId, extra: true }, { installationId: 123 }]) {
      await errorResponse(await app.session({ input }), 400, 'INVALID_SESSION_REQUEST');
    }
    for (const body of [
      `{"installationId":"${app.installationId}","installationId":"${app.installationId}"}`,
      `{"installation\\u0049d":"${app.installationId}","installationId":"${app.installationId}"}`,
    ]) await errorResponse(await app.session({ body }), 400, 'INVALID_SESSION_REQUEST');
    await errorResponse(await app.session({ body: 'x'.repeat(1025) }), 413, 'BODY_TOO_LARGE');
    assert.equal(app.calls.length, 0);
  } finally { await app.stop(); }
});
test('analysis uses fixed model/schema, exact input and raw validated report without derived offsets', async () => {
  const app = await fixture();
  try {
    const response = await app.request(); assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN);
    assert.deepEqual(await response.json(), { report: report(), model: MODEL, trial: { limit: 8, remaining: 7 } });
    assert.equal(app.calls.length, 1); const upstream = app.calls[0];
    assert.equal(upstream.headers.authorization, `Bearer ${KEY}`);
    assert.equal(upstream.headers.origin, undefined);
    assert.deepEqual(upstream.body.messages, [{ role: 'developer', content: Core.buildRequest(INPUT, { reportVersion: 1 }).system }, { role: 'user', content: JSON.stringify(INPUT) }]);
    assert.equal(upstream.body.model, 'gpt-6.1-sol'); assert.equal(upstream.body.store, false);
    assert.equal(upstream.body.reasoning_effort, 'medium', 'The service explicitly uses its reviewed reasoning setting');
    assert.equal(upstream.body.max_completion_tokens, 8192, 'Changing service reasoning preserves the completion-token bound');
    assert.ok(!JSON.stringify(upstream).includes(app.installationId));
    assert.deepEqual(upstream.body.response_format, { type: 'json_schema', json_schema: { name: 'beforeword_analysis', strict: true, schema: Core.legacySchema } });
  } finally { await app.stop(); }
});
test('versioned requests preserve legacy clients and deliver compact v3 without fabricated grounds', async () => {
  for (const version of [2, 3]) {
    const compact = { language: 'ru', items: [{ quote: { text: 'Жизнь', occurrence: 1 }, reading: 'Написанное «Жизнь» остаётся написанным.' }] };
    const expected = version === 3 ? compact : report();
    const app = await fixture({ providerHandler(_request, response, call) {
      assert.deepEqual(call.body.response_format.json_schema.schema, version === 3 ? Core.schema : Core.legacySchema);
      assert.equal(call.body.messages[0].content, Core.buildRequest(INPUT, { reportVersion: version }).system);
      response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(completion(expected)));
    } });
    try {
      const response = await app.request({ input: { ...INPUT, trialVersion: 2, reportVersion: version } });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).report, expected);
      assert.equal(app.calls.length, 1);
      assert.equal(app.trialRows()[0].completed, 1);
      for (const unsupported of [0, 1, 4, '3', null]) {
        await errorResponse(await app.request({ input: { ...INPUT, trialVersion: 2, reportVersion: unsupported } }), 400, 'INVALID_INPUT');
      }
      assert.equal(app.calls.length, 1);
    } finally { await app.stop(); }
  }
});
test('provider response for a different report version is rejected without charging a completion', async () => {
  for (const version of [2, 3]) {
    const wrong = version === 2 ? { language: 'ru', items: [{ quote: { text: 'Жизнь', occurrence: 1 }, reading: 'Written form.' }] } : report();
    const app = await fixture({ providerHandler(_request, response) {
      response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(completion(wrong)));
    } });
    try {
      await errorResponse(await app.request({ input: { ...INPUT, trialVersion: 2, reportVersion: version } }), 502, 'INVALID_REPORT');
      assert.equal(app.calls.length, 1);
      assert.equal(app.trialRows()[0].completed, 0);
    } finally { await app.stop(); }
  }
});
test('disconnect aborts upstream and retains the spent request in durable accounting', async () => {
  let arrived; const arrival = new Promise(resolve => { arrived = resolve; }); let providerClosed = false;
  const app = await fixture({ providerHandler(_request, response) { response.once('close', () => { providerClosed = true; }); arrived(); } });
  try {
    const controller = new AbortController(); const pending = app.request({ signal: controller.signal }).catch(error => error.name);
    await arrival; controller.abort(); assert.equal(await pending, 'AbortError'); await pause(35); assert.equal(providerClosed, true);
    const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(app.values.BEFOREWORD_DATABASE_PATH);
    assert.equal(db.prepare('SELECT used FROM sessions').get().used, 1); assert.equal(db.prepare('SELECT count(*) AS n FROM leases').get().n, 0); db.close();
    assert.equal(app.trialRows()[0].completed, 0);
  } finally { await app.stop(); }
});
test('two HTTP workers share sessions, concurrency leases and request counters', async () => {
  const held = []; let ready; const both = new Promise(resolve => { ready = resolve; });
  const app = await fixture({ count: 2, providerHandler(_request, response) { held.push(response); if (held.length === 2) ready(); } });
  try {
    const token = (await (await app.session()).json()).token;
    const first = app.request({ token }); const second = app.request({ token, serverIndex: 1 }); await both;
    const third = await app.request({ token, serverIndex: 1 }); assert.equal(third.headers.get('retry-after'), '2');
    assert.equal(third.headers.get('access-control-expose-headers'), 'Retry-After'); await errorResponse(third, 429, 'SERVICE_BUSY');
    for (const response of held) { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(completion())); }
    assert.equal((await first).status, 200); assert.equal((await second).status, 200); assert.equal(app.calls.length, 2);
  } finally { await app.stop(); }
});
test('eight completed analyses survive new sessions, worker restart and session expiry; the ninth never reaches the provider', async () => {
  const app = await fixture();
  try {
    let token = (await (await app.session()).json()).token;
    async function success(remaining, serverIndex = 0) {
      const response = await app.request({ token, serverIndex }); assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).trial, { limit: 8, remaining });
    }
    await success(7); await success(6);
    const refreshed = await (await app.session()).json(); token = refreshed.token;
    assert.deepEqual(refreshed.trial, { limit: 8, remaining: 6 }); await success(5);
    await close(app.servers[0]); const restarted = await app.addServer();
    await success(4, restarted); await success(3, restarted); await success(2, restarted); await success(1, restarted);
    app.clock.value += SESSION_TTL;
    await errorResponse(await app.request({ token, serverIndex: restarted }), 401, 'SESSION_EXPIRED');
    const renewed = await (await app.session({ serverIndex: restarted })).json(); token = renewed.token;
    assert.deepEqual(renewed.trial, { limit: 8, remaining: 1 }); await success(0, restarted);
    await errorResponse(await app.request({ token, serverIndex: restarted }), 429, 'TRIAL_EXHAUSTED');
    await errorResponse(await app.session({ serverIndex: restarted }), 429, 'TRIAL_EXHAUSTED');
    assert.equal(app.calls.length, 8); assert.equal(app.trialRows().length, 1); assert.equal(app.trialRows()[0].completed, 8);
    assert.equal(app.trialRows()[0].installation_hash, installationHash(app.installationId));
    assert.ok(!JSON.stringify(app.trialRows()).includes(app.installationId));
    // A genuinely new installation has its own allowance; this is not an account identity.
    const fresh = await (await app.session({ serverIndex: restarted, input: { installationId: installation('reinstalled'), trialVersion: 2 } })).json();
    assert.deepEqual(fresh.trial, { limit: 8, remaining: 8 });
  } finally { await app.stop(); }
});
test('a pending last trial slot blocks another worker, then a refusal releases it without charging a success', async () => {
  let holding = false; let heldResponse; let arrived;
  const arrival = new Promise(resolve => { arrived = resolve; });
  const app = await fixture({ count: 2, providerHandler(_request, response) {
    if (holding) { heldResponse = response; arrived(); return; }
    response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(completion()));
  } });
  try {
    const token = (await (await app.session()).json()).token;
    for (let index = 0; index < 7; index += 1) assert.equal((await app.request({ token })).status, 200);
    holding = true; const pending = app.request({ token }); await arrival;
    await errorResponse(await app.request({ token, serverIndex: 1 }), 429, 'SERVICE_BUSY');
    assert.equal(app.calls.length, 8); assert.equal(app.trialRows()[0].completed, 7);
    const pendingSession = await (await app.session({ serverIndex: 1 })).json();
    assert.deepEqual(pendingSession.trial, { limit: 8, remaining: 1 });
    heldResponse.writeHead(200, { 'Content-Type': 'application/json' });
    heldResponse.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { refusal: 'Fixture refusal' } }] }));
    await errorResponse(await pending, 502, 'MODEL_REFUSAL'); assert.equal(app.trialRows()[0].completed, 7);
    holding = false;
    const final = await app.request({ token: pendingSession.token, serverIndex: 1 }); assert.equal(final.status, 200);
    assert.deepEqual((await final.json()).trial, { limit: 8, remaining: 0 });
    await errorResponse(await app.request({ token }), 429, 'TRIAL_EXHAUSTED');
    assert.equal(app.calls.length, 9); assert.equal(app.trialRows()[0].completed, 8);
  } finally { await app.stop(); }
});
test('shutdown aborts a pending analysis and releases the trial reservation without consuming a success', async () => {
  let arrived; const arrival = new Promise(resolve => { arrived = resolve; });
  const app = await fixture({ providerHandler() { arrived(); } });
  try {
    const pending = app.request(); await arrival; app.shutdown.abort();
    await errorResponse(await pending, 499, 'REQUEST_ABORTED'); assert.equal(app.trialRows()[0].completed, 0);
    const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(app.values.BEFOREWORD_DATABASE_PATH);
    assert.equal(db.prepare('SELECT count(*) AS n FROM leases').get().n, 0);
    assert.equal(db.prepare('SELECT used FROM sessions').get().used, 1); db.close();
  } finally { await app.stop(); }
});
test('failed attempts and spoofed forwarded headers still consume network budgets across sessions and restart', async () => {
  const app = await fixture({ providerHandler(_request, response) { response.writeHead(503); response.end(); } });
  try {
    const first = (await (await app.session()).json()).token;
    for (let index = 0; index < 10; index += 1) await errorResponse(await app.request({ token: first, headers: { 'X-Forwarded-For': `192.0.2.${index}` } }), 502, 'UPSTREAM_UNAVAILABLE');
    await errorResponse(await app.request({ token: first }), 429, 'SESSION_LIMIT');
    const second = (await (await app.session()).json()).token;
    await errorResponse(await app.request({ token: second }), 429, 'NETWORK_LIMIT');
    await close(app.servers[0]); const index = await app.addServer();
    await errorResponse(await app.request({ token: second, serverIndex: index }), 429, 'NETWORK_LIMIT'); assert.equal(app.calls.length, 10);
    app.clock.value += 3600000; await errorResponse(await app.request({ token: second, serverIndex: index }), 502, 'UPSTREAM_UNAVAILABLE');
    assert.equal(app.trialRows()[0].completed, 0);
  } finally { await app.stop(); }
});
test('legacy six-report clients retain their exact allowance and upgrade to eight on the same ledger', async () => {
  const app = await fixture();
  try {
    const legacy = await (await app.session({ input: { installationId: app.installationId } })).json();
    assert.deepEqual(legacy.trial, { limit: 6, remaining: 6 });
    for (let remaining = 5; remaining >= 0; remaining -= 1) {
      const result = await app.request({ token: legacy.token, input: INPUT });
      assert.equal(result.status, 200);
      assert.deepEqual((await result.json()).trial, { limit: 6, remaining });
    }
    const blocked = await app.request({ token: legacy.token, input: INPUT });
    assert.equal(blocked.status, 429);
    assert.deepEqual(await blocked.json(), { error: { code: 'TRIAL_EXHAUSTED' }, trial: { limit: 6, remaining: 0 } });
    assert.equal(app.calls.length, 6);
    const current = await (await app.session()).json();
    assert.deepEqual(current.trial, { limit: 8, remaining: 2 });
    for (let remaining = 1; remaining >= 0; remaining -= 1) {
      const result = await app.request({ token: legacy.token }); assert.equal(result.status, 200);
      assert.deepEqual((await result.json()).trial, { limit: 8, remaining });
    }
    await errorResponse(await app.request({ token: current.token }), 429, 'TRIAL_EXHAUSTED');
    assert.equal(app.calls.length, 8); assert.equal(app.trialRows().length, 1);
  } finally { await app.stop(); }
});
test('trial version accepts only numeric two and rejects duplicate written keys before provider work', async () => {
  const app = await fixture();
  try {
    const token = (await (await app.session()).json()).token;
    for (const trialVersion of [null, '2', 1, 3, true, [], {}]) {
      await errorResponse(await app.session({ input: { installationId: app.installationId, trialVersion } }), 400, 'INVALID_SESSION_REQUEST');
      await errorResponse(await app.request({ token, input: { ...INPUT, trialVersion } }), 400, 'INVALID_INPUT');
    }
    for (const key of ['trialVersion', 'trial\\u0056ersion']) {
      await errorResponse(await app.session({ body: `{"installationId":"${app.installationId}","trialVersion":2,"${key}":2}` }), 400, 'INVALID_SESSION_REQUEST');
      await errorResponse(await app.request({ token, body: `{"text":"x","language":"en","trialVersion":2,"${key}":2}` }), 400, 'INVALID_INPUT');
    }
    const reordered = await app.session({ body: `{"trialVersion":2,"installationId":"${app.installationId}"}` });
    assert.equal(reordered.status, 200); assert.deepEqual((await reordered.json()).trial, { limit: 8, remaining: 8 });
    assert.equal(app.calls.length, 0);
  } finally { await app.stop(); }
});
test('version-two migration preserves every trial, session, counter and active lease while extending six to eight', () => {
  const app = storeFixture();
  try {
    const { DatabaseSync } = require('node:sqlite'); const old = new DatabaseSync(app.config.databasePath);
    old.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE trials (installation_hash TEXT PRIMARY KEY, origin TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0 CHECK(completed BETWEEN 0 AND 6));
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, network_hash TEXT NOT NULL, origin TEXT NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, installation_hash TEXT REFERENCES trials(installation_hash));
      CREATE TABLE counters (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE leases (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, installation_hash TEXT REFERENCES trials(installation_hash));
      CREATE INDEX leases_installation ON leases(installation_hash);`);
    old.prepare('INSERT INTO metadata VALUES(?,?)').run('version', '2');
    old.prepare('INSERT INTO metadata VALUES(?,?)').run('salt_fingerprint', crypto.createHash('sha256').update('beforeword-store-salt-v1\0' + SALT).digest('hex'));
    const first = installationHash(installation('v2-six')); const second = installationHash(installation('v2-three'));
    const token = crypto.randomBytes(32).toString('base64url'); const id = network('v2-network');
    old.prepare('INSERT INTO trials VALUES(?,?,?)').run(first, ORIGIN, 6);
    old.prepare('INSERT INTO trials VALUES(?,?,?)').run(second, ORIGIN, 3);
    old.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?)').run(tokenHash(token), id, ORIGIN, INITIAL + SESSION_TTL, 6, first);
    old.prepare('INSERT INTO leases VALUES(?,?,?)').run('v2-pending', INITIAL + LEASE_TTL, second);
    old.prepare('INSERT INTO counters VALUES(?,?,?)').run('v2-budget', 17, INITIAL + SESSION_TTL);
    const before = Object.fromEntries(['trials', 'sessions', 'leases', 'counters'].map(table => [table, old.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]));
    old.close();
    let store = app.open();
    for (const [table, rows] of Object.entries(before)) assert.deepEqual(store.db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all(), rows);
    assert.equal(store.db.prepare("SELECT value FROM metadata WHERE key='version'").get().value, '3');
    assert.deepEqual(store.db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.deepEqual(store.complete('v2-pending'), { limit: 8, remaining: 4 });
    assert.throws(() => store.acquire(token, id, ORIGIN, 6), { code: 'TRIAL_EXHAUSTED', trial: { limit: 6, remaining: 0 } });
    assert.deepEqual(store.complete(store.acquire(token, id, ORIGIN)), { limit: 8, remaining: 1 });
    assert.deepEqual(store.complete(store.acquire(token, id, ORIGIN)), { limit: 8, remaining: 0 });
    assert.throws(() => store.acquire(token, id, ORIGIN), { code: 'TRIAL_EXHAUSTED' });
    store.close(); store = app.open();
    assert.equal(store.db.prepare('SELECT completed FROM trials WHERE installation_hash=?').get(first).completed, 8);
    assert.equal(store.db.prepare('SELECT count FROM counters WHERE key=?').get('v2-budget').count, 17);
    assert.throws(() => store.db.prepare('UPDATE trials SET completed=9 WHERE installation_hash=?').run(first));
    assert.deepEqual(store.db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { app.stop(); }
});
test('operator reset backs up and changes only the exact installation while retaining shared network and global budgets', () => {
  const app = storeFixture(); const store = app.open();
  try {
    const id = network('reset-shared-network'); const targetId = installation('reset-target');
    const target = store.issue(id, ORIGIN, targetId); const other = store.issue(id, ORIGIN, installation('reset-other'));
    for (let index = 0; index < 6; index += 1) store.complete(store.acquire(target.token, id, ORIGIN));
    store.complete(store.acquire(other.token, id, ORIGIN));
    const counters = store.db.prepare('SELECT * FROM counters ORDER BY key').all();
    const otherSession = store.db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(tokenHash(other.token));
    const backupPath = path.join(app.directory, 'reset-backup.json');
    const result = resetAllowance(store.db, { installationHash: installationHash(targetId), origin: ORIGIN,
      expectedCompleted: 6, backupPath, now: INITIAL });
    assert.equal(result.trialsChanged, 1); assert.equal(result.remaining, 8); assert.equal(result.budgetCountersPreserved, true);
    assert.equal(fs.statSync(backupPath).mode & 0o777, 0o600);
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    assert.equal(backup.trial.completed, 6); assert.equal(backup.sessions[0].used, 6);
    assert.ok(!JSON.stringify(backup).includes(target.token));
    assert.deepEqual(store.db.prepare('SELECT * FROM counters ORDER BY key').all(), counters);
    assert.deepEqual(store.db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(tokenHash(other.token)), otherSession);
    assert.equal(store.db.prepare('SELECT completed FROM trials WHERE installation_hash=?').get(otherSession.installation_hash).completed, 1);
    assert.equal(store.db.prepare('SELECT used FROM sessions WHERE token_hash=?').get(tokenHash(target.token)).used, 0);
    for (let index = 0; index < 3; index += 1) store.complete(store.acquire(target.token, id, ORIGIN));
    assert.throws(() => store.acquire(target.token, id, ORIGIN), { code: 'NETWORK_LIMIT' });
    assert.equal(store.db.prepare('SELECT completed FROM trials WHERE installation_hash=?').get(installationHash(targetId)).completed, 3);
  } finally { app.stop(); }
});
test('operator reset refuses an active analysis, changed target, unrelated origin or reused backup', () => {
  const app = storeFixture(); const store = app.open();
  try {
    const id = network('reset-refusal'); const targetId = installation('reset-refusal');
    const target = store.issue(id, ORIGIN, targetId); store.complete(store.acquire(target.token, id, ORIGIN));
    const lease = store.acquire(target.token, id, ORIGIN);
    const options = { installationHash: installationHash(targetId), origin: ORIGIN, expectedCompleted: 1,
      backupPath: path.join(app.directory, 'reset-backup.json'), now: INITIAL };
    assert.throws(() => resetAllowance(store.db, options), { code: 'ACTIVE_ANALYSIS' });
    assert.equal(fs.existsSync(options.backupPath), false); store.release(lease);
    assert.throws(() => resetAllowance(store.db, { ...options, expectedCompleted: 2 }), { code: 'TARGET_CHANGED' });
    assert.throws(() => resetAllowance(store.db, { ...options, origin: EXTENSION_ORIGIN }), { code: 'TARGET_CHANGED' });
    fs.writeFileSync(options.backupPath, 'existing', { mode: 0o600 });
    assert.throws(() => resetAllowance(store.db, options), { code: 'EEXIST' });
    assert.equal(store.db.prepare('SELECT completed FROM trials').get().completed, 1);
    assert.equal(store.db.prepare('SELECT used FROM sessions').get().used, 2);
  } finally { app.stop(); }
});

}
