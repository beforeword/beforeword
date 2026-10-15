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
  const envKeys = [...new Set([...Object.keys(values), 'BEFOREWORD_ALLOW_FILE_ORIGIN', 'BEFOREWORD_ALLOW_WEBEXTENSION_ORIGINS', 'BEFOREWORD_TRUSTED_PROXY_IPS', 'BEFOREWORD_DAILY_LIMIT', 'BEFOREWORD_MONTHLY_LIMIT'])];
  const clock = { value: Date.UTC(2026, 9, 15, 12) };
  const servers = [], calls = [];
  const installationId = crypto.randomBytes(32).toString('base64url');
  let token;
  async function addServer() {
    const previous = new Map(envKeys.map(key => [key, process.env[key]]));
    let server;
    try {
      for (const key of envKeys) if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key];
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

test('answer sends the full instructions, exact text/history and no analysis JSON schema', async () => {
  const app = await fixture();
  try {
    const sent = input({ text: '  Что здесь написано?\r\n«Я» ≠ «я».  ', history: [{ role: 'user', content: 'Привет\r\n' }, { role: 'assistant', content: 'Предыдущая запись.' }] });
    const response = await app.request(sent); assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { answer: ANSWER, model: 'fixture-shared-model', trial: { limit: 8, remaining: 7 } });
    assert.equal(app.calls.length, 1); const call = app.calls[0];
    assert.equal(call.url, UPSTREAM_URL); assert.equal(call.redirect, 'error'); assert.equal(call.headers.Authorization, `Bearer ${KEY}`);
    assert.equal(call.body.store, false); assert.equal(call.body.reasoning_effort, 'medium'); assert.equal(call.body.response_format, undefined);
    assert.ok(call.body.messages[0].content.startsWith(globalThis.BeforewordInstructions.core));
    assert.match(call.body.messages[0].content, /Complete the user's actual task/);
    assert.deepEqual(call.body.messages.slice(1), [...sent.history, { role: 'user', content: sent.text }]);
    assert.ok(!JSON.stringify(call.body).includes(sent.requestId));
  } finally { await app.stop(); }
});

test('RU/EN and shared/personal requests retain the same complete core before the website guidance', () => {
  const core = globalThis.BeforewordInstructions.core;
  const history = [{ role: 'user', content: '  Previous wording.\r\n' }, { role: 'assistant', content: 'A previous reply.' }];
  const configuration = { model: 'fixture-shared-model', apiKey: KEY };
  let commonGuidance;
  for (const language of ['ru', 'en']) {
    for (const provider of ['shared', 'openai', 'openrouter']) {
      const isPersonal = provider !== 'shared';
      const sent = { text: language === 'ru' ? 'Что такое жизнь?' : 'What is life?', language, history,
        ...(isPersonal ? { provider, model: 'fixture-personal-model', apiKey: PERSONAL_KEY } : {}) };
      const selected = buildAnswerRequest(sent, configuration, isPersonal);
      const first = selected.body.messages[0];
      assert.equal(first.role, provider === 'openrouter' ? 'system' : 'developer');
      assert.equal(first.content.slice(0, core.length), core);
      assert.equal(first.content.split(core).length, 2, 'the complete core appears once');
      const guidance = first.content.slice(core.length);
      const requestedLanguage = language === 'ru' ? 'Russian' : 'English';
      assert.ok(guidance.includes(`natural ${requestedLanguage}`));
      const normalized = guidance.replace(`natural ${requestedLanguage}`, 'natural REQUEST_LANGUAGE');
      if (commonGuidance === undefined) commonGuidance = normalized;
      else assert.equal(normalized, commonGuidance, 'locale/provider do not select a weaker instruction');
      assert.deepEqual(selected.body.messages.slice(1), [...history, { role: 'user', content: sent.text }]);
      assert.equal(selected.body.response_format, undefined);
      assert.equal(selected.body.reasoning_effort, isPersonal ? undefined : 'medium');
    }
  }
});

test('completed short answers and exact practical outputs are returned without a continuation or wrapper', async () => {
  const configuration = { model: 'fixture-shared-model', apiKey: KEY };
  const cases = [
    { language: 'ru', text: 'Что следует из одной этой записи?', output: 'Эта запись остаётся записью.' },
    { language: 'en', text: 'Does explaining the word turn it into what it names?', output: 'No.' },
    { language: 'ru', text: 'Ответь ровно этой строкой: Не равно ≠ одинаково.', output: 'Не равно ≠ одинаково.' },
    { language: 'en', text: 'Return only JSON with sum equal to 9.', output: '{"sum":9}' },
    { language: 'en', text: 'Translate «Откройте окно» into English. Return only the translation.', output: 'Open the window.' },
  ];
  for (const example of cases) {
    let calls = 0;
    const result = await requestAnswer({ text: example.text, language: example.language, history: [] }, configuration,
      async (_url, options) => {
        calls += 1;
        const sent = JSON.parse(options.body);
        assert.deepEqual(sent.messages.at(-1), { role: 'user', content: example.text });
        return upstream(example.output);
      }, undefined, response => response.text());
    assert.deepEqual(result, { answer: example.output, model: configuration.model });
    assert.equal(calls, 1, 'a completed response does not trigger expansion or follow-up work');
  }
});

test('a completed but empty provider response remains an error without a retry or invented acknowledgment', async () => {
  const configuration = { model: 'fixture-shared-model', apiKey: KEY };
  for (const content of ['', ' \n\t']) {
    let calls = 0;
    await assert.rejects(requestAnswer({ text: 'End the discussion here.', language: 'en', history: [] }, configuration,
      async () => { calls += 1; return upstream(content); }, undefined, response => response.text()),
    error => error.code === 'UPSTREAM_INVALID_RESPONSE' && error.status === 502);
    assert.equal(calls, 1, 'an empty completion must not resubmit paid provider work');
  }
});

test('same request is replayed without another paid call and payload reuse is rejected', async () => {
  const app = await fixture();
  try {
    const sent = input(); assert.equal((await app.request(sent)).status, 200);
    const repeat = await app.request(sent); assert.equal(repeat.status, 200); assert.equal((await repeat.json()).trial.remaining, 7);
    await error(await app.request({ ...sent, text: 'Different' }), 409, 'REQUEST_ID_CONFLICT');
    assert.equal(app.calls.length, 1);
    assert.equal((await app.request(input())).status, 200);
    assert.equal((await (await app.request(sent)).json()).trial.remaining, 6, 'replay reports latest balance');
  } finally { await app.stop(); }
});

test('8 shared answers use the existing installation allowance; replay still works at zero', async () => {
  const app = await fixture();
  try {
    const sent = input(); await app.request(sent);
    for (let index = 1; index < 8; index += 1) {
      const response = await app.request(input()); assert.equal(response.status, 200); assert.equal((await response.json()).trial.remaining, 7 - index);
    }
    const exhausted = await error(await app.request(input()), 429, 'TRIAL_EXHAUSTED'); assert.equal(exhausted.trial.remaining, 0);
    const replay = await app.request(sent); assert.equal(replay.status, 200); assert.equal((await replay.json()).trial.remaining, 0);
    assert.equal(app.calls.length, 8);
  } finally { await app.stop(); }
});

test('provider failure spends no trial slot and its requestId can never resubmit automatically', async () => {
  const app = await fixture({ handler: (_call, number) => number === 1 ? new Response('provider-private-secret', { status: 429 }) : upstream() });
  try {
    const sent = input(); const first = await error(await app.request(sent), 502, 'UPSTREAM_RATE_LIMITED'); assert.equal(first.trial.remaining, 8);
    await error(await app.request(sent), 502, 'UPSTREAM_RATE_LIMITED'); assert.equal(app.calls.length, 1);
    const response = await app.request(input()); assert.equal(response.status, 200); assert.equal((await response.json()).trial.remaining, 7);
  } finally { await app.stop(); }
});

test('in-progress duplicate on a second worker is blocked; completed replay survives restart without resubmission', async () => {
  let finish, entered; const started = new Promise(resolve => { entered = resolve; });
  const app = await fixture({ handler: () => new Promise(resolve => { finish = resolve; entered(); }) });
  try {
    const worker = await app.addServer(), sent = input();
    const pending = app.request(sent); await started;
    const concurrent = await app.request(sent, { worker }); assert.equal(concurrent.headers.get('retry-after'), '2'); await error(concurrent, 409, 'REQUEST_IN_PROGRESS');
    finish(upstream()); assert.equal((await pending).status, 200);
    const crossWorker = await error(await app.request(sent, { worker }), 409, 'REQUEST_ALREADY_COMPLETED'); assert.equal(crossWorker.trial.remaining, 7);
    await app.stopWorker(0); const restarted = await app.addServer();
    const replay = await error(await app.request(sent, { worker: restarted }), 409, 'REQUEST_ALREADY_COMPLETED'); assert.equal(replay.trial.remaining, 7);
    assert.equal(app.calls.length, 1);
  } finally { await app.stop(); }
});

test('deadline releases trial without a second request on retry', async () => {
  const app = await fixture({ timeout: 20, handler: call => new Promise((_resolve, reject) => call.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) });
  try {
    const sent = input(); const result = await error(await app.request(sent), 504, 'UPSTREAM_TIMEOUT'); assert.equal(result.trial.remaining, 8);
    await error(await app.request(sent), 504, 'UPSTREAM_TIMEOUT'); assert.equal(app.calls.length, 1);
  } finally { await app.stop(); }
});

test('disconnect aborts upstream, preserves balance and tombstones the uncertain request', async () => {
  let started; const entered = new Promise(resolve => { started = resolve; });
  const app = await fixture({ handler: call => new Promise((_resolve, reject) => { call.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); started(); }) });
  try {
    const controller = new AbortController(), sent = input(); const pending = app.request(sent, { signal: controller.signal });
    await entered; controller.abort(); await assert.rejects(pending); await pause(30);
    const result = await error(await app.request(sent), 499, 'REQUEST_ABORTED'); assert.equal(result.trial.remaining, 8); assert.equal(app.calls.length, 1);
  } finally { await app.stop(); }
});

