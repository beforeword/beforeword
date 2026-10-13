"""Retain the published book navigation around generated instruction content.

The captured wrapper refers to existing root-site assets. No asset, homepage,
instruction or historical snapshot is fetched or changed by this module.
"""
from __future__ import annotations

import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / 'assets/site-wrapper/published-20261013.json'


def load() -> dict:
    value = json.loads(SNAPSHOT.read_text(encoding='utf-8'))
    expected = {'model/index.html', 'model/en/index.html',
                'model/evaluation/index.html', 'model/evaluation/en/index.html'}
    if value.get('schema_version') != 1 or set(value.get('pages', {})) != expected:
        raise ValueError('Unexpected published site-wrapper snapshot')
    for page in value['pages'].values():
        if not re.fullmatch(r'[a-f0-9]{64}', page.get('source_sha256', '')):
            raise ValueError('Missing wrapper-source digest')
        if 'data-beforeword-ui' not in page['header'] or 'data-beforeword-ui' not in page['footer']:
            raise ValueError('Published wrapper must retain its reader-exclusion markers')
    return value


def _replace_once(source: str, pattern: str, replacement: str, label: str) -> str:
    matches = list(re.finditer(pattern, source, re.S))
    if len(matches) != 1:
        raise ValueError(f'Expected one {label}; found {len(matches)}')
    match = matches[0]
    return source[:match.start()] + replacement + source[match.end():]


def apply(source: str, language: str, *, evaluation: bool = False) -> str:
    if language not in ('ru', 'en'):
        raise ValueError('Unsupported wrapper language')
    if any(token in source for token in ('class="bw-site-header"', 'book-theme-init-',
                                         'book-design-', 'book-shell-', 'beforeword-reader.js')):
        raise ValueError('Template already contains a site wrapper; review before replacing it')
    snapshot = load()
    relative = 'model/' + ('evaluation/' if evaluation else '') + ('en/' if language == 'en' else '') + 'index.html'
    page = snapshot['pages'][relative]
    if not page['html_tag'].startswith(f'<html lang="{language}" '):
        raise ValueError('Published wrapper language differs from generated content')
    result = _replace_once(source, rf'<html lang="{language}">', page['html_tag'], 'unwrapped html element')
    result = _replace_once(result, r'<header class="bw-header">.*?</header>', page['header'], 'unwrapped header')
    result = _replace_once(result, r'<footer class="bw-footer">.*?</footer>', page['footer'], 'unwrapped footer')
    first_style = result.find('<link rel="stylesheet"')
    if first_style < 0:
        raise ValueError('Generated page has no stylesheet insertion point')
    result = result[:first_style] + snapshot['before_styles'] + '\n' + result[first_style:]
    result = _replace_once(result, r'</head>', snapshot['head_end'] + '\n</head>', 'head end')
    result = _replace_once(result, r'</body>', snapshot['body_end'] + '\n</body>', 'body end')
    for resource in snapshot['external_assets']:
        if result.count('"' + resource + '"') != 1:
            raise ValueError('Published root-site asset must appear exactly once: ' + resource)
    return result
