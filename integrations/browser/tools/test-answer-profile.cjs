#!/usr/bin/env node
'use strict';
// Offline transport/packaging tests; injected strings are not model outputs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildCandidate } = require('./build-answer-profile.cjs');
const { resolveAnswerProfile, answerProfileMetadata, validateCandidateArtifact, sha256 } = require('../server/answer-profile.cjs');
const { buildAnswerRequest, answerIdentity, parseAnswerInput, answer } = require('../server/answer.cjs');
const configuration = { model: 'fixture-model', apiKey: 'fixture-only-not-a-key', networkSalt: 'fixture-salt-not-used-outside-tests' };
const input = language => ({ text: '  Fixture e\u0301 👩\u200d💻\r\n', language, history: [], requestId: 'c908b532-ae91-448b-a995-67cb3b177c18' });
const candidate = () => ({ ...configuration, answerProfile: 'candidate-1.3.6' });
const artifact = () => JSON.parse(buildCandidate());
const envelope = content => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }),
  { headers: { 'Content-Type': 'application/json' } });

test('stable RU/EN prompts contain the approved full 1.4.1 core with pinned request bytes', () => {
  const hashes = { en: '822d77db50d09dc6d924b364332a507cf076c4edc236f1b92324710bccdb8eb6',
    ru: '76e0f0adb92f2fdd5950ae89daa1eae8a50352b3a97f624bf3eb6eedba596a22' };
  for (const language of ['en', 'ru']) {
    const a = buildAnswerRequest(input(language), configuration);
    const b = buildAnswerRequest(input(language), { ...configuration, answerProfile: 'stable' });
    assert.deepEqual(a, b);
    assert.equal(sha256(a.body.messages[0].content), hashes[language]);
    assert.equal(a.instructionProfile, undefined);
  }
});

test('candidate artifact is an exact reproducible data build with the full fetched core', () => {
  const destination = path.join(__dirname, '../server/instruction-candidate.json');
  assert.equal(fs.readFileSync(destination, 'utf8'), buildCandidate());
  const profile = resolveAnswerProfile('candidate-1.3.6');
  const source = fs.readFileSync(path.join(__dirname, '../../../evaluations/instruction-1.3.6/core.en.txt'));
  assert.equal(Buffer.compare(Buffer.from(profile.core), source), 0);
  assert.equal(profile.coreSha256, sha256(profile.core));
  assert.equal(profile.supplementSha256, sha256(profile.supplement));
});

test('every locale and route receives the same full candidate, without a weaker edition', () => {
  const profile = resolveAnswerProfile('candidate-1.3.6');
  for (const language of ['en', 'ru']) for (const route of ['shared', 'openai', 'openrouter']) {
    const personal = route !== 'shared';
    const data = { ...input(language), ...(personal ? { provider: route, model: 'fixture-personal', apiKey: 'fixture-personal-key' } : {}) };
    const selected = buildAnswerRequest(data, candidate(), personal), prompt = selected.body.messages[0].content;
    assert.equal(selected.body.messages[0].role, route === 'openrouter' ? 'system' : 'developer');
    assert.ok(prompt.startsWith(profile.core));
    assert.ok(prompt.endsWith(profile.supplement));
    assert.equal(prompt.split(profile.core).length, 2);
    assert.equal(prompt.split(profile.supplement).length, 2);
    assert.equal(selected.instructionProfile.promptSha256, sha256(prompt));
    assert.equal(selected.body.response_format, undefined);
    assert.equal(selected.body.tools, undefined);
    assert.equal(selected.body.reasoning_effort, personal ? undefined : 'medium');
    assert.equal(selected.body[route === 'openrouter' ? 'max_tokens' : 'max_completion_tokens'], 8192);
    if (route !== 'openrouter') assert.equal(selected.body.store, false);
  }
});

test('candidate includes no-word-exception and correction provisions; text presence is not behavior', () => {
  const p = resolveAnswerProfile('candidate-1.3.6');
  assert.match(p.core, /No written word receives an exception/);
  for (const word of ['illness', 'danger', 'safety', 'harm', 'benefit', 'help', 'evidence', 'human', 'AI', 'beforeword']) assert.ok(p.core.includes('“' + word + '”'));
  assert.match(p.core, /as does the claim that no word receives an exception/);
  assert.match(p.supplement, /this supplement and the resulting answer/);
  assert.match(p.supplement, /history actually supplied/);
  assert.match(p.supplement, /does not by itself establish hostility/);
  assert.match(p.supplement, /not a reason to suspend useful assistance/);
  assert.match(p.supplement, /urgent guidance is not delayed/);
});

test('candidate selection leaves the stable extension core and version untouched', () => {
  const stable = globalThis.BeforewordInstructions;
  resolveAnswerProfile('candidate-1.3.6');
  assert.equal(globalThis.BeforewordInstructions, stable);
  assert.equal(stable.version, '1.4.1');
  assert.equal(resolveAnswerProfile().core, stable.core);
});

test('unknown operator profile fails closed', () => {
  for (const value of ['', null, false, {}, '../candidate', '1.3.6', 'candidate-1.3.6 ']) {
    assert.throws(() => resolveAnswerProfile(value), { code: 'INVALID_ANSWER_PROFILE_CONFIGURATION' });
  }
});

