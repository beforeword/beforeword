#!/usr/bin/env python3
"""Verify an upload patch against its original website, without deploying it."""
from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import html
import json
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlsplit

from prepare_homepage_patch import BLOCK


class Page(HTMLParser):
    def __init__(self, text: str):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.links = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        # Canonical/hreflang point at public routes; all actual anchors/resources
        # still need to resolve against the combined original + patch tree.
        for key in ('href', 'src'):
            if attrs.get(key):
                self.links.append(attrs[key])


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(site: Path, release: Path) -> dict:
    site, release = site.resolve(), release.resolve()
    patch = release / 'public_html'
    manifest = json.loads((release / 'site-patch.json').read_text(encoding='utf-8'))
    expected = {entry['path']: entry for entry in manifest['files']}
    actual = {p.relative_to(patch).as_posix() for p in patch.rglob('*') if p.is_file()}
    assert actual == set(expected), 'Patch contents differ from manifest'
    for relative, entry in expected.items():
        assert sha(patch / relative) == entry['after_sha256'], relative
        original = site / relative
        assert (sha(original) if original.is_file() else None) == entry['before_sha256'], relative
    for entry in manifest['source_tree']:
        assert sha(site / entry['path']) == entry['sha256'], 'Source changed: ' + entry['path']
    for language, relative in (('ru', 'index.html'), ('en', 'en/index.html')):
        before = (site / relative).read_bytes().decode('utf-8')
        after = (patch / relative).read_bytes().decode('utf-8')
        b, a = BLOCK.search(before), BLOCK.search(after)
        assert b and a
        assert before[:b.start(2)] == after[:a.start(2)] and before[b.end(2):] == after[a.end(2):], 'Homepage changed beyond instruction'
        assert html.unescape(a.group(2)) == (patch / 'model' / f'beforeword-{language}.txt').read_text(encoding='utf-8'), 'Home and model instructions differ'
    before_map = (site / 'sitemap.xml').read_text(encoding='utf-8')
    after_map = (patch / 'sitemap.xml').read_text(encoding='utf-8')
    strip_dates = lambda text: re.sub(r'<lastmod>[^<]*</lastmod>', '', text)
    assert strip_dates(before_map) == strip_dates(after_map), 'Sitemap changed beyond dates'

    parsed = {}
    def resolve(relative, use_patch):
        candidate = patch / relative
        return candidate if use_patch and candidate.is_file() else site / relative

    def problems(relative, use_patch):
        source = resolve(relative, use_patch)
        content = source.read_text(encoding='utf-8')
        page = Page(content)
        missing = set()
        for link in page.links:
            full = urlsplit(urljoin('https://beforeword.xyz/' + relative, link))
            if full.scheme not in ('http', 'https') or full.netloc != 'beforeword.xyz':
                continue
            name = unquote(full.path).lstrip('/')
            if not name or name.endswith('/'):
                name += 'index.html'
            target = resolve(name, use_patch)
            if not target.is_file():
                missing.add((link, 'missing file'))
            elif full.fragment and target.suffix == '.html':
                key = str(target)
                if key not in parsed:
                    parsed[key] = Page(target.read_text(encoding='utf-8')).ids
                if unquote(full.fragment) not in parsed[key]:
                    missing.add((link, 'missing fragment'))
        return missing

    inherited = []
    pages = [name for name in expected if name.endswith('.html')]
    for relative in pages:
        current = problems(relative, True)
        prior = problems(relative, False) if (site / relative).is_file() else set()
        new = current - prior
        assert not new, f'{relative}: new unresolved links: {sorted(new)}'
        inherited.extend({'page': relative, 'link': link, 'reason': reason} for link, reason in sorted(current & prior))
    return {'ok': True, 'changed_or_added_files': len(expected), 'checked_html_pages': len(pages),
            'unchanged_source_files': len(manifest['source_tree']), 'new_broken_internal_links': 0,
            'inherited_unresolved_links': inherited, 'homepage_surrounding_bytes_preserved': True,
            'scope': 'Source hashes, byte preservation, instruction equality, sitemap and internal HTML links; no browser rendering'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', required=True, type=Path)
    parser.add_argument('--release', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(verify(args.site, args.release), ensure_ascii=False, indent=2))
