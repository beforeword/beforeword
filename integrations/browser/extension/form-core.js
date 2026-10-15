'use strict';

/* Local inspection of one supplied string. No DOM, model, network or storage.
 * Limits/offsets use UTF-16 code units; segments use the runtime's Unicode
 * grapheme segmentation. Nothing is trimmed, normalized, inferred or repaired.
 * A kind is a mechanical character category, not a reading of the writing.
 */
(function exposeBeforewordFormCore(root) {
  const MAX_CHARS = 12000;
  const ONLY_WHITESPACE = /^\p{White_Space}+$/u;
  const ONLY_SPACES = /^\p{Zs}+$/u;
  const LINE_BREAK = /^(?:\r\n|[\n\r\u000B\u000C\u0085\u2028\u2029])$/u;
  const ONLY_CONTROLS = /^[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]+$/u;

  function fail(code) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  function validate(text) {
    if (typeof text !== 'string') fail('INVALID_INPUT');
    if (text.length > MAX_CHARS) fail('INPUT_TOO_LONG');
    // Format controls (e.g. bidi marks, ZWSP, BOM) are not White_Space. They
    // remain inspectable even when the string contains only such controls.
    if (!text.length || ONLY_WHITESPACE.test(text)) fail('EMPTY_INPUT');
    return text;
  }

  function kind(text) {
    if (LINE_BREAK.test(text)) return 'linebreak';
    if (text === '\t') return 'tab';
    if (ONLY_SPACES.test(text)) return 'space';
    if (ONLY_CONTROLS.test(text)) return 'control';
    // The remaining clusters are classified "visible" for the UI. This name
    // does not guarantee glyph visibility in a particular font or browser.
    // A standalone combining mark is retained, not rewritten as a letter.
    return 'visible';
  }

  const unsupported = () => ({ supported: false, segments: [], count: null });

  function inspect(text) {
    validate(text);
    if (typeof root.Intl?.Segmenter !== 'function') return unsupported();
    try {
      const segmenter = new root.Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const segments = [];
      let nextOffset = 0;
      for (const part of segmenter.segment(text)) {
        // Do not silently accept a partial or altered result from an unsupported
        // implementation. The caller can still present validate(text) exactly.
        if (!part || typeof part.segment !== 'string' || !part.segment.length ||
          part.index !== nextOffset || part.segment !== text.slice(nextOffset, nextOffset + part.segment.length)) return unsupported();
        const start = nextOffset;
        const end = start + part.segment.length;
        if (end > text.length) return unsupported();
        segments.push({ text: part.segment, start, end, kind: kind(part.segment) });
        nextOffset = end;
      }
      if (nextOffset !== text.length) return unsupported();
      return { supported: true, segments, count: segments.length };
    } catch {
      // No Array.from / code-point / regex fallback: those could split a
      // combining sequence or emoji ZWJ cluster. The original is still usable.
      return unsupported();
    }
  }

  const api = Object.freeze({ MAX_CHARS, validate, inspect });
  root.BeforewordFormCore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
