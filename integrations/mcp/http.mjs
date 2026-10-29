import { createServer as nodeServer } from 'node:http';
import { isIP } from 'node:net';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createHandler, VERSION } from './server.mjs';

export const MAX_BODY_BYTES = 128 * 1024;

export class RateLimiter {
  #entries = new Map();
  #global = { until: 0, count: 0 };
  constructor({ clock = Date.now, perMinute = 60, globalPerMinute = 600, maxClients = 2048 } = {}) {
    this.clock = clock; this.perMinute = perMinute; this.globalPerMinute = globalPerMinute; this.maxClients = maxClients;
  }
  allow(key) {
    const now = this.clock();
    for (const [ip, entry] of this.#entries) if (entry.until <= now) this.#entries.delete(ip);
    if (this.#global.until <= now) this.#global = { until: now + 60_000, count: 0 };
    if (this.#global.count >= this.globalPerMinute) return false;
    let entry = this.#entries.get(key);
    if (!entry) {
      if (this.#entries.size >= this.maxClients) return false;
      entry = { until: now + 60_000, count: 0 }; this.#entries.set(key, entry);
    }
    if (entry.count >= this.perMinute) return false;
    entry.count++; this.#global.count++; return true;
  }
  clear() { this.#entries.clear(); this.#global = { until: 0, count: 0 }; }
}

function reply(res, status, code, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify({ error: code }));
}
const loopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);

export function createHttpServer({ html, store, allowedHosts = ['localhost:8788', '127.0.0.1:8788', 'beforeword.xyz'],
  allowedOrigins = ['https://beforeword.xyz', 'https://chatgpt.com', 'https://claude.ai'],
  trustLoopbackProxy = false, limiter = new RateLimiter(), maxConcurrent = 32 } = {}) {
  if (!allowedHosts.length || allowedHosts.some(value => typeof value !== 'string' || /[\s/*@]/.test(value))) throw new Error('INVALID_HOST_CONFIG');
  for (const value of allowedOrigins) {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== value || value.includes('*')) throw new Error('INVALID_ORIGIN_CONFIG');
  }
  const handler = createHandler({ html, store });
  // The legacy SDK SSE leg supplies no-cache, which still permits storage.
  // Source-bearing responses must remain no-store in both protocol eras.
  const handle = toNodeHandler({ async fetch(request, options) {
    const response = await handler.fetch(request, options);
    const headers = new Headers(response.headers); headers.set('cache-control', 'no-store');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } }, { maxRequestBodySize: MAX_BODY_BYTES, onerror: () => {} });
  let active = 0;
  const server = nodeServer({ maxHeaderSize: 16 * 1024 }, (req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    const hosts = req.rawHeaders.filter((_, index) => index % 2 === 0 && req.rawHeaders[index].toLowerCase() === 'host');
    const origins = req.rawHeaders.filter((_, index) => index % 2 === 0 && req.rawHeaders[index].toLowerCase() === 'origin');
    if (hosts.length !== 1 || !allowedHosts.includes(String(req.headers.host).toLowerCase()) || origins.length > 1)
      return reply(res, 403, 'HOST_OR_ORIGIN_DENIED');
    const origin = req.headers.origin;
    if (origin !== undefined && !allowedOrigins.includes(origin)) return reply(res, 403, 'HOST_OR_ORIGIN_DENIED');
    if (origin) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
      res.setHeader('access-control-expose-headers', 'MCP-Protocol-Version');
    }
    const remote = req.socket.remoteAddress || 'unknown';
    let client = remote;
    if (trustLoopbackProxy && loopback(remote)) {
      const forwarded = req.headers['x-real-ip'];
      if (typeof forwarded !== 'string' || !isIP(forwarded)) return reply(res, 400, 'INVALID_PROXY_ADDRESS');
      client = forwarded;
    }
    if (!limiter.allow(client)) return reply(res, 429, 'RATE_LIMITED', { 'retry-after': '60' });
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: true, name: 'beforeword-mcp', version: VERSION }));
    }
    // Capabilities stay in POST bodies. Query strings and arbitrary paths are
    // rejected so the application never turns a sourceId into an access-log URL.
    if (req.url !== '/mcp') return reply(res, 404, 'NOT_FOUND');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type, MCP-Protocol-Version, MCP-Session-Id, Accept', 'allow': 'POST, OPTIONS' });
      return res.end();
    }
    if (req.method !== 'POST') return reply(res, 405, 'METHOD_NOT_ALLOWED', { allow: 'POST, OPTIONS' });
    if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') return reply(res, 415, 'UNSUPPORTED_ENCODING');
    const length = req.headers['content-length'];
    if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) return reply(res, 413, 'BODY_TOO_LARGE');
    if (active >= maxConcurrent) return reply(res, 503, 'SERVER_BUSY', { 'retry-after': '1' });
    active++;
    let released = false;
    const release = () => { if (!released) { released = true; active--; clearTimeout(deadline); } };
    const deadline = setTimeout(() => { if (!res.headersSent) reply(res, 408, 'REQUEST_TIMEOUT'); res.destroy(); }, 15_000);
    deadline.unref();
    res.once('close', release); res.once('finish', release);
    void handle(req, res).catch(() => { if (!res.headersSent) reply(res, 500, 'INTERNAL_ERROR'); else res.destroy(); });
  });
  server.headersTimeout = 10_000; server.requestTimeout = 15_000; server.keepAliveTimeout = 5_000;
  server.maxConnections = 64; server.maxRequestsPerSocket = 100;
  const timer = setInterval(() => handler.store.purge(), 30_000); timer.unref();
  return { server, store: handler.store, async close() {
    clearInterval(timer); handler.store.clear(); limiter.clear();
    await handler.close();
    server.closeIdleConnections();
    await new Promise(resolve => server.close(resolve));
  } };
}
