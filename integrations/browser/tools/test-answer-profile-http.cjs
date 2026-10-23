#!/usr/bin/env node
'use strict';
// Local HTTP server + injected provider fixtures only. No live model calls.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createAnalysisServer, UPSTREAM_URL } = require('../server/index.cjs');
const { PROVIDERS, parseAnswerInput, buildAnswerRequest, answer: requestAnswer } = require('../server/answer.cjs');
const ORIGIN = 'https://beforeword.example';
const KEY = 'fixture-shared-key-never-a-real-credential';
const PERSONAL_KEY = 'fixture-personal-key-never-a-real-credential';
const ANSWER = '2 + 2 = 4.\nВ обычной арифметике складываются два и два.';
const input = (extra = {}) => ({ text: 'Почему 2 + 2 = 4?', language: 'ru', trialVersion: 2, requestId: crypto.randomUUID(), ...extra });
const personal = (extra = {}) => {
  const value = input({ provider: 'openai', model: 'fixture-model', apiKey: PERSONAL_KEY, ...extra }); delete value.trialVersion; return value;
};
const upstream = (content = ANSWER) => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }), { headers: { 'Content-Type': 'application/json' } });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fixture({ handler, configuration = {}, timeout } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'beforeword-answer-'));
  const databasePath = path.join(directory, 'quota.sqlite');
  const values = {
    OPENAI_API_KEY: KEY, BEFOREWORD_MODEL: 'fixture-shared-model', BEFOREWORD_HOST: '127.0.0.1', BEFOREWORD_PORT: '8787',
    BEFOREWORD_ALLOWED_ORIGINS: ORIGIN, BEFOREWORD_DATABASE_PATH: databasePath,
    BEFOREWORD_NETWORK_SALT: 'fixture-private-salt-for-answer-tests-01234567890123456789', ...configuration,
  };
  const envKeys = [...new Set([...Object.keys(values), 'BEFOREWORD_ALLOW_FILE_ORIGIN', 'BEFOREWORD_ALLOW_WEBEXTENSION_ORIGINS', 'BEFOREWORD_TRUSTED_PROXY_IPS', 'BEFOREWORD_DAILY_LIMIT', 'BEFOREWORD_MONTHLY_LIMIT', 'BEFOREWORD_ANSWER_PROFILE'])];
  const clock = { value: Date.UTC(2026, 9, 15, 12) };
  const servers = [], calls = [];
  const installationId = crypto.randomBytes(32).toString('base64url');
  let token;
  async function addServer(overrides = {}) {
    const currentValues = { ...values, ...overrides };
    const previous = new Map(envKeys.map(key => [key, process.env[key]]));
    let server;
    try {
      for (const key of envKeys) if (currentValues[key] === undefined) delete process.env[key]; else process.env[key] = currentValues[key];
      server = createAnalysisServer({ now: () => clock.value, upstreamTimeoutMs: timeout,
        fetchImpl: async (url, options) => {
          const call = { url, ...options, body: JSON.parse(options.body) }; calls.push(call);
          return handler ? handler(call, calls.length) : upstream();
        } });
    } finally { for (const [key, value] of previous) if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    servers.push(server); return servers.length - 1;
  }
  async function request(body, options = {}) {
    const route = options.path || '/api/answer';
    if (route === '/api/answer' && options.token === undefined && !token) {
      const response = await request({ installationId, trialVersion: 2 }, { path: '/api/session' });
      assert.equal(response.status, 200); token = (await response.json()).token;
    }
    const selectedToken = options.token === undefined ? token : options.token;
    return fetch(`http://127.0.0.1:${servers[options.worker || 0].address().port}${route}`, {
      method: options.method || 'POST',
      headers: { Origin: options.origin === undefined ? ORIGIN : options.origin, 'Content-Type': 'application/json',
        ...(selectedToken && route === '/api/answer' ? { Authorization: `Bearer ${selectedToken}` } : {}), ...options.headers },
      ...(options.method === 'GET' ? {} : { body: options.raw === undefined ? JSON.stringify(body) : options.raw }), signal: options.signal,
    });
  }
  await addServer();
  return { directory, databasePath, calls, clock, addServer, request, get token() { return token; },
    stopWorker: index => new Promise(resolve => { servers[index].closeAllConnections(); servers[index].close(resolve); }),
    async stop() {
      for (const server of servers) if (server.listening) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
      fs.rmSync(directory, { recursive: true, force: true });
    } };
}
async function error(response, status, code) {
  assert.equal(response.status, status); const value = await response.json(); assert.deepEqual(value.error, { code }); return value;
}



