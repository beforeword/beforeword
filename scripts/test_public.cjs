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
      if (extension === 'css') {
        const publishedCSS = read(path.join(MODEL, `assets/public-${manifest.version}-${digest}.css`));
        const mobileHeader = publishedCSS.match(/@media\s+screen\s+and\s*\(max-width:\s*620px\)\s*\{\s*body\.bw-paper\.model-page\.bw-shell\s*>\s*\.bw-header\s*\{([^}]+)\}/);
        assert.ok(mobileHeader, 'Mobile header overrides the shared shell at the homepage breakpoint');
        const dimensions = Object.fromEntries(mobileHeader[1].split(';').filter(value => value.trim()).map(value => value.split(':').map(part => part.trim())));
        assert.equal(dimensions['min-height'], '60px', 'Mobile header keeps the homepage height');
        assert.equal(dimensions['padding-top'], '8px', 'Mobile header keeps the homepage top spacing');
        assert.equal(dimensions['padding-bottom'], '8px', 'Mobile header keeps the homepage bottom spacing');
      }
    }
    assert.ok(html.includes('id="where"'), 'Existing homepage fragment preserved');
    const firstExample = html.match(/<section id="example-prescribed-line"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(firstExample, 'The first reading example is present');
    assert.ok(!/<details\b|\bhidden(?:\s|=|>)/.test(firstExample), 'The first example is openly readable without clicks');
    assert.ok(html.indexOf('id="example-prescribed-line"') < html.indexOf('data-copy-target="instruction-text"'), 'The example precedes the instruction copy route');
    const shownAnswers = [...firstExample.matchAll(/<pre class="same-answer">([\s\S]*?)<\/pre>/g)].map(match => decode(match[1]));
    assert.equal(shownAnswers.length, 2, 'Both task responses are shown');
    assert.equal(shownAnswers[0], shownAnswers[1], 'The compared responses are written identically');
    assert.ok(!/__\w+__/.test(html), 'No unexpanded placeholders');
    assert.ok(!/<script[^>]+src="https?:/i.test(html), 'No remote scripts');
    assert.ok(!/\son\w+=/i.test(html), 'No inline event handlers');
    const full = read(path.join(ROOT, 'assets', `scope.${lang}.txt`)).replace(/\n+$/, '') + '\n\n' + read(path.join(ROOT, 'assets', `core.${lang}.txt`));
    const medium = read(path.join(ROOT, 'assets', `medium.${lang}.txt`));
    const compact = read(path.join(ROOT, 'assets', `compact.${lang}.txt`));
    assert.equal(decode(html.match(/<textarea id="instruction-text"[^>]*>([\s\S]*?)<\/textarea>/)[1]), full, 'Main copy field preserves full instructions');
    assert.equal(decode(html.match(/<textarea id="medium-text"[^>]*>([\s\S]*?)<\/textarea>/)[1]), medium, '5,000-character field preserves the complete edition');
    assert.equal(decode(html.match(/<textarea id="compact-text"[^>]*>([\s\S]*?)<\/textarea>/)[1]), compact, 'Compact field preserves instructions');
    assert.ok(Array.from(medium).length <= 5000, 'The 5,000-character edition fits its published limit');
    for (const [prefix, expected] of [['',full],['full-',full],['5000-',medium],['compact-',compact],['micro-',compact]]) {
      const alias = `beforeword-${prefix}${lang}.txt`;
      assert.equal(read(path.join(MODEL, alias)), expected, 'Legacy URL preserves current exact content');
      assert.equal(manifest.aliases[alias].sha256, hash(Buffer.from(expected)));
    }
    assert.equal(manifest.aliases[`beforeword-5000-${lang}.txt`].content, 'medium', 'The new alias identifies its own edition');
    assert.equal(manifest.aliases[`beforeword-micro-${lang}.txt`].content, 'compact', 'The historical micro alias still serves compact instructions');
    for (const [detailsId, targetId, text, alias, repeated] of [
      ['instruction-details','instruction-text',full,`beforeword-${lang}.txt`,true],
      ['medium-details','medium-text',medium,`beforeword-5000-${lang}.txt`,true],
      ['compact-details','compact-text',compact,`beforeword-compact-${lang}.txt`,false]
    ]) {
      const details = html.match(new RegExp('<details id="'+detailsId+'">([\\s\\S]*?)<\\/details>'))?.[1];
      assert.ok(details, 'Edition can be read without JavaScript: '+detailsId);
      const summary = details.match(/<summary>([\s\S]*?)<\/summary>/)?.[1];
      assert.ok(summary && !/<(?:button|a)\b/.test(summary), 'Disclosure summary has no nested action: '+detailsId);
      const length = Array.from(text).length;
      const count = new Intl.NumberFormat(lang).format(length).replace(/\u00a0/g, '\u202f');
      const plural = new Intl.PluralRules(lang).select(length);
      const noun = lang==='ru' ? ({one:'знак',few:'знака',many:'знаков',other:'знака'}[plural]) : (plural==='one'?'character':'characters');
      assert.ok(decode(summary).includes(count+' '+noun), 'Visible count uses the exact edition and the page locale: '+detailsId);
      const action = `data-copy-target="${targetId}" data-copy-details="${detailsId}"`;
      assert.ok(details.indexOf(action) < details.indexOf('id="'+targetId+'"'), 'Copy is beside the beginning of the text: '+detailsId);
      if (repeated) assert.ok(details.lastIndexOf(action) > details.indexOf('</textarea>'), 'Long text has a second copy action at the end: '+detailsId);
      assert.ok(details.includes(`href="/model/${alias}" download`), 'TXT is available beside the text: '+detailsId);
    }
    assert.ok(html.indexOf('data-copy-target="instruction-text"') < html.indexOf('id="instruction-text"'), 'Copy before long instructions');
    const firstStep = html.match(/<ol class="steps"[^>]*>\s*<li>([\s\S]*?)<\/li>/)?.[1];
    assert.ok(firstStep?.includes('data-copy-target="instruction-text"') && firstStep.includes('data-copy-target="medium-text"'), 'Quick start offers full and 5,000-character copy choices');
    assert.ok(html.includes('<noscript>'), 'No-JavaScript copy guidance');
    assert.equal((html.match(/class="app-settings"/g) || []).length, 9);
    const appSettings = [...html.matchAll(/<details class="app-settings">([\s\S]*?)<\/details>/g)];
    const connectors = JSON.parse(read(path.join(ROOT, 'references/connectors.json')));
    for (const [index, app] of appSettings.entries()) {
      const edition = connectors[index].recommended || 'core';
      const copyTargets = {compact: 'compact-text', medium: 'medium-text', core: 'instruction-text'};
      const copyDetailTargets = {compact: 'compact-details', medium: 'medium-details', core: 'instruction-details'};
      const copyTarget = copyTargets[edition];
      const copyDetails = copyDetailTargets[edition];
      assert.ok(copyTarget && copyDetails, 'Known recommended instruction edition: ' + edition);
      assert.ok(app[1].includes(`data-copy-target="${copyTarget}" data-copy-details="${copyDetails}"`), 'App setting copies its recommended instruction: ' + connectors[index].id);
      assert.ok(!/показанную ниже инструкцию|instructions shown below/.test(app[1]), 'App steps name the instruction beside their copy action');
    }
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'Unique document IDs');
    for (const id of ['where','compare','grounds','instruction','instruction-short','instruction-full','instruction-compact','instruction-micro','test','break']) {
      assert.ok(ids.includes(id), 'Existing public anchor retained: ' + id);
    }
    assert.ok(ids.includes('comparison-20260927'), 'Historical comparison anchor retained');
    assert.ok(!html.includes('href="/model/history/'), 'Current reader page does not promote internal dated history');
    assert.ok(!html.includes('id="history-title"'), 'No visible archived-edition section');
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

function checkInstructionNavigation() {
  const source = read(path.join(ROOT, 'assets/public.js'));
  const ids = ['instruction-details', 'medium-details', 'compact-details'];
  for (const initialHash of ['', ...ids.map(id=>'#'+id), '#bw-updates']) {
    const disclosures = Object.fromEntries(ids.map(id=>[id,{open:false}]));
    const links = Object.fromEntries(ids.map(id=>[id,{addEventListener(type, listener){this[type]=listener;}}]));
    const events = {};
    const window = {location:{hash:initialHash},addEventListener(type,listener){events[type]=listener;}};
    const document = {
      getElementById(id){return disclosures[id] || null;},
      querySelectorAll(selector){const id=selector.match(/^a\[href\$="#([^\"]+)"\]$/)?.[1];return links[id]?[links[id]]:[];},
      documentElement:{classList:{add(){}}}
    };
    vm.runInNewContext(source,{document,window});
    for (const id of ids) assert.equal(disclosures[id].open,initialHash==='#'+id,'Only the requested edition opens on arrival: '+id);
    for (const id of ids) {
      for (const node of Object.values(disclosures)) node.open=false;
      window.location.hash='#'+id;events.hashchange();
      assert.equal(disclosures[id].open,true,'Changing the fragment reveals the selected edition: '+id);
      for (const other of ids.filter(value=>value!==id)) assert.equal(disclosures[other].open,false,'Other editions remain closed');
      disclosures[id].open=false;links[id].click();
      assert.equal(disclosures[id].open,true,'Repeating the same link reopens the manually closed edition: '+id);
      disclosures[id].open=false;window.location.hash='#bw-updates';events.hashchange();
      assert.equal(disclosures[id].open,false,'Unrelated fragments leave closed editions alone');
    }
  }
  return 5;
}

async function checkEditionCopies() {
  let cases = 0;
  const code = read(path.join(ROOT, 'assets/public.js'));
  for (const lang of ['ru','en']) {
    const html = read(path.join(MODEL,lang==='ru'?'index.html':'en/index.html'));
    for (const [targetId,detailsId] of [['instruction-text','instruction-details'],['medium-text','medium-details'],['compact-text','compact-details']]) {
      const exact = decode(html.match(new RegExp('<textarea id="'+targetId+'"[^>]*>([\\s\\S]*?)<\\/textarea>'))[1]);
      for (const fallback of [false,true]) {
        let copied, selected, focused=false;
        const source = {tagName:'TEXTAREA',value:exact,focus(){focused=true;},select(){},setSelectionRange(start,end){selected=[start,end];},scrollIntoView(){}};
        const disclosure = {open:false};
        const status = {textContent:'',dataset:{copied:'copied',selected:'selected',failed:'failed'}};
        const buttons = [...html.matchAll(/<button\b[^>]*data-copy-target="([^"]+)"[^>]*data-copy-details="([^"]+)"[^>]*>/g)]
          .filter(match=>match[1]===targetId).map(match=>({dataset:{copyTarget:match[1],copyDetails:match[2]},addEventListener(_,fn){this.click=fn;}}));
        assert.ok(buttons.length,'Rendered edition has copy buttons: '+targetId);
        const document = {getElementById(id){return {[targetId]:source,[detailsId]:disclosure,'copy-status':status}[id] || null;},
          querySelectorAll(selector){return selector==='[data-copy-target]'?buttons:[];},documentElement:{classList:{add(){}}}};
        const navigator = fallback?{}:{clipboard:{async writeText(value){copied=value;}}};
        const window = {location:{hash:''},addEventListener(){}};
        vm.runInNewContext(code,{document,navigator,window,setTimeout(){return 1;},clearTimeout(){}});
        for (const button of buttons) {
          disclosure.open=false;selected=undefined;focused=false;
          await button.click();
          if (fallback) {
            assert.equal(disclosure.open,true,'Fallback reveals the correct edition');
            assert.deepEqual(selected,[0,exact.length],'Fallback selects the complete edition');
            assert.ok(focused);assert.equal(status.textContent,'selected');
          } else {
            assert.equal(copied,exact,'Rendered copy action delivers the complete source text');
            assert.equal(status.textContent,'copied');
          }
          cases++;
        }
      }
    }
  }
  return cases;
}

(async()=>{const artifacts=checkArtifacts();const historyFiles=checkHistory();const copyCases=await checkCopy();const editionCopyCases=await checkEditionCopies();const navigationCases=checkNavigation();const instructionNavigationCases=checkInstructionNavigation();process.stdout.write(JSON.stringify({ok:true,...artifacts,historyFiles,copyCases,editionCopyCases,navigationCases,instructionNavigationCases,scope:'Static files and simulated DOM; no browser rendering'},null,2)+'\n');})().catch(error=>{console.error(error);process.exitCode=1;});
