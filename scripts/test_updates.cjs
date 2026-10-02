#!/usr/bin/env node
'use strict';
// Runs the published component in a small DOM simulation, not a browser.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const SITE = path.resolve(process.argv[2] || 'build/site/public_html');
const read = file => fs.readFileSync(file, 'utf8');
const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
  if (entity[0] === '#') return String.fromCodePoint(entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10));
  return {amp:'&', lt:'<', gt:'>', quot:'"', apos:"'"}[entity.toLowerCase()];
});
const voidTags = new Set(['input', 'br', 'hr', 'img', 'meta', 'link']);

class Element {
  constructor(tag, attrs = {}, parent = null) {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.parent = parent;
    this.children = [];
    this.events = {};
    this.open = Object.hasOwn(attrs, 'open');
    this.focused = false;
    this.selected = false;
    this.addedClasses = [];
    this.dataset = Object.fromEntries(Object.entries(attrs).filter(([name]) => name.startsWith('data-'))
      .map(([name, value]) => [name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
    this.classList = {add: name => this.addedClasses.push(name)};
  }
  get textContent() { return this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  set textContent(text) { this.children = [text]; }
  get value() { return this.assignedValue ?? (this.tagName === 'TEXTAREA' ? this.textContent : this.attrs.value); }
  set value(value) { this.assignedValue = value; }
  matches(selector) {
    if (selector.startsWith('#')) return this.attrs.id === selector.slice(1);
    if (selector.startsWith('.')) return (this.attrs.class || '').split(/\s+/).includes(selector.slice(1));
    const attr = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if (attr) return Object.hasOwn(this.attrs, attr[1]) && (attr[2] === undefined || this.attrs[attr[1]] === attr[2]);
    return this.tagName.toLowerCase() === selector;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => typeof child === 'string' ? [] : [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { for (let node = this; node; node = node.parent) if (node.matches(selector)) return node; return null; }
  contains(target) { for (let node = target; node; node = node.parent) if (node === this) return true; return false; }
  addEventListener(name, callback) { this.events[name] = callback; }
  focus() { this.focused = true; }
  select() { if (this.failSelection) throw new Error('Selection unavailable'); this.selected = true; }
  setSelectionRange(start, end) { this.selection = [start, end]; }
  click() { assert.equal(typeof this.events.click, 'function'); return this.events.click(); }
}

function parse(fragment) {
  const document = new Element('document');
  const stack = [document];
  for (const token of fragment.match(/<[^>]*>|[^<]+/g) || []) {
    if (token.startsWith('</')) { stack.pop(); continue; }
    if (token.startsWith('<')) {
      const match = token.match(/^<([a-z][\w-]*)([\s\S]*?)\/?\s*>$/i);
      assert.ok(match, 'Supported component HTML token');
      const attrs = {};
      for (const a of match[2].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = decode(a[2] || '');
      const node = new Element(match[1], attrs, stack.at(-1));
      stack.at(-1).children.push(node);
      if (!voidTags.has(match[1]) && !token.endsWith('/>')) stack.push(node);
    } else stack.at(-1).children.push(decode(token));
  }
  assert.equal(stack.length, 1);
  return document.querySelector('.bw-update-shell');
}

function page(language) {
  const html = read(path.join(SITE, 'model', language === 'en' ? 'en/index.html' : 'index.html'));
  const fragment = html.match(/<aside class="bw-update-shell"[\s\S]*?<\/aside>/);
  const script = html.match(/<script src="(\/model\/assets\/updates-[a-f0-9]{12}\.js)" defer><\/script>/);
  assert.ok(fragment && script, 'Published component and hashed script exist');
  return {fragment:fragment[0], source:read(path.join(SITE, script[1].slice(1)))};
}

function run(language, options = {}) {
  const {fragment, source} = page(language);
  assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage)\b/.test(source),
    'The copy component does not create tracking, network requests, or saved state');
  const root = options.absentRoot ? null : parse(fragment);
  const events = {};
  const location = {hash:options.hash || ''};
  const copied = [];
  const foreign = new Element('input', {id:'outside-field', value:'outside'});
  const document = {
    querySelector(selector) { assert.equal(selector, '.bw-update-shell'); return root; },
    getElementById(id) {
      if (options.absentField === id) return null;
      if (options.foreignField === id) return foreign;
      return root?.querySelector('#' + id) || null;
    },
    documentElement:{classList:{add() { assert.fail('Readiness must not modify the host document'); }}}
  };
  const navigator = options.clipboard === 'absent' ? {} : {clipboard:{async writeText(text) {
    if (options.clipboard === 'rejected') throw new Error('Permission denied');
    copied.push(text);
  }}};
  vm.runInNewContext(source, {document, navigator, location, window:{addEventListener(name, callback) { events[name] = callback; }}});
  return {root, events, location, copied};
}

async function checkCopy(language) {
  let count = 0;
  const env = run(language);
  const feedback = env.root.querySelector('.bw-update-feedback');
  for (const id of ['bw-update-prompt', 'bw-update-feed-url']) {
    const field = env.root.querySelector('#' + id);
    const button = env.root.querySelector(`[data-update-copy="${id}"]`);
    const before = field.value;
    const details = field.closest('details');
    assert.equal(details.open, false);
    await button.click();
    assert.equal(env.copied.at(-1), before, 'Published field value reaches the clipboard unchanged');
    assert.equal(field.value, before);
    assert.equal(details.open, false, 'Successful copy does not expand optional source text');
    assert.equal(feedback.textContent, id === 'bw-update-feed-url' ? feedback.dataset.feedCopied : feedback.dataset.copied,
      'Feed and prompt have distinct correct feedback');
    count++;
  }
  assert.notEqual(feedback.dataset.feedCopied, feedback.dataset.copied);
  for (const clipboard of ['rejected', 'absent']) {
    for (const id of ['bw-update-prompt', 'bw-update-feed-url']) {
      const fallback = run(language, {clipboard});
      const field = fallback.root.querySelector('#' + id);
      const button = fallback.root.querySelector(`[data-update-copy="${id}"]`);
      const status = fallback.root.querySelector('.bw-update-feedback');
      const exact = field.value;
      const details = field.closest('details');
      assert.equal(details.open, false);
      await button.click();
      assert.equal(details.open, true, 'Manual-copy fallback reveals the previously hidden field');
      assert.ok(field.focused && field.selected);
      assert.deepEqual(field.selection, [0, exact.length]);
      assert.equal(field.value, exact);
      assert.equal(status.textContent, status.dataset.selected);
      assert.equal(fallback.copied.length, 0);
      count++;
    }
  }
  const failure = run(language, {clipboard:'rejected'});
  const field = failure.root.querySelector('#bw-update-prompt');
  field.failSelection = true;
  await failure.root.querySelector('[data-update-copy="bw-update-prompt"]').click();
  const status = failure.root.querySelector('.bw-update-feedback');
  assert.equal(status.textContent, status.dataset.failed);
  return count + 1;
}

async function checkUnicodeAndDefensiveCases() {
  let count = 0;
  for (const clipboard of ['success', 'rejected']) {
    const env = run('ru', {clipboard});
    const field = env.root.querySelector('#bw-update-prompt');
    const exact = 'Я  я\r\né|e\u0301|ё|е\u0308|A|А|\u00a0\n中文🙂 <script>& "\'';
    field.value = exact;
    await env.root.querySelector('[data-update-copy="bw-update-prompt"]').click();
    assert.equal(field.value, exact, 'No Unicode or newline normalization');
    if (clipboard === 'success') assert.equal(env.copied[0], exact);
    else assert.deepEqual(field.selection, [0, exact.length], 'Selection covers UTF-16 value including astral characters');
    count++;
  }
  const absent = run('en', {absentRoot:true});
  assert.equal(absent.root, null);
  assert.deepEqual(absent.events, {}, 'No root means no listener or class mutation');
  count++;
  for (const option of ['absentField', 'foreignField']) {
    const env = run('en', {[option]:'bw-update-prompt'});
    await env.root.querySelector('[data-update-copy="bw-update-prompt"]').click();
    assert.equal(env.copied.length, 0, 'Missing or out-of-component targets are ignored');
    assert.equal(env.root.querySelector('.bw-update-feedback').textContent, '');
    count++;
  }
  return count;
}

function checkNavigationAndScope() {
  let count = 0;
  for (const language of ['ru', 'en']) {
    const linked = run(language, {hash:'#bw-updates'});
    assert.equal(linked.root.querySelector('#bw-updates').open, true, 'Incoming Atom link reveals its target');
    assert.deepEqual(linked.root.addedClasses, ['bw-update-ready']);
    for (const node of linked.root.querySelectorAll('[class]')) assert.deepEqual(node.addedClasses, [], 'Readiness class is component-only');
    count++;
    const changed = run(language, {hash:'#unrelated'});
    const details = changed.root.querySelector('#bw-updates');
    assert.equal(details.open, false);
    changed.location.hash = '#bw-updates';
    changed.events.hashchange();
    assert.equal(details.open, true, 'Hash changes reveal updates without reloading');
    changed.location.hash = '#elsewhere';
    changed.events.hashchange();
    assert.equal(details.open, true, 'Other fragments do not unexpectedly close an open disclosure');
    count++;
  }
  return count;
}

(async () => {
  const copyCases = await checkCopy('ru') + await checkCopy('en');
  const defensiveCases = await checkUnicodeAndDefensiveCases();
  const navigationCases = checkNavigationAndScope();
  process.stdout.write(JSON.stringify({ok:true, copyCases, defensiveCases, navigationCases,
    scope:'Published scripts and simulated DOM; no browser rendering or automation creation'}, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
