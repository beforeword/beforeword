#!/usr/bin/env node
'use strict';
// Static artifact checks and clipboard behavior in a DOM simulation.
// This does not render the page or test a real browser/device.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const SITE = path.resolve(process.argv[2] || 'build/site/public_html');
const MODEL = path.join(SITE, 'model');
const read = file => fs.readFileSync(file, 'utf8');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|#x27);/gi, (_, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return {amp:'&',lt:'<',gt:'>',quot:'"'}[e];
});

function checkArtifacts() {
  const manifest = JSON.parse(read(path.join(MODEL, 'release.json')));
  const fullPaths = [];
  for (const lang of ['ru', 'en']) {
    const file = path.join(MODEL, lang === 'ru' ? 'index.html' : 'en/index.html');
    fullPaths.push(file);
    const html = read(file);
    const expectedPath = '/model/' + (lang === 'en' ? 'en/' : '');
    assert.ok(html.includes(`<html lang="${lang}">`), 'Correct page language');
    assert.ok(html.includes(`rel="canonical" href="https://beforeword.xyz${expectedPath}"`), 'Canonical URL');
    assert.ok(html.includes('hreflang="ru" href="https://beforeword.xyz/model/"'));
    assert.ok(html.includes('hreflang="en" href="https://beforeword.xyz/model/en/"'));
    assert.ok(html.includes(`name="beforeword-version" content="${manifest.version}"`));
    assert.ok(html.includes('class="bw-shell bw-paper model-page"'), 'Shared paper shell is used');
    for (const className of ['bw-header','bw-home','bw-links','bw-menu','bw-mobile-links','bw-language','bw-footer']) {
      assert.ok(html.includes(`class="${className}"`), 'Shared site navigation: ' + className);
    }
    assert.ok(html.includes('<span aria-hidden="true">/</span>'), 'Shared language separator');
    assert.ok(html.includes('href="' + (lang === 'en' ? '/en/plain/' : '/plain/') + '"'), 'Plain-language footer route');
    assert.ok(html.includes(`href="/model/toolkit/beforeword_AI.html#${lang}"`), 'Guide preserves the selected language');
    for (const extension of ['css', 'js']) {
      const digest = hash(fs.readFileSync(path.join(ROOT, `assets/public.${extension}`))).slice(0,12);
      assert.ok(html.includes(`/model/assets/public-${manifest.version}-${digest}.${extension}`), 'Changed assets receive a new cache key');
    }
    assert.ok(html.includes('id="where"'), 'Existing homepage fragment preserved');
    assert.ok(!/__\w+__/.test(html), 'No unexpanded placeholders');
    assert.ok(!/<script[^>]+src="https?:/i.test(html), 'No remote scripts');
    assert.ok(!/\son\w+=/i.test(html), 'No inline event handlers');
    const full = read(path.join(ROOT, 'assets', `scope.${lang}.txt`)).replace(/\n+$/, '') + '\n\n' + read(path.join(ROOT, 'assets', `core.${lang}.txt`));
    const compact = read(path.join(ROOT, 'assets', `compact.${lang}.txt`));
    assert.equal(decode(html.match(/<textarea id="instruction-text"[^>]*>([\s\S]*?)<\/textarea>/)[1]), full, 'Main copy field preserves full instructions');
    assert.equal(decode(html.match(/<textarea id="compact-text"[^>]*>([\s\S]*?)<\/textarea>/)[1]), compact, 'Compact field preserves instructions');
    for (const [prefix, expected] of [['',full],['full-',full],['compact-',compact],['micro-',compact]]) {
      const alias = `beforeword-${prefix}${lang}.txt`;
      assert.equal(read(path.join(MODEL, alias)), expected, 'Legacy URL preserves current exact content');
      assert.equal(manifest.aliases[alias].sha256, hash(Buffer.from(expected)));
    }
    assert.ok(html.indexOf('data-copy-target="instruction-text"') < html.indexOf('id="instruction-text"'), 'Copy before long instructions');
    assert.ok(html.includes('<noscript>'), 'No-JavaScript copy guidance');
    assert.equal((html.match(/class="app-settings"/g) || []).length, 9);
    const appSettings = [...html.matchAll(/<details class="app-settings">([\s\S]*?)<\/details>/g)];
    const connectors = JSON.parse(read(path.join(ROOT, 'references/connectors.json')));
    for (const [index, app] of appSettings.entries()) {
      const compactRecommended = connectors[index].recommended === 'compact';
      const copyTarget = compactRecommended ? 'compact-text' : 'instruction-text';
      const copyDetails = compactRecommended ? 'compact-details' : 'instruction-details';
      assert.ok(app[1].includes(`data-copy-target="${copyTarget}" data-copy-details="${copyDetails}"`), 'App setting copies its recommended instruction: ' + connectors[index].id);
      assert.ok(!/показанную ниже инструкцию|instructions shown below/.test(app[1]), 'App steps name the instruction beside their copy action');
    }
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'Unique document IDs');
    for (const id of ['where','compare','grounds','instruction','instruction-short','instruction-full','instruction-compact','instruction-micro','test','break']) {
      assert.ok(ids.includes(id), 'Existing public anchor retained: ' + id);
    }
    assert.ok(ids.includes('comparison-20260927'), 'Historical comparison anchor retained');
    assert.ok(html.includes('/model/history/2026-09-28/' + (lang === 'en' ? 'en/' : '') + '#comparison-20260927'), 'Historical comparison points to a dated snapshot');
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const target = decode(m[1]);
      if (target.startsWith('#')) assert.ok(ids.includes(target.slice(1)), 'Local fragment target exists');
      if (target.startsWith('/model/')) {
        const pathname = target.split('#')[0];
        const local = path.join(SITE, pathname.replace(/^\//, '') + (pathname.endsWith('/') ? 'index.html' : ''));
        assert.ok(fs.existsSync(local), 'Local published link exists: ' + target);
      }
    }
    for (const button of html.matchAll(/<button\b[^>]*data-copy-target="([^"]+)"[^>]*>/g)) {
      assert.ok(ids.includes(button[1]), 'Every copy button has a source');
    }
    if (!manifest.github_url) assert.ok(!html.includes('href="https://github.com/'), 'No invented repository URL');
  }
  const checksums = read(path.join(MODEL, 'SHA256SUMS.txt')).trim().split('\n');
  for (const line of checksums) {
    const m = line.match(/^([a-f0-9]{64})  (.+)$/);
    assert.ok(m, 'Well-formed SHA256SUMS line');
    assert.equal(hash(fs.readFileSync(path.join(MODEL, m[2]))), m[1], 'Checksum matches ' + m[2]);
  }
  const zipFiles = fs.readdirSync(path.join(MODEL, 'downloads')).filter(f => f.endsWith('.zip'));
  assert.equal(zipFiles.length, 7, 'Six native ZIPs and the source toolkit');
  assert.equal(read(path.join(MODEL, 'reports/eval-cases.jsonl')),read(path.join(ROOT, 'references/eval-cases.jsonl')), 'Methodology links to the supplied cases');
  for (const line of checksums) {
    const name = line.slice(66);
    if (!name.startsWith('assets/site-shell/') || !name.endsWith('.css')) continue;
    for (const match of read(path.join(MODEL,name)).matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const local = path.resolve(path.dirname(path.join(MODEL,name)),match[1]);
      assert.ok(local.startsWith(MODEL+path.sep), 'Shared CSS resources stay within the standalone section');
      assert.ok(fs.existsSync(local),'Shared CSS resource exists: '+match[1]);
    }
  }
  return {pages:fullPaths.length,checksums:checksums.length,zipFiles:zipFiles.length};
}

