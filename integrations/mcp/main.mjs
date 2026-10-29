import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

try {
  const provenance = JSON.parse(await readFile(new URL('./lib/validator-provenance.json', import.meta.url), 'utf8'));
  const validator = await readFile(new URL('./lib/analysis-core.cjs', import.meta.url));
  if (createHash('sha256').update(validator).digest('hex') !== provenance.sha256) throw new Error('VALIDATOR_MISMATCH');
  const coreProvenance = JSON.parse(await readFile(new URL('./lib/core-provenance.json', import.meta.url), 'utf8'));
  const core = await readFile(new URL('./lib/core.en.txt', import.meta.url));
  if (createHash('sha256').update(core).digest('hex') !== coreProvenance.sha256) throw new Error('CORE_MISMATCH');
  const { createHttpServer } = await import('./http.mjs');
  const html = await readFile(new URL('./dist/app.html', import.meta.url), 'utf8');
  const port = Number(process.env.PORT || '8788');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('INVALID_PORT');
  const app = createHttpServer({ html,
    allowedHosts: (process.env.BEFOREWORD_MCP_HOSTS || `localhost:${port},127.0.0.1:${port},beforeword.xyz`).split(','),
    allowedOrigins: (process.env.BEFOREWORD_MCP_ORIGINS || 'https://beforeword.xyz,https://chatgpt.com,https://claude.ai').split(','),
    trustLoopbackProxy: process.env.BEFOREWORD_MCP_TRUST_PROXY === '1'
  });
  // Only the reverse proxy is public. No body, address, capability or exception
  // detail is logged here; production reverse-proxy logging is separate.
  app.server.listen(port, '127.0.0.1', () => process.stdout.write('beforeword-mcp ready\n'));
  app.server.on('error', () => { process.stderr.write('beforeword-mcp listener failed\n'); process.exitCode = 1; });
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await app.close(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
} catch {
  process.stderr.write('beforeword-mcp startup failed\n'); process.exitCode = 1;
}
