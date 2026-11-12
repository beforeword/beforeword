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

// Read attributes independently of HTML serialization order in the captured page.
function attrs(source) {
  return Object.fromEntries([...source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
    .map(m=>[m[1],decode(m[2] ?? m[3] ?? m[4] ?? '')]));
}
function startTags(html, name) {
  return [...html.matchAll(new RegExp('<'+name+'\\b([^<>]*)>', 'gi'))].map(m=>({raw:m[0],attrs:attrs(m[1]),index:m.index}));
}
function element(html, name, attribute, value) {
  const starts=startTags(html,name).filter(tag=>tag.attrs[attribute]===value);
  assert.equal(starts.length,1,`Exactly one ${name}[${attribute}="${value}"]`);
  const start=starts[0].index;
  const tags=new RegExp('</?'+name+'\\b[^>]*>','gi');
  tags.lastIndex=start;
  let depth=0;
  for (let tag;(tag=tags.exec(html));) {
    depth+=tag[0].startsWith('</')?-1:1;
    if (depth===0) return html.slice(start,tags.lastIndex);
  }
  assert.fail('Unclosed element: '+name+' '+value);
}
function textArea(html,id) {
  const markup=element(html,'textarea','id',id);
  return decode(markup.slice(markup.indexOf('>')+1,markup.lastIndexOf('</textarea>')));
}
function externalAssets(html) {
  return [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(m=>m[1]);
}
function checkArtifacts() {
  const manifest=JSON.parse(read(path.join(MODEL,'release.json')));
  const selected=JSON.parse(read(path.join(ROOT,'references/release-contract.json')));
  assert.equal(manifest.version,selected.version,'Site identifies the selected instruction release');
  assert.equal(manifest.date_utc,selected.date_utc,'Site uses the selected release date');
  assert.equal(manifest.site_wrapper_snapshot,'assets/site-wrapper/published-20261112/manifest.json');
  const wrapperDirectory=path.dirname(path.join(ROOT,manifest.site_wrapper_snapshot));
  const wrapper=JSON.parse(read(path.join(ROOT,manifest.site_wrapper_snapshot)));
  assert.equal(wrapper.schema_version,2);
  assert.deepEqual(Object.keys(wrapper.pages).sort(),['model/en/index.html','model/evaluation/en/index.html','model/evaluation/index.html','model/index.html']);
  const external=new Set();
  for (const [relative,record] of Object.entries(wrapper.pages)) {
    const bytes=fs.readFileSync(path.join(wrapperDirectory,relative));
    assert.equal(hash(bytes),record.sha256,'Captured published wrapper is unchanged: '+relative);
    assert.equal(bytes.length,record.bytes);
    for (const resource of externalAssets(bytes.toString('utf8'))) external.add(resource);
  }
  external.delete('/assets/beforeword/beforeword-reader.js?v=0.3.1');
  assert.deepEqual(manifest.external_site_assets,[...external].sort(),'Manifest lists all inherited root-site dependencies');
  const guide=JSON.parse(read(path.join(MODEL,manifest.guide_manifest)));
  const guideHtml=read(path.join(MODEL,'toolkit/beforeword_AI.html'));
  const guideData=JSON.parse(element(guideHtml,'script','id','bundle-data').replace(/^<script[^>]*>|<\/script>$/g,''));
  assert.equal(guide.version,manifest.version);
  assert.equal(guide.date_utc,manifest.date_utc);
  assert.equal(hash(fs.readFileSync(path.join(MODEL,'toolkit/beforeword_AI.html'))),guide.guide_sha256,'Standalone guide matches its manifest');
  const renderedCopySources=[];
  for (const lang of ['ru','en']) {
    const relative='model/'+(lang==='en'?'en/':'')+'index.html';
    const html=read(path.join(SITE,relative));
    const original=read(path.join(wrapperDirectory,relative));
    const expectedPath='/model/'+(lang==='en'?'en/':'');
    const tags=[...html.matchAll(/<([a-z][\w:-]*)\b([^<>]*)>/gi)].map(m=>({name:m[1].toLowerCase(),attrs:attrs(m[2])}));
    const ids=tags.map(tag=>tag.attrs.id).filter(Boolean);
    const originalIds=[...original.matchAll(/<[a-z][\w:-]*\b[^<>]*\bid="([^"]+)"[^<>]*>/gi)].map(m=>m[1]);
    assert.equal(new Set(ids).size,ids.length,'Unique document IDs');
    for (const id of originalIds) assert.ok(ids.includes(id),'Current published anchor is retained: '+id);
    assert.deepEqual(startTags(html,'html')[0].attrs,startTags(original,'html')[0].attrs,'Published language and theme attributes');
    assert.equal(startTags(html,'html')[0].attrs.lang,lang);
    assert.equal(startTags(html,'html')[0].attrs['data-theme'],'light');
    assert.deepEqual(startTags(html,'body')[0].attrs,startTags(original,'body')[0].attrs,'Current route-page shell');
    for (const [tag,part] of [['header','header'],['div','rail'],['footer','footer'],['dialog','settings']]) {
      assert.equal(element(html,tag,'data-original-shell',part),element(original,tag,'data-original-shell',part),'Published navigation/settings preserved: '+part);
    }
    const links=startTags(html,'link');
    const canonical=links.filter(tag=>tag.attrs.rel==='canonical');
    assert.equal(canonical.length,1);
    assert.equal(canonical[0].attrs.href,'https://beforeword.xyz'+expectedPath);
    for (const [language,url] of [['ru','https://beforeword.xyz/model/'],['en','https://beforeword.xyz/model/en/'],['x-default','https://beforeword.xyz/model/en/']]) {
      const matches=links.filter(tag=>tag.attrs.hreflang===language);
      assert.equal(matches.length,1,'One alternate-language link: '+language);
      assert.equal(matches[0].attrs.href,url);
    }
    const originalIcons=startTags(original,'link').filter(tag=>['icon','apple-touch-icon'].includes(tag.attrs.rel)).map(tag=>tag.attrs.href);
    assert.deepEqual(externalAssets(html),externalAssets(original).filter(url=>!originalIcons.includes(url)),'Published root-site resources and their order are preserved');
    const favicon=links.filter(tag=>tag.attrs.rel==='icon');
    assert.equal(favicon.length,1);
    assert.equal(favicon[0].attrs.href,`/model/assets/brand-${manifest.version}/favicon.svg`,'Selected branding has its current local alias');
    assert.deepEqual(fs.readFileSync(path.join(MODEL,`assets/brand-${manifest.version}/favicon.svg`)),fs.readFileSync(path.join(ROOT,'brand/favicon.svg')));
    const scripts=startTags(html,'script').filter(tag=>tag.attrs.src);
    assert.deepEqual(scripts.map(tag=>tag.attrs.src),startTags(original,'script').filter(tag=>tag.attrs.src).map(tag=>tag.attrs.src),'Landing uses its actual captured runtime');
    assert.ok(scripts.length>0,'Landing retains external runtime scripts');
    assert.ok(!scripts.some(tag=>/^https?:/i.test(tag.attrs.src)),'No remote script origins');
    assert.ok(!tags.some(tag=>Object.keys(tag.attrs).some(name=>/^on/i.test(name))),'No inline event handlers');
    assert.ok(!/__\w+__/.test(html),'No unexpanded placeholders');
    const metas=startTags(html,'meta');
    const version=metas.filter(tag=>tag.attrs.name==='beforeword-version');
    assert.equal(version.length,1);assert.equal(version[0].attrs.content,manifest.version);
    const descriptions=['description','og:description','twitter:description'].map(name=>{
      const found=metas.filter(tag=>(tag.attrs.name||tag.attrs.property)===name);
      assert.equal(found.length,1,'One description field: '+name);return found[0].attrs.content;
    });
    assert.ok(descriptions[0]);assert.ok(descriptions.every(value=>value===descriptions[0]),'Description metadata stays aligned');
    const graph=JSON.parse(element(html,'script','id','beforeword-seo-graph').replace(/^<script[^>]*>|<\/script>$/g,''));
    const page=graph['@graph'].find(node=>[].concat(node['@type']).includes('WebPage'));
    assert.ok(page);assert.equal(page.url,'https://beforeword.xyz'+expectedPath);
    assert.equal(page.inLanguage,lang);assert.equal(page.description,descriptions[0]);assert.equal(page.dateModified,manifest.date_utc);
    const full=read(path.join(ROOT,'assets',`core.${lang}.txt`));
    const medium=read(path.join(ROOT,'assets',`medium.${lang}.txt`));
    const compact=read(path.join(ROOT,'assets',`compact.${lang}.txt`));
    assert.ok(!decode(html).includes(read(path.join(ROOT,'assets',`scope.${lang}.txt`)).trim()),'Model-facing scope commands are not appended to reader guidance');
    assert.equal(textArea(html,'instruction-text'),full,'Main copy field preserves the exact full instruction');
    assert.equal(startTags(html,'textarea').length,1,'Current landing contains the single published full instruction field');
    assert.ok(Object.hasOwn(startTags(html,'textarea')[0].attrs,'readonly'),'Instruction field remains read-only');
    assert.ok(Array.from(medium).length<=5000,'Medium edition fits its published limit');
    assert.ok(Array.from(compact).length<=1500,'Compact edition fits its published limit');
    assert.equal(guide.core_sha256[lang],hash(Buffer.from(full)));
    assert.equal(guideData.core[lang],full,'Guide embeds the exact full source');
    assert.equal(guideData.medium[lang],medium,'Guide embeds the exact medium source');
    assert.equal(guideData.compact[lang],compact,'Guide embeds the exact compact source');
    assert.equal(guide.medium_sha256[lang],hash(Buffer.from(medium)));
    assert.equal(guide.medium_characters[lang],Array.from(medium).length);
    assert.equal(guide.compact_characters[lang],Array.from(compact).length);
    assert.equal(selected.core_sha256[lang],hash(Buffer.from(full)));
    const instruction=element(html,'section','id','medium-details');
    if (lang==='en') assert.equal(html.split(`Text Mode lets you try instruction ${manifest.version} on a task and compare the outputs.`).length-1,1,'Present-tense Text Mode teaser names the selected instruction once');
    assert.ok(instruction.includes('class="s-release-version"'));
    assert.ok(instruction.includes((lang==='ru'?'Полная инструкция · ':'Full instruction · ')+manifest.version),'Visible full-edition version');
    const disclosure=element(instruction,'details','class','r-more');
    const summary=disclosure.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/)?.[1];
    assert.ok(summary&&!/<(?:button|a)\b/.test(summary),'Full instruction is readable through a native disclosure');
    const buttons=startTags(html,'button').filter(tag=>tag.attrs['data-copy-target']);
    assert.deepEqual(buttons.map(tag=>tag.attrs),startTags(original,'button').filter(tag=>tag.attrs['data-copy-target']).map(tag=>tag.attrs),'Published copy control is retained');
    assert.ok(buttons.length>0);
    for (const button of buttons) {
      const target=button.attrs['data-copy-target'];
      assert.ok(ids.includes(target),'Every copy button has a source');
      assert.equal(target,'instruction-text','Published copy control selects the full edition');
      assert.equal(textArea(html,target),full);
      assert.ok(button.index<html.indexOf('<textarea'),'Copy control precedes the full instruction');
      renderedCopySources.push({language:lang,target,characters:Array.from(full).length});
    }
    const hrefs=startTags(html,'a').map(tag=>tag.attrs.href?.replace(/^https:\/\/beforeword\.xyz(?=\/)/,''));
    assert.ok(hrefs.includes('/model/evaluation/'+(lang==='en'?'en/':'')),'Instruction links to its language-matched evaluation');
    for (const [prefix,expected,edition] of [['',full,'full'],['full-',full,'full'],['5000-',medium,'medium'],['compact-',compact,'compact'],['micro-',compact,'compact']]) {
      const alias=`beforeword-${prefix}${lang}.txt`;
      assert.equal(read(path.join(MODEL,alias)),expected,'Instruction alias preserves exact source: '+alias);
      assert.deepEqual(manifest.aliases[alias],{language:lang,content:edition,sha256:hash(Buffer.from(expected))});
      if (['','5000-','compact-'].includes(prefix)) assert.ok(hrefs.includes('/model/'+alias),'Published download route: '+alias);
    }
    for (const [edition,filename] of [[full,`beforeword_core_${lang.toUpperCase()}.txt`],[medium,`beforeword_5000_${lang.toUpperCase()}.txt`],[compact,`beforeword_compact_${lang.toUpperCase()}.txt`]]) {
      assert.equal(read(path.join(MODEL,'toolkit',filename)),edition,'Toolkit text preserves selected source');
    }
    for (const [kind,record] of Object.entries(guide.native_bundles[lang])) {
      const bytes=fs.readFileSync(path.join(MODEL,'downloads',record.name));
      assert.equal(hash(bytes),record.sha256,'Native package matches guide metadata');
      assert.equal(record.language,lang);assert.equal(record.version,manifest.version);
      assert.deepEqual(bytes,Buffer.from(guideData.bundles[lang][kind].data,'base64'),'Site and standalone guide deliver identical native packages');
      assert.ok(hrefs.includes('/model/downloads/'+record.name),'Published native-package route');
    }
    for (const tag of tags) {
      for (const attribute of ['href','src']) {
        const target=tag.attrs[attribute];if (!target) continue;
        if (target.startsWith('#')) assert.ok(ids.includes(target.slice(1)),'Local fragment target exists: '+target);
        const relative=target.replace(/^https:\/\/beforeword\.xyz(?=\/)/,'');
        if (!relative.startsWith('/model/')) continue;
        const [pathname,fragment]=relative.split('#');
        const local=path.join(SITE,pathname.replace(/^\//,'')+(pathname.endsWith('/')?'index.html':''));
        assert.ok(fs.existsSync(local),'Local published link exists: '+target);
        if (fragment&&local.endsWith('.html')) assert.ok(startTags(read(local),'[a-z][\\w:-]*').some(node=>node.attrs.id===fragment),'Linked document fragment exists: '+target);
      }
      for (const attribute of ['aria-controls','aria-labelledby']) {
        for (const id of (tag.attrs[attribute]||'').split(/\s+/).filter(Boolean)) assert.ok(ids.includes(id),'Accessible control target exists: '+id);
      }
    }
    assert.ok(!html.includes('href="/model/history/'),'Current reader page does not promote dated history');
    if (!manifest.github_url) assert.ok(!hrefs.some(href=>href?.startsWith('https://github.com/')),'No invented repository URL');
  }
  assert.equal(Object.keys(manifest.aliases).length,10,'All ten instruction aliases are declared');
  // Public.js remains packaged for other surfaces, but is not the landing runtime.
  for (const extension of ['css','js']) {
    const bytes=fs.readFileSync(path.join(ROOT,`assets/public.${extension}`));
    const name=`public-${manifest.version}-${hash(bytes).slice(0,12)}.${extension}`;
    assert.deepEqual(fs.readFileSync(path.join(MODEL,'assets',name)),bytes,'Packaged legacy public asset retains its content-addressed name');
  }
  const checksums=read(path.join(MODEL,'SHA256SUMS.txt')).trim().split('\n');
  const names=[];
  for (const line of checksums) {
    const m=line.match(/^([a-f0-9]{64})  (.+)$/);assert.ok(m,'Well-formed SHA256SUMS line');
    assert.ok(!path.isAbsolute(m[2])&&!m[2].split('/').includes('..'),'Checksum paths stay within the artifact');
    names.push(m[2]);assert.equal(hash(fs.readFileSync(path.join(MODEL,m[2]))),m[1],'Checksum matches '+m[2]);
  }
  const files=[];
  function walk(directory) {for (const item of fs.readdirSync(directory,{withFileTypes:true})) {
    const file=path.join(directory,item.name);
    if(item.isDirectory()) walk(file);else if(item.isFile()&&item.name!=='SHA256SUMS.txt') files.push(path.relative(MODEL,file).split(path.sep).join('/'));
  }}
  walk(MODEL);assert.deepEqual(names,[...new Set(files)].sort(),'Checksums cover every artifact exactly once');
  const zipFiles=fs.readdirSync(path.join(MODEL,'downloads')).filter(file=>file.endsWith('.zip'));
  assert.equal(zipFiles.length,7,'Six native ZIPs and the source toolkit');
  assert.equal(hash(fs.readFileSync(path.join(MODEL,'downloads/beforeword_toolkit.zip'))),guide.developer_bundle.sha256,'Source toolkit matches guide metadata');
  assert.deepEqual(fs.readFileSync(path.join(MODEL,'downloads/beforeword_toolkit.zip')),Buffer.from(guideData.developer.data,'base64'),'Site and standalone guide deliver the same source toolkit');
  assert.equal(read(path.join(MODEL,'reports/eval-cases.jsonl')),read(path.join(ROOT,'references/eval-cases.jsonl')),'Methodology preserves supplied cases');
  for (const name of names.filter(name=>name.startsWith('assets/site-shell/')&&name.endsWith('.css'))) {
    for (const match of read(path.join(MODEL,name)).matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const local=path.resolve(path.dirname(path.join(MODEL,name)),match[1]);
      assert.ok(local.startsWith(MODEL+path.sep),'Shared CSS resources stay within the standalone section');
      assert.ok(fs.existsSync(local),'Shared CSS resource exists: '+match[1]);
    }
  }
  return {pages:2,checksums:checksums.length,zipFiles:zipFiles.length,renderedCopySources};
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


(async()=>{const artifacts=checkArtifacts();const historyFiles=checkHistory();const copyCases=await checkCopy();const navigationCases=checkNavigation();const instructionNavigationCases=checkInstructionNavigation();process.stdout.write(JSON.stringify({ok:true,...artifacts,historyFiles,legacyRuntimeUnitCases:{copyCases,navigationCases,instructionNavigationCases},currentLandingRuntime:"External root-site scripts preserved; execution requires browser testing",scope:'Static files and simulated DOM; no browser rendering'},null,2)+'\n');})().catch(error=>{console.error(error);process.exitCode=1;});
