import { randomBytes } from 'node:crypto';
import core from './analysis-core.cjs';

export const TTL_MS = 30 * 60 * 1000;
export const MAX_DOCUMENTS = 256;
export const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
export const SOURCE_ID = /^[A-Za-z0-9_-]{43}$/;
export const MAX_CHARS = core.MAX_CHARS;

export class SafeError extends Error {
  constructor(code) { super(code); this.code = code; }
}

// This process has no durable store. A capability identifies one immutable
// received string, not a person, original document, or certified interpretation.
export class DocumentStore {
  #documents = new Map();
  #bytes = 0;
  #timer;
  constructor({ clock = Date.now, ttlMs = TTL_MS, maxDocuments = MAX_DOCUMENTS,
    maxBytes = MAX_SOURCE_BYTES, random = () => randomBytes(32).toString('base64url') } = {}) {
    this.clock = clock; this.ttlMs = ttlMs; this.maxDocuments = maxDocuments;
    this.maxBytes = maxBytes; this.random = random;
  }
  purge() {
    const now = this.clock();
    for (const [id, document] of this.#documents) {
      if (document.expires <= now) {
        this.#bytes -= document.source.length * 2;
        this.#documents.delete(id);
      }
    }
    this.#scheduleExpiry();
  }
  #scheduleExpiry() {
    clearTimeout(this.#timer); this.#timer = undefined;
    if (!this.#documents.size) return;
    const next = Math.min(...Array.from(this.#documents.values(), document => document.expires));
    this.#timer = setTimeout(() => this.purge(), Math.max(1, next - this.clock()));
    this.#timer.unref();
  }
  create(source, locale, suppliedBy) {
    core.validateInput({ text: source, language: locale });
    if (!['host', 'app'].includes(suppliedBy)) throw new SafeError('INVALID_INPUT');
    this.purge();
    const bytes = source.length * 2;
    if (this.#documents.size >= this.maxDocuments || this.#bytes + bytes > this.maxBytes)
      throw new SafeError('STORE_FULL');
    let sourceId;
    for (let attempt = 0; attempt < 4; attempt++) {
      const candidate = this.random();
      if (SOURCE_ID.test(candidate) && !this.#documents.has(candidate)) { sourceId = candidate; break; }
    }
    if (!sourceId) throw new SafeError('STORE_FULL');
    const expires = this.clock() + this.ttlMs;
    const document = Object.freeze({ sourceId, source, locale, suppliedBy, expires,
      expiresAt: new Date(expires).toISOString() });
    this.#documents.set(sourceId, document); this.#bytes += bytes;
    this.#scheduleExpiry();
    return document;
  }
  get(sourceId) {
    this.purge();
    if (typeof sourceId !== 'string' || !SOURCE_ID.test(sourceId) || !this.#documents.has(sourceId))
      throw new SafeError('SOURCE_NOT_FOUND');
    return this.#documents.get(sourceId);
  }
  clear() { clearTimeout(this.#timer); this.#timer = undefined; this.#documents.clear(); this.#bytes = 0; }
  get size() { this.purge(); return this.#documents.size; }
  get bytes() { this.purge(); return this.#bytes; }
}

export function validateReading(document, report) {
  // The browser validator deliberately accepts historical report forms. This
  // boundary only accepts compact v3; schema enforcement also occurs over MCP.
  if (!report || !Array.isArray(report.items) || report.items.some(item =>
    !item || Reflect.ownKeys(item).length !== 2 || !Object.hasOwn(item, 'quote') || !Object.hasOwn(item, 'reading')))
    throw new SafeError('INVALID_REPORT');
  return core.validateReport(report, { text: document.source, language: document.locale });
}

export function stateFor(document = null, report = null, locale = 'en') {
  return {
    sourceId: document?.sourceId ?? null,
    source: document?.source ?? '',
    locale: document?.locale ?? locale,
    suppliedBy: document?.suppliedBy ?? null,
    expiresAt: document?.expiresAt ?? null,
    maxChars: MAX_CHARS, ttlSeconds: TTL_MS / 1000, reportVersion: 3, report,
    validation: report ? 'literal-quotes-only' : null
  };
}
