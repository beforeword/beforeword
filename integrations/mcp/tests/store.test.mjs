import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DocumentStore, TTL_MS, MAX_CHARS, validateReading, stateFor } from '../lib/store.mjs';

const report = (text, occurrence = 0, reading = 'A written entry is present.') => ({ language: 'en', items: [{ quote: { text, occurrence }, reading }] });
test('standalone MCP instructions contain the exact current full EN core and pinned hash', async () => {
  const [copy, original, provenance] = await Promise.all([
    readFile(new URL('../lib/core.en.txt', import.meta.url)),
    readFile(new URL('../../../assets/core.en.txt', import.meta.url)),
    readFile(new URL('../lib/core-provenance.json', import.meta.url), 'utf8')
  ]);
  assert.deepEqual(copy, original);
  assert.equal(createHash('sha256').update(copy).digest('hex'), JSON.parse(provenance).sha256);
});
test('copied validator is byte-identical to the pinned historical source fixture and provenance', async () => {
  const [copy, original, provenance] = await Promise.all([
    readFile(new URL('../lib/analysis-core.cjs', import.meta.url)),
    readFile(new URL('./fixtures/analysis-core-pinned.cjs', import.meta.url)),
    readFile(new URL('../lib/validator-provenance.json', import.meta.url), 'utf8')
  ]);
  assert.deepEqual(copy, original);
  assert.equal(createHash('sha256').update(copy).digest('hex'), JSON.parse(provenance).sha256);
});
test('immutable revisions preserve CRLF, markup, spaces and decomposed Unicode', () => {
  const store = new DocumentStore();
  const source = '  <b title="x">e\u0301</b>\r\n😀  ';
  const first = store.create(source, 'en', 'app');
  const second = store.create(source + 'z', 'en', 'app');
  assert.match(first.sourceId, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.sourceId, second.sourceId);
  assert.equal(store.get(first.sourceId).source, source);
  assert.throws(() => { first.source = 'changed'; }, TypeError);
  assert.equal(stateFor(first).source, source);
});
test('30-minute expiry is absolute; unknown and expired capability share one error', () => {
  let now = 100_000; const store = new DocumentStore({ clock: () => now });
  const document = store.create('hello', 'en', 'host');
  assert.equal(Date.parse(document.expiresAt), now + TTL_MS);
  now += TTL_MS - 1; assert.equal(store.get(document.sourceId), document);
  now += 1;
  assert.throws(() => store.get(document.sourceId), { code: 'SOURCE_NOT_FOUND' });
  assert.throws(() => store.get('A'.repeat(43)), { code: 'SOURCE_NOT_FOUND' });
  assert.equal(store.bytes, 0); assert.equal(store.size, 0);
});
test('capacity rejects new records without evicting valid earlier capabilities', () => {
  const store = new DocumentStore({ maxDocuments: 2, maxBytes: 12 });
  const a = store.create('abc', 'en', 'host');
  store.create('def', 'en', 'host');
  assert.throws(() => store.create('g', 'en', 'host'), { code: 'STORE_FULL' });
  assert.equal(store.get(a.sourceId).source, 'abc');
  const bytes = new DocumentStore({ maxBytes: 4 });
  assert.throws(() => bytes.create('abc', 'en', 'host'), { code: 'STORE_FULL' });
});
test('input rejects blank, oversized and invalid language without truncation', () => {
  const store = new DocumentStore();
  assert.throws(() => store.create(' \n', 'en', 'host'), { code: 'EMPTY_INPUT' });
  assert.throws(() => store.create('x'.repeat(MAX_CHARS + 1), 'en', 'host'), { code: 'INPUT_TOO_LONG' });
  assert.throws(() => store.create('x', 'fr', 'host'), { code: 'INVALID_LANGUAGE' });
  assert.equal(store.create('x'.repeat(MAX_CHARS), 'en', 'host').source.length, MAX_CHARS);
});
test('literal validation counts overlapping matches and resolves exact UTF16 offsets', () => {
  const document = new DocumentStore().create('😀 aaaa\r\n', 'en', 'host');
  const checked = validateReading(document, report('aa', 2));
  assert.deepEqual(checked.items[0].quote, { text: 'aa', occurrence: 2, start: 5, end: 7 });
  assert.throws(() => validateReading(document, report('aa', 3)), { code: 'INVALID_CITATION' });
  assert.throws(() => validateReading(document, report('\ud83d')), { code: 'INVALID_CITATION' });
});
test('altered case, normalization, markup escaping and line endings are not exact citations', () => {
  const document = new DocumentStore().create('<a>x</a>\r\ne\u0301 Hello', 'en', 'host');
  for (const quote of ['&lt;a&gt;x&lt;/a&gt;', '\né', 'hello', 'é', '</a>\ne'])
    assert.throws(() => validateReading(document, report(quote)), { code: 'INVALID_CITATION' });
  assert.equal(validateReading(document, report('<a>x</a>')).items[0].quote.start, 0);
});
test('v3 rejects legacy, offsets, extra fields, invisible reading and locale mismatch', () => {
  const document = new DocumentStore().create('hello', 'en', 'host');
  const legacy = report('hello'); Object.assign(legacy.items[0], { attribution: null, grounds: {}, limit: null });
  assert.throws(() => validateReading(document, legacy), { code: 'INVALID_REPORT' });
  const offsets = report('hello'); offsets.items[0].quote.start = 0;
  assert.throws(() => validateReading(document, offsets), { code: 'INVALID_CITATION' });
  assert.throws(() => validateReading(document, { ...report('hello'), extra: true }), { code: 'INVALID_REPORT' });
  assert.throws(() => validateReading(document, report('hello', 0, '\u200b')), { code: 'INVALID_REPORT' });
  assert.throws(() => validateReading(document, { ...report('hello'), language: 'ru' }), { code: 'INVALID_REPORT' });
});
test('validation does not certify prose truth, store a report or modify source', () => {
  const store = new DocumentStore(); const document = store.create('hello', 'en', 'app');
  const checked = validateReading(document, report('hello', 0, 'An arbitrary proposed reading.'));
  const state = stateFor(document, checked);
  assert.equal(state.validation, 'literal-quotes-only');
  assert.equal(state.suppliedBy, 'app');
  assert.equal(stateFor(store.get(document.sourceId)).report, null);
  store.clear(); assert.equal(store.size, 0);
});