test('candidate HTTP route exposes its profile, transmits full instructions and replays without another provider call', async () => {
  const app = await fixture({ configuration: { BEFOREWORD_ANSWER_PROFILE: 'candidate-1.3.6' } });
  try {
    const caps = await (await app.request(null, { path: '/api/capabilities', method: 'GET' })).json();
    assert.equal(caps.instructionProfile.id, 'candidate-1.3.6');
    assert.equal(caps.instructionProfile.status, 'candidate');
    const sent = input({ text: 'Write only 56.', history: [
      { role: 'user', content: 'A library field says visitor.' },
      { role: 'assistant', content: 'A database field is supplied.' },
    ] });
    const first = await app.request(sent); assert.equal(first.status, 200);
    const body = await first.json();
    assert.equal(body.answer, ANSWER);
    assert.equal(body.instructionProfile.id, 'candidate-1.3.6');
    assert.equal(body.instructionProfile.promptSha256, crypto.createHash('sha256').update(app.calls[0].body.messages[0].content).digest('hex'));
    assert.match(app.calls[0].body.messages[0].content, /No written word receives an exception/);
    assert.deepEqual(app.calls[0].body.messages.slice(1), [...sent.history, { role: 'user', content: sent.text }]);
    const replay = await app.request(sent); assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), body);
    assert.equal(app.calls.length, 1);
  } finally { await app.stop(); }
});

test('stable and candidate workers sharing a journal reject a cross-profile UUID instead of replaying or calling again', async () => {
  for (const firstProfile of ['stable', 'candidate-1.3.6']) {
    const app = await fixture({ configuration: { BEFOREWORD_ANSWER_PROFILE: firstProfile } });
    try {
      const other = await app.addServer({ BEFOREWORD_ANSWER_PROFILE: firstProfile === 'stable' ? 'candidate-1.3.6' : 'stable' });
      for (const ownKey of [false, true]) {
        const sent = ownKey ? personal() : input();
        const route = ownKey ? '/api/answer/personal' : '/api/answer';
        const response = await app.request(sent, { path: route }); assert.equal(response.status, 200); await response.json();
        const calls = app.calls.length;
        await error(await app.request(sent, { path: route, worker: other }), 409, 'REQUEST_ID_CONFLICT');
        assert.equal(app.calls.length, calls);
      }
    } finally { await app.stop(); }
  }
});

test('candidate selection is operator-only and personal routes preserve exact response without shared allowance charge', async () => {
  const exact = '  I feel hopeful.\r\nЯ e\u0301 👩\u200d💻\t';
  const app = await fixture({ configuration: { BEFOREWORD_ANSWER_PROFILE: 'candidate-1.3.6' }, handler: () => upstream(exact) });
  try {
    for (const provider of ['openai', 'openrouter']) {
      const response = await app.request(personal({ provider }), { path: '/api/answer/personal' });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.answer, exact); assert.equal(body.trial, null);
      assert.equal(body.instructionProfile.id, 'candidate-1.3.6');
      assert.equal(app.calls.at(-1).headers.Authorization, `Bearer ${PERSONAL_KEY}`);
    }
    const calls = app.calls.length;
    await error(await app.request(input({ answerProfile: 'stable' })), 400, 'INVALID_INPUT');
    assert.equal(app.calls.length, calls);
    const shared = await app.request(input()); const body = await shared.json();
    assert.equal(body.trial.remaining, 7);
  } finally { await app.stop(); }
});
