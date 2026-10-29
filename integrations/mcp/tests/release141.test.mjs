import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createHttpServer } from '../http.mjs';
import { VERSION, FULL_CORE, RESOURCE_URI } from '../server.mjs';

test('1.4.1 wire contract exposes selected core, noauth, hosted widget domain and all three tools', async t => {
  const html = await readFile(new URL('../dist/app.html', import.meta.url), 'utf8');
  const allowedHosts = ['127.0.0.1:pending'];
  const app = createHttpServer({ html, allowedHosts });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const authority = `127.0.0.1:${app.server.address().port}`;
  allowedHosts[0] = authority;
  t.after(() => app.close());
  const client = new Client({ name: 'beforeword-release-check', version: '1.4.1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://${authority}/mcp`)));
  t.after(() => client.close());
  assert.equal(VERSION, '1.4.1');
  assert.equal(client.getServerVersion().version, '1.4.1');
  assert.equal(createHash('sha256').update(FULL_CORE).digest('hex'), 'b861f132d6535d26c37358cf379749d16c7b3ce1888547e0375cdc3985e5e7c2');
  assert.ok(client.getInstructions().startsWith(FULL_CORE + '\n\n'));
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['open_beforeword', 'show_reading', 'submit_source']);
  for (const tool of tools) {
    assert.deepEqual(tool._meta.securitySchemes, [{ type: 'noauth' }]);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(tool.annotations.openWorldHint, false);
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.equal(tool.outputSchema.additionalProperties, false);
  }
  assert.deepEqual(tools.find(tool => tool.name === 'submit_source')._meta.ui.visibility, ['app']);
  assert.equal(tools.find(tool => tool.name === 'submit_source')._meta['openai/visibility'], 'private');
  const resource = (await client.readResource({ uri: RESOURCE_URI })).contents[0];
  assert.equal(resource.text, html);
  assert.equal(resource._meta.ui.domain, 'https://beforeword.xyz');
  assert.equal(resource._meta['openai/widgetDomain'], 'https://beforeword.xyz');
  assert.deepEqual(resource._meta.ui.csp, { connectDomains: [], resourceDomains: [], frameDomains: [] });
  assert.deepEqual(resource._meta['openai/widgetCSP'], { connect_domains: [], resource_domains: [], frame_domains: [] });
  assert.ok(!html.includes('beforeword-explicit-local-preview'));
  const opened = await client.callTool({ name: 'open_beforeword', arguments: { locale: 'ru' } });
  assert.equal(opened.structuredContent.sourceId, null);
  const source = '  <b>Я Кирилл</b>\r\ne\u0301 😀';
  const saved = await client.callTool({ name: 'submit_source', arguments: { source, locale: 'ru' } });
  assert.equal(saved.structuredContent.source, source);
  const shown = await client.callTool({ name: 'show_reading', arguments: {
    sourceId: saved.structuredContent.sourceId,
    report: { language: 'ru', items: [{ quote: { text: 'Я Кирилл', occurrence: 0 }, reading: 'Тестовая запись, не ответ модели.' }] }
  } });
  assert.equal(shown.structuredContent.source, source);
  assert.deepEqual(shown.structuredContent.report.items[0].quote, { text: 'Я Кирилл', occurrence: 0, start: 5, end: 13 });
  assert.equal(shown.structuredContent.validation, 'literal-quotes-only');
  assert.equal(app.store.size, 1);
});

test('anonymous source access is bearer-capability based and is not bound to a client session', async t => {
  const allowedHosts = ['127.0.0.1:pending'];
  const app = createHttpServer({ html: '<!doctype html><title>local fixture</title>', allowedHosts });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const authority = `127.0.0.1:${app.server.address().port}`;
  allowedHosts[0] = authority;
  t.after(() => app.close());
  const connect = async name => {
    const client = new Client({ name, version: '1.4.1' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://${authority}/mcp`)));
    return client;
  };
  const first = await connect('beforeword-local-first-client');
  const source = 'Capability fixture, not private material.';
  const saved = await first.callTool({ name: 'open_beforeword', arguments: { source, locale: 'en' } });
  const sourceId = saved.structuredContent.sourceId;
  assert.match(sourceId, /^[A-Za-z0-9_-]{43}$/);
  await first.close();
  const second = await connect('beforeword-local-second-client');
  t.after(() => second.close());
  const shown = await second.callTool({ name: 'show_reading', arguments: { sourceId,
    report: { language: 'en', items: [{ quote: { text: 'Capability fixture', occurrence: 0 }, reading: 'Synthetic protocol check.' }] }
  } });
  assert.equal(shown.structuredContent.source, source);
  assert.equal(shown.structuredContent.validation, 'literal-quotes-only');
});

test('remote reader invokes only mechanical validator exports and carries selected core in server and skill', async () => {
  const storeSource = await readFile(new URL('../lib/store.mjs', import.meta.url), 'utf8');
  const accessed = [...new Set([...storeSource.matchAll(/(?<![\w-])core\.(\w+)/g)].map(match => match[1]))].sort();
  assert.deepEqual(accessed, ['MAX_CHARS', 'validateInput', 'validateReport']);
  for (const name of ['server.mjs', 'http.mjs', 'main.mjs']) {
    const source = await readFile(new URL('../' + name, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.buildRequest\s*\(|\.schemaForVersion\s*\(/);
  }
  const canonical = await readFile(new URL('../../../assets/core.en.txt', import.meta.url), 'utf8');
  assert.equal(FULL_CORE, canonical);
  const skill = await readFile(new URL('../../../plugins/openai/beforeword-reader/skills/read/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.endsWith(canonical));
});
