import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const here = new URL('./', import.meta.url);
const [template, css, provenance, validator] = await Promise.all([
  readFile(new URL('public/app.html', here), 'utf8'), readFile(new URL('public/app.css', here), 'utf8'),
  readFile(new URL('lib/validator-provenance.json', here), 'utf8'), readFile(new URL('lib/analysis-core.cjs', here))
]);
if (createHash('sha256').update(validator).digest('hex') !== JSON.parse(provenance).sha256) throw new Error('VALIDATOR_MISMATCH');
const core = await readFile(new URL('lib/core.en.txt', here));
const coreProvenance = JSON.parse(await readFile(new URL('lib/core-provenance.json', here), 'utf8'));
const canonicalCore = await readFile(new URL('../../assets/core.en.txt', here));
if (createHash('sha256').update(core).digest('hex') !== coreProvenance.sha256 || !core.equals(canonicalCore)) throw new Error('CORE_MISMATCH');
const bundled = await build({ entryPoints: [fileURLToPath(new URL('public/app.js', here))], bundle: true,
  write: false, platform: 'browser', format: 'esm', target: ['es2022'], minify: true, legalComments: 'inline' });
const js = bundled.outputFiles[0].text;
for (const token of ['<!--APP_STYLE-->', '<!--APP_SCRIPT-->']) if (template.split(token).length !== 2) throw new Error('UI_PLACEHOLDER');
if (/<\/style/i.test(css)) throw new Error('UI_STYLE_BOUNDARY');
const html = template.replace('<!--APP_STYLE-->', () => `<style>${css}</style>`)
  .replace('<!--APP_SCRIPT-->', () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
if (Buffer.byteLength(html) > 1024 * 1024) throw new Error('UI_TOO_LARGE');
await mkdir(new URL('dist/', here), { recursive: true });
await writeFile(new URL('dist/app.html', here), html);
process.stdout.write(`beforeword MCP UI built: ${Buffer.byteLength(html)} bytes\n`);
