'use strict';

/* Deterministic extraction of displayed definitions from Wiktionary.
 * A lookup sends one explicitly chosen word/phrase, never its surrounding text.
 * Definition wording is not generated. HTML whitespace is rendered as a space;
 * examples, citations, navigation and executable markup are not definitions.
 * Dictionary labels and links remain editorial choices, not a reader's thoughts.
 */
(function exposeBeforewordDictionary(root) {
  const MAX_QUERY = 120;
  const MAX_BYTES = 2 * 1024 * 1024;
  const MAX_SENSES = 120;
  const TIMEOUT_MS = 15000;
  const POS = new Set(['Noun', 'Proper noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Determiner', 'Article', 'Preposition', 'Postposition', 'Conjunction', 'Interjection', 'Particle', 'Numeral', 'Number', 'Phrase', 'Proverb', 'Idiom', 'Contraction', 'Prefix', 'Suffix', 'Infix', 'Circumfix', 'Interfix', 'Combining form', 'Letter', 'Symbol', 'Punctuation mark', 'Abbreviation', 'Initialism', 'Acronym', 'Participle']);
  const REMOVE = 'script,style,iframe,object,embed,img,source,link,base,table,dl,ul,ol,sup.reference,.reference,.example-fullblock,.example-block,.citation,.quotation,.h-usage-example,.h-quotation,.mw-editsection,.mw-empty-elt,.maintenance-line,.defdate,.HQToggle,.nyms-toggle,.nyms';

  function fail(code) { const error = new Error(code); error.code = code; throw error; }
  const rendered = value => value.replace(/[\t\n\r\f ]+/g, ' ').replace(/^[\t\n\r\f ]+|[\t\n\r\f ]+$/g, '');
  function validate(word, language) {
    if (typeof word !== 'string' || !['en', 'ru'].includes(language)) fail('INVALID_INPUT');
    if (word.length > MAX_QUERY) fail('INPUT_TOO_LONG');
    if (/\p{C}/u.test(word)) fail('INVALID_INPUT');
    const lookup = word.trim();
    if (!lookup) fail('EMPTY_INPUT');
    // Ordinary dictionary titles, including spaces, apostrophes and hyphens.
    // Namespace and URL syntax are not accepted as lookup words.
    if (!/\p{L}/u.test(lookup) || !/^[\p{L}\p{M}\p{N}\p{Zs}’'\-‑.]+$/u.test(lookup) || lookup.split(/\p{Zs}+/u).length > 8) fail('INVALID_INPUT');
    return lookup;
  }
  function tokenize(text) {
    if (typeof text !== 'string') fail('INVALID_INPUT');
    const segments = [];
    const expression = /[\p{L}\p{M}\p{N}]+(?:[’'\-‑][\p{L}\p{M}\p{N}]+)*/gu;
    let offset = 0;
    for (const match of text.matchAll(expression)) {
      if (match.index > offset) segments.push({ text: text.slice(offset, match.index), start: offset, end: match.index, isWord: false });
      const end = match.index + match[0].length;
      segments.push({ text: match[0], start: match.index, end, isWord: true });
      offset = end;
    }
    if (offset < text.length) segments.push({ text: text.slice(offset), start: offset, end: text.length, isWord: false });
    return segments;
  }
  function sourceFor(language, title, revision) {
    const origin = `https://${language}.wiktionary.org`;
    const pageUrl = `${origin}/wiki/${encodeURIComponent(title)}`;
    return {
      name: language === 'ru' ? 'Викисловарь · участники' : 'Wiktionary · contributors',
      url: `${origin}/w/index.php?title=${encodeURIComponent(title)}&oldid=${revision}`,
      pageUrl, historyUrl: `${origin}/w/index.php?title=${encodeURIComponent(title)}&action=history`,
      revision, snapshot: `revision ${revision}`, license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      extraction: 'Rendered definition text; ASCII HTML whitespace collapsed; examples, quotations, references and navigation excluded. No paraphrase. Definitions and labels are dictionary writing.'
    };
  }
  function headingOf(node) {
    if (/^H[1-6]$/.test(node.tagName)) return node;
    return node.classList?.contains('mw-heading') ? node.querySelector('h1,h2,h3,h4,h5,h6') : null;
  }
  function textOnly(node) {
    const clone = node.cloneNode(true);
    for (const removed of clone.querySelectorAll(REMOVE)) removed.remove();
    return rendered(clone.textContent || '');
  }
  function safeTitle(anchor, language) {
    const href = anchor.getAttribute('href') || '';
    if (!href.startsWith('/wiki/')) return null;
    try {
      const target = decodeURIComponent(href.slice(6).split('#')[0]).replace(/_/g, ' ');
      validate(target, language);
      return target;
    } catch { return null; }
  }
  function parseResponse(payload, query, language, options = {}) {
    const lookup = validate(query, language);
    const transformations = lookup === query ? [] : ['trim'];
    if (payload?.error) {
      if (payload.error.code === 'missingtitle') return { query, lookup, language, status: 'missing', entries: [], source: null, transformations };
      if (payload.error.code === 'invalidtitle') fail('INVALID_INPUT');
      fail('SOURCE_ERROR');
    }
    const parsed = payload?.parse;
    if (!parsed || typeof parsed.title !== 'string' || !Number.isSafeInteger(parsed.revid) || parsed.revid <= 0 || typeof parsed.text !== 'string') fail('UNSUPPORTED');
    try { validate(parsed.title, language); } catch { fail('UNSUPPORTED'); }
    if (new TextEncoder().encode(parsed.text).byteLength > MAX_BYTES) fail('RESPONSE_TOO_LARGE');
    const Parser = options.DOMParser || root.DOMParser;
    if (typeof Parser !== 'function') fail('UNSUPPORTED');
    // Strip resource-bearing/executable elements before parsing an inert document.
    const textTags = new Set(['div', 'span', 'p', 'ol', 'li', 'ul', 'dl', 'dd', 'dt', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'b', 'strong', 'i', 'em', 'small', 'sup', 'sub', 'abbr', 'br']);
    const html = parsed.text.replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<(\/?)([a-z][a-z0-9:-]*)\b([^>]*)>/gi, (tag, slash, name, attributes) => {
      name = name.toLowerCase();
      if (!textTags.has(name)) return '';
      if (slash) return `</${name}>`;
      // Keep only extraction metadata. No style, event or resource attributes.
      const kept = [];
      for (const match of attributes.matchAll(/\s(class|id|href|lang|title)\s*=\s*("[^"]*"|'[^']*')/gi)) kept.push(`${match[1]}=${match[2]}`);
      return `<${name}${kept.length ? ' ' + kept.join(' ') : ''}>`;
    });
    const document = new Parser().parseFromString(html, 'text/html');
    const container = document.querySelector('.mw-parser-output');
    if (!container) fail('UNSUPPORTED');
    const source = sourceFor(language, parsed.title, parsed.revid);
    const entries = [];
    let active = false, sawLanguage = false, pos = '', sectionId = '', definitions = false, current = null, count = 0, omitted = 0;
    const languageLevel = language === 'en' ? 2 : 1;
    const languageName = language === 'en' ? 'English' : 'Русский';

    function newEntry(id, label) {
      current = { id: `${language}:${parsed.revid}:${id}:${entries.length + 1}`, word: parsed.title, pos: label, senses: [] };
      entries.push(current);
    }
    function append(listItem, path, parents = [], inflection = false) {
      const gloss = textOnly(listItem);
      const directChildren = Array.from(listItem.children).filter(node => node.tagName === 'OL');
      if (gloss) {
        if (count >= MAX_SENSES) omitted += 1;
        else {
          const formOf = [];
          const anchors = inflection ? listItem.querySelectorAll('a[href]') : listItem.querySelectorAll('.form-of-definition-link a[href]');
          for (const anchor of anchors) {
            if (anchor.closest('.example-fullblock,.example-block,dl')) continue;
            const title = safeTitle(anchor, language);
            if (title && !formOf.includes(title)) formOf.push(title);
          }
          current.senses.push({ id: `${current.id}:${path}`, glosses: [...parents, gloss], formOf });
          count += 1;
        }
      }
      for (const nested of directChildren) {
        Array.from(nested.children).filter(node => node.tagName === 'LI').forEach((item, index) => append(item, `${path}.${index + 1}`, gloss ? [...parents, gloss] : parents, inflection));
      }
    }

    for (const node of container.children) {
      const heading = headingOf(node);
      if (heading) {
        const level = Number(heading.tagName.slice(1));
        const label = rendered(heading.textContent || '');
        if (level === languageLevel) {
          active = label === languageName;
          if (active) sawLanguage = true;
          definitions = false; current = null; pos = ''; sectionId = '';
          continue;
        }
        if (!active) continue;
        if (language === 'en') {
          definitions = POS.has(label);
          current = null;
          if (definitions) { pos = label; sectionId = heading.id || label; }
        } else {
          definitions = label === 'Значение' || label === 'Значения';
          current = null;
          if (level === 2) pos = label.match(/\(([^)]+)\)/)?.[1] || label;
          sectionId = heading.id || label;
        }
        continue;
      }
      if (!active) continue;
      if (definitions && node.tagName === 'OL') {
        newEntry(sectionId, pos);
        Array.from(node.children).filter(item => item.tagName === 'LI').forEach((item, index) => append(item, String(index + 1)));
      } else if (language === 'ru' && node.tagName === 'UL' && !definitions) {
        const forms = Array.from(node.children).filter(item => item.tagName === 'LI' && /^форма\s/u.test(textOnly(item)));
        if (forms.length) {
          newEntry('form', 'словоформа');
          forms.forEach((item, index) => append(item, String(index + 1), [], true));
        }
      }
    }
    if (!sawLanguage) return { query, lookup, language, status: 'missing', entries: [], source, transformations };
    const useful = entries.filter(entry => entry.senses.length);
    if (!useful.length) fail('UNSUPPORTED');
    const result = { query, lookup, language, status: 'found', entries: useful, source, transformations };
    if (omitted) result.truncation = { shownSenses: count, omittedSenses: omitted, limit: MAX_SENSES };
    return result;
  }

  async function readBounded(response) {
    if (Number(response.headers?.get('content-length')) > MAX_BYTES) fail('RESPONSE_TOO_LARGE');
    if (!response.body?.getReader) {
      const value = await response.text();
      if (new TextEncoder().encode(value).byteLength > MAX_BYTES) fail('RESPONSE_TOO_LARGE');
      return JSON.parse(value);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0, text = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); fail('RESPONSE_TOO_LARGE'); }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      return JSON.parse(text);
    } finally { reader.releaseLock(); }
  }
  async function lookup(word, language, options = {}) {
    const selected = validate(word, language);
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    if (options.signal?.aborted) fail('ABORTED');
    options.signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
    const fetcher = options.fetch || root.fetch;
    async function request(title) {
      const params = new URLSearchParams({ action: 'parse', format: 'json', formatversion: '2', origin: '*', page: title, prop: 'text|revid', disableeditsection: '1', disabletoc: '1', redirects: '1' });
      const response = await fetcher(`https://${language}.wiktionary.org/w/api.php?${params}`, { method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) fail(response.status === 429 ? 'RATE_LIMITED' : 'SOURCE_UNAVAILABLE');
      return parseResponse(await readBounded(response), title, language, options);
    }
    try {
      let result = await request(selected);
      if (result.status === 'missing' && selected.toLocaleLowerCase(language) !== selected) {
        result = await request(selected.toLocaleLowerCase(language));
        result.transformations.unshift('lowercase');
      }
      result.query = word;
      if (selected !== word) result.transformations.unshift('trim');
      if (result.source && result.entries.some(entry => entry.word !== result.lookup)) result.transformations.push('source-redirect');
      return result;
    } catch (error) {
      if (timedOut) fail('TIMEOUT');
      if (controller.signal.aborted) fail('ABORTED');
      if (error.code) throw error;
      fail('SOURCE_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', cancel);
    }
  }
  const api = Object.freeze({ MAX_QUERY, MAX_BYTES, MAX_SENSES, tokenize, lookup, parseResponse, validate });
  root.BeforewordDictionary = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