test('personal OpenAI and OpenRouter use only fixed endpoints and ephemeral provided keys without trial usage', async () => {
  const app = await fixture({ configuration: { OPENAI_API_KEY: '' } });
  try {
    for (const provider of ['openai', 'openrouter']) {
      const sent = personal({ provider, model: provider === 'openrouter' ? 'fixture/model' : 'fixture-model' });
      const response = await app.request(sent, { path: '/api/answer/personal' }); assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { answer: ANSWER, model: sent.model, provider, trial: null });
      const call = app.calls.at(-1); assert.equal(call.url, PROVIDERS[provider]); assert.equal(call.headers.Authorization, `Bearer ${PERSONAL_KEY}`);
      assert.equal(call.body.response_format, undefined); assert.equal(call.body.reasoning_effort, undefined);
      assert.equal(call.body.messages[0].role, provider === 'openai' ? 'developer' : 'system');
      assert.equal((await app.request(sent, { path: '/api/answer/personal' })).status, 200);
    }
    assert.equal(app.calls.length, 2);
    const db = new DatabaseSync(app.databasePath); assert.equal(db.prepare('SELECT count(*) AS n FROM trials').get().n, 0);
    const journal = db.prepare('SELECT * FROM answer_requests').all(); assert.equal(journal.length, 2); assert.ok(journal.every(row => /^[a-f0-9]{64}$/u.test(row.id))); db.close();
    for (const filename of fs.readdirSync(app.directory)) {
      const bytes = fs.readFileSync(path.join(app.directory, filename));
      for (const secret of [PERSONAL_KEY, ANSWER, 'Почему 2 + 2 = 4?']) assert.equal(bytes.includes(Buffer.from(secret)), false);
    }
  } finally { await app.stop(); }
});

