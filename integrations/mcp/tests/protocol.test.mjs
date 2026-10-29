import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createHttpServer, RateLimiter, MAX_BODY_BYTES } from '../http.mjs';
import { DocumentStore } from '../lib/store.mjs';
import { RESOURCE_URI, FULL_CORE } from '../server.mjs';

const html = '<!doctype html><html><body>beforeword test resource</body></html>';
async function fixture(options = {}) {
  const allowedHosts = ['127.0.0.1:pending'];
  const app = createHttpServer({ html, allowedHosts, ...options });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const authority = `127.0.0.1:${app.server.address().port}`; allowedHosts[0] = authority;
  const url = `http://${authority}/mcp`;
  return { ...app, url, authority };
}
const raw = (url, { method = 'POST', headers = {}, body = '' } = {}) => new Promise((resolve, reject) => {
  const request = http.request(url, { method, headers }, response => {
    const chunks = []; response.on('data', data => chunks.push(data));
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text: Buffer.concat(chunks).toString() }));
  });
  request.on('error', reject); request.end(body);
});
const rpcHeaders = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-11-25' };
const rpc = (app, method, params, id = 1) => raw(app.url, { headers: rpcHeaders, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });

test('official client discovers tools/resource and completes linked immutable source-reading protocol', async t => {
  const app = await fixture(); t.after(() => app.close());
  const client = new Client({ name: 'beforeword-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(app.url));
  await client.connect(transport); t.after(() => client.close());
  assert.ok(client.getInstructions().startsWith(FULL_CORE));
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map(t => t.name).sort(), ['open_beforeword', 'show_reading', 'submit_source']);
  assert.deepEqual(tools.tools.find(t => t.name === 'submit_source')._meta.ui.visibility, ['app']);
  assert.equal(tools.tools.find(t => t.name === 'submit_source')._meta.ui.resourceUri, undefined);
  assert.equal(tools.tools.find(t => t.name === 'show_reading').annotations.readOnlyHint, true);
  assert.equal(tools.tools.find(t => t.name === 'open_beforeword').annotations.readOnlyHint, false);
  const empty = await client.callTool({ name: 'open_beforeword', arguments: { locale: 'ru' } });
  assert.equal(empty.structuredContent.sourceId, null);
  assert.equal(empty.structuredContent.locale, 'ru');
  const source = '  <x>aaaa</x>\r\n😀';
  const saved = await client.callTool({ name: 'submit_source', arguments: { source, locale: 'en' } });
  assert.equal(saved.structuredContent.source, source); assert.equal(saved.structuredContent.suppliedBy, 'app');
  const sourceId = saved.structuredContent.sourceId;
  const shown = await client.callTool({ name: 'show_reading', arguments: { sourceId,
    report: { language: 'en', items: [{ quote: { text: 'aa', occurrence: 2 }, reading: 'A proposed reading.' }] } } });
  assert.equal(shown.structuredContent.source, source);
  assert.deepEqual(shown.structuredContent.report.items[0].quote, { text: 'aa', occurrence: 2, start: 7, end: 9 });
  assert.equal(shown.structuredContent.validation, 'literal-quotes-only');
  assert.match(shown.content[0].text, /not certified as true/);
  const resources = await client.listResources(); assert.equal(resources.resources[0].uri, RESOURCE_URI);
  const resource = await client.readResource({ uri: RESOURCE_URI });
  assert.equal(resource.contents[0].mimeType, 'text/html;profile=mcp-app');
  assert.equal(resource.contents[0].text, html);
  assert.deepEqual(resource.contents[0]._meta.ui.csp.connectDomains, []);
});
test('legacy stateless protocol initializes and returns tool errors without changing source', async t => {
  const app = await fixture(); t.after(() => app.close());
  const init = await rpc(app, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'legacy', version: '1' } });
  assert.equal(init.status, 200); assert.equal(init.headers['mcp-session-id'], undefined);
  assert.equal(init.headers['cache-control'], 'no-store');
  const savedRaw = await rpc(app, 'tools/call', { name: 'open_beforeword', arguments: { source: 'Exact text', locale: 'en' } });
  assert.equal(savedRaw.headers['cache-control'], 'no-store');
  // Legacy SDK transport may return SSE; decode the JSON data frame when needed.
  const decode = value => JSON.parse(value.text.startsWith('event:') ? value.text.split('\n').find(x => x.startsWith('data: ')).slice(6) : value.text);
  const saved = decode(savedRaw).result;
  assert.equal(saved.structuredContent.source, 'Exact text');
  const bad = decode(await rpc(app, 'tools/call', { name: 'show_reading', arguments: { sourceId: saved.structuredContent.sourceId,
    report: { language: 'en', items: [{ quote: { text: 'exact text', occurrence: 0 }, reading: 'wrong quote' }] } } }));
  assert.equal(bad.result.isError, true); assert.equal(bad.result.structuredContent.error, 'INVALID_CITATION');
  assert.equal(app.store.get(saved.structuredContent.sourceId).source, 'Exact text');
  const extra = decode(await rpc(app, 'tools/call', { name: 'open_beforeword', arguments: { source: 'x', extra: 'ignored?' } }));
  assert.ok(extra.error || extra.result?.isError);
});
test('expired and unknown capabilities return the same bounded error via MCP', async t => {
  let now = 1_000; const store = new DocumentStore({ clock: () => now, ttlMs: 10 });
  const expired = store.create('word', 'en', 'host'); now += 10;
  const app = await fixture({ store }); t.after(() => app.close());
  for (const sourceId of [expired.sourceId, 'Z'.repeat(43)]) {
    const response = await rpc(app, 'tools/call', { name: 'show_reading', arguments: { sourceId,
      report: { language: 'en', items: [{ quote: { text: 'word', occurrence: 0 }, reading: 'Reading.' }] } } });
    assert.match(response.text, /SOURCE_NOT_FOUND/); assert.doesNotMatch(response.text, /Reading\./);
  }
});
test('HTTP rejects foreign Host/Origin, query URLs, unsupported verbs and compressed bodies', async t => {
  const app = await fixture(); t.after(() => app.close());
  assert.equal((await raw(app.url, { headers: { host: 'evil.example' } })).status, 403);
  for (const origin of ['https://evil.example', 'null', 'https://beforeword.xyz.evil.example', 'http://beforeword.xyz'])
    assert.equal((await raw(app.url, { headers: { origin } })).status, 403);
  assert.equal((await raw(app.url + '?sourceId=private')).status, 404);
  assert.equal((await raw(app.url, { method: 'GET' })).status, 405);
  assert.equal((await raw(app.url, { method: 'DELETE' })).status, 405);
  assert.equal((await raw(app.url, { headers: { 'content-encoding': 'gzip' } })).status, 415);
  const options = await raw(app.url, { method: 'OPTIONS', headers: { origin: 'https://beforeword.xyz' } });
  assert.equal(options.status, 204); assert.equal(options.headers['access-control-allow-origin'], 'https://beforeword.xyz');
  assert.equal(options.headers['access-control-allow-credentials'], undefined);
});
test('both declared and streaming oversized bodies are rejected before creating documents', async t => {
  const app = await fixture(); t.after(() => app.close());
  const body = 'x'.repeat(MAX_BODY_BYTES + 1);
  const declared = await raw(app.url, { headers: { ...rpcHeaders, 'content-length': body.length }, body });
  assert.equal(declared.status, 413);
  const streamed = await raw(app.url, { headers: { ...rpcHeaders, 'transfer-encoding': 'chunked' }, body });
  assert.equal(streamed.status, 413); assert.equal(app.store.size, 0);
});
test('rate limits apply by socket and ignore spoofed forwarding headers', async t => {
  const app = await fixture({ limiter: new RateLimiter({ perMinute: 2 }) }); t.after(() => app.close());
  assert.equal((await raw(app.url, { method: 'OPTIONS', headers: { 'x-real-ip': '8.8.8.8' } })).status, 204);
  assert.equal((await raw(app.url, { method: 'OPTIONS', headers: { 'x-real-ip': '1.1.1.1' } })).status, 204);
  assert.equal((await raw(app.url, { method: 'OPTIONS', headers: { 'x-real-ip': '9.9.9.9' } })).status, 429);
});
test('proxy mode requires a single valid address and bounds each real client separately', async t => {
  const app = await fixture({ trustLoopbackProxy: true, limiter: new RateLimiter({ perMinute: 1 }) }); t.after(() => app.close());
  assert.equal((await raw(app.url, { method: 'OPTIONS' })).status, 400);
  assert.equal((await raw(app.url, { method: 'OPTIONS', headers: { 'x-real-ip': '1.1.1.1,2.2.2.2' } })).status, 400);
  assert.equal((await raw(app.url, { method: 'OPTIONS', headers: { 'x-real-ip': '1.1.1.1' } })).status, 204);
  assert.equal((await raw(app.url, { method: 'OPTIONS', headers: { 'x-real-ip': '1.1.1.1' } })).status, 429);
  assert.equal((await raw(app.url, { method: 'OPTIONS', headers: { 'x-real-ip': '2.2.2.2' } })).status, 204);
});
test('limiter expires counters and rejects rather than evicting active clients', () => {
  let now = 1; const limiter = new RateLimiter({ clock: () => now, maxClients: 1, globalPerMinute: 2 });
  assert.equal(limiter.allow('a'), true); assert.equal(limiter.allow('b'), false);
  assert.equal(limiter.allow('a'), true); assert.equal(limiter.allow('a'), false);
  now += 60_000; assert.equal(limiter.allow('b'), true);
});