function checkNavigation() {
  const events = {};
  let focusCount = 0;
  let resize;
  const trigger = {focus(){focusCount++;}};
  const link = {addEventListener(event,listener){this[event]=listener;}};
  const inside = {};
  const menu = {open:false,querySelector(){return trigger;},querySelectorAll(){return [link];},contains(target){return target===inside;}};
  const desktop = {matches:false,addEventListener(event,listener){resize=listener;}};
  const document = {querySelector(){return menu;},addEventListener(event,listener){events[event]=listener;}};
  vm.runInNewContext(read(path.join(ROOT,'assets/site-shell/site-reader-20260920.js')),{document,matchMedia(){return desktop;}});
  menu.open=true;events.keydown({key:'Escape'});
  assert.equal(menu.open,false);assert.equal(focusCount,1,'Escape restores focus to menu trigger');
  menu.open=true;events.click({target:inside});
  assert.equal(menu.open,true,'An internal click keeps the menu usable');
  events.click({target:{}});assert.equal(menu.open,false,'Outside click closes menu');
  menu.open=true;link.click();assert.equal(menu.open,false,'Navigation closes menu');
  menu.open=true;desktop.matches=true;resize();assert.equal(menu.open,false,'Desktop breakpoint closes mobile menu');
  return 5;
}