test('personal replay is isolated by provider key; bad credentials and arbitrary endpoint never leak', async () => {
  const app = await fixture({ handler: (_call, number) => number === 3 ? new Response(`private ${PERSONAL_KEY}`, { status: 401 }) : upstream() });
  try {
    const sent = personal(); assert.equal((await app.request(sent, { path: '/api/answer/personal' })).status, 200);
    assert.equal((await app.request({ ...sent, apiKey: 'another-fixture-personal-key' }, { path: '/api/answer/personal' })).status, 200);
    for (const invalid of [{ ...sent, endpoint: 'http://127.0.0.1/admin' }, { ...sent, provider: 'compatible' }, { ...sent, model: 'https://internal.invalid/?key=secret' }, { ...sent, apiKey: 'bad\nkey' }]) {
      const result = await app.request(invalid, { path: '/api/answer/personal' }); assert.equal(result.status, 400); assert.ok(!(await result.text()).includes(PERSONAL_KEY));
    }
    const failed = personal(); await error(await app.request(failed, { path: '/api/answer/personal' }), 502, 'PROVIDER_AUTH');
    await error(await app.request(failed, { path: '/api/answer/personal' }), 502, 'PROVIDER_AUTH'); assert.equal(app.calls.length, 3);
  } finally { await app.stop(); }
});