test('corrupt, incomplete or mismatched candidate artifacts are rejected', () => {
  for (const change of [v => { v.core += ' '; }, v => { v.coreSha256 = '0'.repeat(64); },
    v => { v.supplement += ' '; }, v => { v.instructionVersion = '1.3.5'; },
    v => { v.supplement = ''; v.supplementSha256 = sha256(''); },
    v => { delete v.schema; }, v => { v.extra = true; }, v => { v.profile = 'stable'; }]) {
    const value = artifact(); change(value);
    assert.throws(() => validateCandidateArtifact(value), { code: 'ANSWER_PROFILE_UNAVAILABLE' });
  }
  for (const value of [null, [], 'text']) assert.throws(() => validateCandidateArtifact(value), { code: 'ANSWER_PROFILE_UNAVAILABLE' });
});

test('history and explicit corrections are transmitted unchanged in order, not promoted to instructions', () => {
  const data = input('en');
  data.history = [
    { role: 'user', content: 'The library account is marked visitor.' },
    { role: 'assistant', content: 'You are new to the library.' },
    { role: 'user', content: 'Correction: visitor is a temporary access field, not when I joined.\r\n' },
    { role: 'assistant', content: 'The field describes the access record.' },
  ];
  const original = structuredClone(data);
  const built = buildAnswerRequest(data, candidate());
  assert.deepEqual(built.body.messages.slice(1), [...original.history, { role: 'user', content: original.text }]);
  built.body.messages[1].content = 'Provider-side mutation';
  assert.deepEqual(data, original);
  assert.equal(built.body.messages[0].content.includes(data.history[2].content), false);
});

test('client body cannot switch profiles or inject instruction configuration', () => {
  for (const key of ['answerProfile', 'instructionProfile', 'system', 'core', 'supplement']) {
    for (const personal of [false, true]) {
      const data = { ...input('en'), ...(personal ? { provider: 'openai', model: 'fixture', apiKey: 'fixture-key' } : { trialVersion: 2 }), [key]: 'candidate-1.3.6' };
      assert.throws(() => parseAnswerInput(JSON.stringify(data), personal), { code: 'INVALID_INPUT' });
    }
  }
});

test('stable request identities preserve prior journal compatibility', () => {
  const data = input('en'), values = [data.text, data.language, data.history, 'openai', configuration.model];
  const expected = crypto.createHmac('sha256', configuration.networkSalt)
    .update('beforeword-answer-v1\0payload\0' + JSON.stringify(values)).digest('hex');
  assert.equal(answerIdentity(data, configuration, false, 'https://beforeword.example').fingerprint, expected);
});

test('candidate identity binds the effective prompt but preserves owner and request id', () => {
  for (const personal of [false, true]) {
    const data = { ...input('en'), provider: 'openai', model: 'fixture', apiKey: 'fixture-personal-key' };
    const stable = answerIdentity(data, configuration, personal, 'https://beforeword.example');
    const changed = answerIdentity(data, candidate(), personal, 'https://beforeword.example');
    assert.equal(changed.owner, stable.owner);
    assert.equal(changed.requestId, stable.requestId);
    assert.notEqual(changed.fingerprint, stable.fingerprint);
    assert.deepEqual(changed, answerIdentity(data, candidate(), personal, 'https://beforeword.example'));
    const locale = answerIdentity({ ...data, language: 'ru' }, candidate(), personal, 'https://beforeword.example');
    assert.notEqual(locale.fingerprint, changed.fingerprint);
  }
});

test('capability metadata contains source digests, not prompt text, user data or a quality verdict', () => {
  assert.equal(answerProfileMetadata(), undefined);
  const value = answerProfileMetadata('candidate-1.3.6');
  assert.deepEqual(Object.keys(value).sort(), ['coreSha256', 'id', 'instructionVersion', 'status', 'supplementSha256'].sort());
  assert.equal(value.status, 'candidate');
  assert.equal(JSON.stringify(value).includes('fixture'), false);
  value.id = 'changed';
  assert.equal(answerProfileMetadata('candidate-1.3.6').id, 'candidate-1.3.6');
});

test('mock responses including first person, Unicode, exact JSON and code are never rewritten', async () => {
  const texts = ['I feel hopeful.', '  Я\r\ne\u0301 👩\u200d💻\t', '{"n":56}', 'print("I")\n'];
  for (const text of texts) {
    let calls = 0;
    const result = await answer(input('en'), candidate(), async () => { calls++; return envelope(text); }, undefined, r => r.text());
    assert.equal(result.answer, text);
    assert.equal(calls, 1);
    assert.equal(result.instructionProfile.id, 'candidate-1.3.6');
    assert.equal(result.instructionProfile.promptSha256, buildAnswerRequest(input('en'), candidate()).instructionProfile.promptSha256);
  }
});

test('invalid configuration makes no provider request', async () => {
  let calls = 0;
  await assert.rejects(answer(input('en'), { ...configuration, answerProfile: 'unknown' },
    async () => { calls++; return envelope('synthetic'); }, undefined, r => r.text()), { code: 'INVALID_ANSWER_PROFILE_CONFIGURATION' });
  assert.equal(calls, 0);
});