function checkHistory() {
  const base = '/model/history/2026-09-28/';
  const directory = path.join(MODEL, 'history/2026-09-28');
  const manifest = JSON.parse(read(path.join(directory, 'snapshot.json')));
  for (const [name,record] of Object.entries(manifest.snapshot_files)) {
    const bytes = fs.readFileSync(path.join(directory,name));
    assert.equal(hash(bytes),record.sha256,'Historical snapshot file checksum: '+name);
    assert.equal(bytes.length,record.bytes);
  }
  for (const lang of ['ru','en']) {
    const html = read(path.join(directory,lang === 'ru'?'index.html':'en/index.html'));
    assert.ok(html.includes('name="robots" content="noindex,follow"'), 'Archive excluded from indexing');
    assert.ok(html.includes('class="beforeword-archive-notice"'), 'Archive clearly labelled');
    assert.ok(html.includes('id="comparison-20260927"'), 'Historical comparison retained');
    assert.ok(html.includes('href="/model/'+(lang === 'en'?'en/':'')+'"'), 'Archive links to current instructions');
    assert.ok(html.includes('rel="canonical"') && html.includes('https://beforeword.xyz'+base+(lang === 'en'?'en/':'')), 'Archive canonical path');
    for (const m of html.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)) {
      const url = decode(m[1]).replace('https://beforeword.xyz','');
      if (url.startsWith(base)) {
        const local = path.join(SITE,url.replace(/^\//,'')+(url.endsWith('/')?'index.html':''));
        assert.ok(fs.existsSync(local),'Archived link or resource exists: '+url);
      }
    }
    for (const prefix of ['','full-','compact-','micro-']) {
      const name=`beforeword-${prefix}${lang}.txt`;
      assert.equal(hash(fs.readFileSync(path.join(directory,name))),manifest.source_files['model/'+name].sha256,'Historical instructions remain byte-for-byte original');
    }
  }
  for (const name of Object.keys(manifest.snapshot_files).filter(name=>name.endsWith('.css'))) {
    for (const m of read(path.join(directory,name)).matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      assert.ok(m[1].startsWith(base),'Archive styles use snapshot-local resources');
      assert.ok(fs.existsSync(path.join(SITE,m[1].replace(/^\//,''))),'Archived CSS resource exists');
    }
  }
  return Object.keys(manifest.snapshot_files).length;
}

async function checkCopy() {
  const sourceCode = read(path.join(ROOT, 'assets/public.js'));
  assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage)\b/.test(sourceCode), 'No network or storage API');
  let cases = 0;
  for (const mode of ['success','textarea-fallback','selection-fallback','selection-failure']) {
    const exact = 'é|e\u0301|ё\r\nA—B|A–B|A-B\n<script>& "\'末';
    let copied, selected, focused=false, scrolled=false, enabled=false;
    const source = {tagName:mode.startsWith('selection')?'PRE':'TEXTAREA',value:exact,textContent:exact,
      focus(){focused=true;},select(){selected=true;},setSelectionRange(a,b){assert.equal(a,0);assert.equal(b,exact.length);},scrollIntoView(){scrolled=true;}};
    const disclosure={open:false};
    const status={textContent:'',dataset:{copied:'copied',selected:'selected',failed:'failed'}};
    const button={dataset:{copyTarget:'source',copyDetails:'disclosure'},addEventListener(_,fn){this.click=fn;}};
    const document={getElementById(id){return {source,disclosure,'copy-status':status}[id];},
      querySelectorAll(){return [button];},documentElement:{classList:{add(name){assert.equal(name,'js-ready');enabled=true;}}},
      createRange(){return {selectNodeContents(node){assert.equal(node,source);}};}};
    const navigator=mode==='success'?{clipboard:{async writeText(text){copied=text;}}}:{clipboard:{async writeText(){throw new Error('denied');}}};
    const window={getSelection(){return mode==='selection-failure'?null:{removeAllRanges(){},addRange(){selected=true;}};}};
    vm.runInNewContext(sourceCode,{document,navigator,window,setTimeout(){return 1;},clearTimeout(){}});
    assert.ok(enabled);
    await button.click();
    if (mode==='success') {assert.equal(copied,exact);assert.equal(status.textContent,'copied');assert.equal(disclosure.open,false);}
    else {assert.equal(disclosure.open,true);assert.ok(focused);assert.equal(status.textContent,mode==='selection-failure'?'failed':'selected');if(mode!=='selection-failure'){assert.ok(selected);assert.ok(scrolled);}}
    cases++;
  }
  return cases;
}

(async()=>{const artifacts=checkArtifacts();const historyFiles=checkHistory();const copyCases=await checkCopy();const navigationCases=checkNavigation();process.stdout.write(JSON.stringify({ok:true,...artifacts,historyFiles,copyCases,navigationCases,scope:'Static files and simulated DOM; no browser rendering'},null,2)+'\n');})().catch(error=>{console.error(error);process.exitCode=1;});
