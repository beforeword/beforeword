'use strict';

/* Exact-source partitioning for the reading surface. Offsets and limits use
 * UTF-16 units, like Selection ranges and analysis-core. No normalization,
 * trimming, omitted tail or automatic model request occurs here. Coverage
 * describes the partitioned source, never how much a model has examined.
 * Intl.Segmenter keeps extended grapheme clusters together. If unavailable,
 * the returned segmentation/warning explicitly reports the code-point-only
 * fallback; callers must show that limit or request a shorter selection.
 */
(function exposeBeforewordReadingSurface(root) {
  const MAX_CHARS = 12000;
  const MAX_TOTAL_CHARS = 240000;

  function fail(code) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  function safeBoundary(text, end, graphemeBoundaries) {
    if (graphemeBoundaries) {
      while (end > 0 && !graphemeBoundaries[end]) end--;
      return end;
    }
    if (end > 0 && end < text.length) {
      const previous = text.charCodeAt(end - 1);
      const next = text.charCodeAt(end);
      if ((previous >= 0xD800 && previous <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) ||
        (previous === 13 && next === 10)) return end - 1;
    }
    return end;
  }

  function splitPoint(text, start, maximum, graphemeBoundaries) {
    const end = safeBoundary(text, Math.min(text.length, start + maximum), graphemeBoundaries);
    if (end === text.length) return { end, boundary: 'end' };
    const window = text.slice(start, end);
    // Prefer a complete paragraph separator; every separator remains in the
    // preceding part. A single newline and then other whitespace are fallbacks.
    let paragraph = 0;
    const paragraphBreak = /(?:\r\n|\n|\r(?!\n))[\t ]*(?:\r\n|\n|\r(?!\n))+/g;
    for (const match of window.matchAll(paragraphBreak)) {
      const candidate = start + match.index + match[0].length;
      if (safeBoundary(text, candidate, graphemeBoundaries) === candidate) paragraph = candidate;
    }
    if (paragraph > start) return { end: paragraph, boundary: 'paragraph' };
    let line = 0;
    for (const match of window.matchAll(/\r\n|\n|\r/g)) {
      const candidate = start + match.index + match[0].length;
      if (safeBoundary(text, candidate, graphemeBoundaries) === candidate) line = candidate;
    }
    if (line > start) return { end: line, boundary: 'line' };
    // Keep a short early word from forcing an otherwise nearly empty part.
    let space = 0;
    for (const match of window.matchAll(/\p{White_Space}+/gu)) {
      const candidate = start + match.index + match[0].length;
      if (candidate >= start + Math.floor(maximum / 2) && safeBoundary(text, candidate, graphemeBoundaries) === candidate) space = candidate;
    }
    if (space > start) return { end: space, boundary: 'space' };
    return { end, boundary: 'limit' };
  }

  function graphemeIndex(text, maximum) {
    if (typeof Intl !== 'object' || typeof Intl.Segmenter !== 'function') return null;
    // One bounded pass, not a segmentation of the full source for every part.
    // The byte map also makes boundary lookup independent of the part count.
    const boundaries = new Uint8Array(text.length + 1);
    let previous = 0;
    const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text);
    for (const segment of segments) {
      if (segment.index - previous > maximum) fail('INPUT_GRAPHEME_TOO_LONG');
      boundaries[segment.index] = 1;
      previous = segment.index;
    }
    if (text.length - previous > maximum) fail('INPUT_GRAPHEME_TOO_LONG');
    boundaries[text.length] = 1;
    return boundaries;
  }

  function partition(text, options = {}) {
    if (typeof text !== 'string') fail('INVALID_INPUT');
    if (!options || typeof options !== 'object' || Array.isArray(options)) fail('INVALID_LIMITS');
    const { maxChars = MAX_CHARS, maxTotalChars = MAX_TOTAL_CHARS } = options;
    if (!Number.isSafeInteger(maxChars) || !Number.isSafeInteger(maxTotalChars) ||
      maxChars < 2 || maxChars > MAX_CHARS || maxTotalChars < maxChars || maxTotalChars > MAX_TOTAL_CHARS) fail('INVALID_LIMITS');
    if (text.length > maxTotalChars) fail('INPUT_TOO_LONG');
    const graphemeBoundaries = graphemeIndex(text, maxChars);
    const parts = [];
    let start = 0;
    while (start < text.length) {
      const point = splitPoint(text, start, maxChars, graphemeBoundaries);
      if (point.end <= start) fail('INVALID_LIMITS');
      parts.push({ index: parts.length, start, end: point.end, text: text.slice(start, point.end), boundary: point.boundary });
      start = point.end;
    }
    return {
      length: text.length,
      maxChars,
      maxTotalChars,
      segmentation: graphemeBoundaries ? 'grapheme' : 'code_point',
      warning: !graphemeBoundaries && text.length > maxChars ? 'GRAPHEME_SEGMENTATION_UNAVAILABLE' : null,
      parts,
      coverage: { start: 0, end: text.length, total: text.length, complete: true }
    };
  }

  const api = Object.freeze({ MAX_CHARS, MAX_TOTAL_CHARS, partition });
  root.BeforewordReadingSurface = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