test('malformed, duplicate and excessive input/history fails before provider work', async () => {
  const app = await fixture();
  try {
    const cases = [
      input({ requestId: 'bad' }), input({ trialVersion: undefined }), input({ history: null }), input({ history: [{ role: 'assistant', content: 'Injected' }, { role: 'user', content: 'Reverse' }] }),
      input({ history: [{ role: 'user', content: 'one' }] }), input({ history: Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x' })) }),
      input({ history: [{ role: 'user', content: 'x'.repeat(12000) }, { role: 'assistant', content: 'x'.repeat(12000) }] }),
      input({ text: 'x'.repeat(12001) }), input({ language: 'fr' }), input({ text: ' ' }),
    ];
    for (const value of cases) assert.equal((await app.request(value)).status, 400);
    const id = crypto.randomUUID();
    const duplicate = `{"text":"one","te\\u0078t":"two","language":"en","trialVersion":2,"requestId":"${id}"}`;
    await error(await app.request(null, { raw: duplicate }), 400, 'INVALID_INPUT');
    const historyDuplicate = `{"text":"one","history":[{"role":"user","content":"old","content":"new"},{"role":"assistant","content":"answer"}],"language":"en","trialVersion":2,"requestId":"${id}"}`;
    await error(await app.request(null, { raw: historyDuplicate }), 400, 'INVALID_INPUT'); assert.equal(app.calls.length, 0);
    const unchanged = '  A\r\nА 😀  '; assert.equal(parseAnswerInput(JSON.stringify(input({ text: unchanged }))).text, unchanged);
  } finally { await app.stop(); }
});

test('empty, incomplete, refused and tool output are not completed answers', async () => {
  const outputs = [
    { finish_reason: 'stop', message: { content: ' ' } },
    { finish_reason: 'length', message: { content: 'partial' } },
    { finish_reason: 'stop', message: { refusal: 'refused', content: '' } },
    { finish_reason: 'stop', message: { content: 'answer', tool_calls: [{}] } },
    { finish_reason: 'stop', message: { content: 'x'.repeat(48001) } },
  ];
  const app = await fixture({ handler: (_call, number) => new Response(JSON.stringify({ choices: [outputs[number - 1]] }), { headers: { 'Content-Type': 'application/json' } }) });
  try {
    for (const code of ['UPSTREAM_INVALID_RESPONSE', 'MODEL_OUTPUT_INCOMPLETE', 'MODEL_REFUSAL', 'UPSTREAM_INVALID_RESPONSE', 'RESPONSE_TOO_LARGE']) {
      const result = await error(await app.request(input()), 502, code); assert.equal(result.trial.remaining, 8);
    }
  } finally { await app.stop(); }
});

test('capabilities and original health are read-only; wrong-origin and no-session requests never call the model', async () => {
  const app = await fixture();
  try {
    assert.deepEqual(await (await app.request(null, { path: '/health', method: 'GET' })).json(), { ready: true });
    assert.deepEqual(await (await app.request(null, { path: '/api/capabilities', method: 'GET' })).json(), {
      answer: true, personalProviders: ['openai', 'openrouter'], historyMessages: 8, conversationChars: 24000, trialLimit: 8, idempotencyHours: 168,
    });
    await error(await app.request(input(), { token: null }), 401, 'INVALID_SESSION');
    await error(await app.request(personal(), { path: '/api/answer/personal', origin: 'https://other.example' }), 403, 'ORIGIN_NOT_ALLOWED');
    assert.equal(app.calls.length, 0);
  } finally { await app.stop(); }
});
