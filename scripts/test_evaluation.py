#!/usr/bin/env python3
"""Check that the public evaluation path is readable HTML with intact source text."""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest
from urllib.parse import urlsplit

from render_report import parse_report
from current_model_wrapper import load as load_current_wrapper

ROOT = Path(__file__).resolve().parents[1]
SITE = None
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


class Element:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def find(self, tag=None, **attrs):
        result = []
        for child in self.children:
            if isinstance(child, Element):
                if (tag is None or child.tag == tag) and all(child.attrs.get(k) == v for k, v in attrs.items()):
                    result.append(child)
                result.extend(child.find(tag, **attrs))
        return result

    def text(self):
        return ''.join(child.text() if isinstance(child, Element) else child for child in self.children)


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Element()
        self.stack = [self.root]
        self.feed(source)
        self.close()
        assert len(self.stack) == 1, 'Unclosed HTML elements'

    def handle_starttag(self, tag, attrs):
        element = Element(tag, attrs)
        self.stack[-1].children.append(element)
        if tag not in VOID:
            self.stack.append(element)

    def handle_endtag(self, tag):
        assert len(self.stack) > 1 and self.stack[-1].tag == tag, 'Unbalanced HTML: '+tag
        self.stack.pop()

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_data(self, text):
        self.stack[-1].children.append(text)


def plain_inline(source):
    source = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', source)
    return source.replace('`', '')


def source_blocks(source):
    """Independent expected text: remove Markdown notation, preserving all wording."""
    blocks = []
    for line in source.splitlines()[1:]:
        if not line.strip() or re.fullmatch(r'\|[ :|\-]+\|', line):
            continue
        if line.startswith('|'):
            blocks.extend(plain_inline(cell.strip()) for cell in line.strip('|').split('|'))
        else:
            blocks.append(plain_inline(re.sub(r'^(?:## |\d+\. )', '', line)))
    return blocks


def normalize(text):
    return ' '.join(text.split())


class EvaluationDelivery(unittest.TestCase):
    def test_reader_routes_and_sources(self):
        for language in ('ru', 'en'):
            with self.subTest(language=language):
                suffix = 'en/' if language == 'en' else ''
                route = '/model/evaluation/'+suffix
                raw = (SITE / route.lstrip('/') / 'index.html').read_bytes()
                page = raw.decode('utf-8', errors='strict')
                self.assertIn(b'<meta charset="utf-8">', raw[:1024])
                self.assertNotIn('\ufffd', page)
                self.assertNotRegex(page, r'__[A-Z][A-Z0-9_]+__')
                doc = Document(page).root
                self.assertEqual(doc.find('html')[0].attrs['lang'], language)
                self.assertEqual(doc.find('link', rel='canonical')[0].attrs['href'], 'https://beforeword.xyz'+route)
                self.assertEqual(len(doc.find('main')), 1)
                self.assertEqual(len(doc.find('h1')), 1)
                ids = [n.attrs['id'] for n in doc.find() if 'id' in n.attrs]
                self.assertEqual(len(ids), len(set(ids)))
                for lang, url in [('ru', '/model/evaluation/'), ('en', '/model/evaluation/en/')]:
                    self.assertEqual(doc.find('link', rel='alternate', hreflang=lang)[0].attrs['href'], 'https://beforeword.xyz'+url)
                other = '/model/evaluation/en/' if language == 'ru' else '/model/evaluation/'
                other_language = 'en' if language == 'ru' else 'ru'
                # Each route retains its own captured published shell. The current
                # landing and reader have different navigation implementations.
                snapshot = Document(load_current_wrapper(language, evaluation=True)).root
                headers = doc.find('header', id='bw-site-top')
                self.assertEqual(len(headers), 1)
                header = headers[0]
                original_header = snapshot.find('header', id='bw-site-top')[0]
                def navigation_contract(scope):
                    return [(a.attrs.get('href'), a.attrs.get('aria-label'), a.attrs.get('data-nav'))
                            for a in scope.find('a')]
                self.assertEqual(navigation_contract(header), navigation_contract(original_header))
                self.assertTrue(header.find('nav'), 'Reader header retains accessible navigation')
                switch = header.find('button', id='language')
                self.assertEqual(len(switch), 1)
                self.assertTrue(switch[0].attrs.get('aria-label'))
                self.assertEqual(switch[0].attrs, original_header.find('button', id='language')[0].attrs)
                self.assertEqual(switch[0].text(), other_language.upper())
                footer = doc.find('footer', **{'class': 'site-footer'})
                self.assertEqual(len(footer), 1)
                self.assertEqual(navigation_contract(footer[0]), navigation_contract(snapshot.find('footer', **{'class': 'site-footer'})[0]))
                self.assertEqual(len(footer[0].find('a', href='/model/'+suffix)), 1)
                for scope in (header, footer[0]):
                    brand = scope.find('a', **{'class': 'brand'})
                    self.assertEqual(len(brand), 1)
                    self.assertIn('beforeword', brand[0].attrs.get('aria-label', '').lower())
                    self.assertTrue(brand[0].find('svg'), 'Approved complete wordmark is present')
                self.assertFalse(doc.find('a', **{'aria-current': 'page'}))
                source = ROOT / 'references' / ('evaluation.ru.md' if language == 'ru' else 'evaluation.md')
                article = doc.find('article', id='evaluation-content')[0]
                self.assertEqual(doc.find('h1')[0].text(), source.read_text(encoding='utf-8').splitlines()[0][2:])
                actual = [node.text() for node in article.find() if node.tag in {'h2', 'p', 'li', 'th', 'td'}]
                self.assertEqual([normalize(x) for x in actual], [normalize(x) for x in source_blocks(source.read_text(encoding='utf-8'))])
                markdown = source.read_text(encoding='utf-8')
                self.assertEqual(len(article.find('h2')), len(re.findall(r'^## ', markdown, re.M)))
                self.assertEqual(len(article.find('ol')), 1)
                self.assertEqual(len(article.find('li')), len(re.findall(r'^\d+\. ', markdown, re.M)))
                self.assertNotRegex(article.text(), r'Asia/Bangkok|\bUTC\b|\b2026\b|[bB][wW]-\d+|gpt-6|not_met|\.jsonl?\b')
                self.assertFalse([node for node in article.find('code') if node.text() in {'met', 'not_met', 'unclear'}])
                self.assertFalse(article.find('pre'))
                self.assertFalse(article.find('script'))
                raw_url = '/model/reports/evaluation.'+language+'.md'
                download = doc.find('a', href=raw_url)[0]
                self.assertIn('download', download.attrs)
                self.assertIn('MD', download.text())
                self.assertEqual((SITE / raw_url.lstrip('/')).read_bytes(), source.read_bytes())
                for node in doc.find():
                    url = node.attrs.get('href', node.attrs.get('src', ''))
                    if url.startswith('/model/'):
                        path = SITE / urlsplit(url).path.lstrip('/')
                        self.assertTrue(path.exists(), url)
                for link in article.find('a'):
                    self.assertIn('download', link.attrs)
                    path = urlsplit(link.attrs['href']).path
                    self.assertEqual((SITE / path.lstrip('/')).read_bytes(), (ROOT / 'references' / Path(path).name).read_bytes())

                landing = Document((SITE / 'model' / suffix / 'index.html').read_text(encoding='utf-8')).root
                links = landing.find('a', href=route)
                self.assertEqual(len(links), 1, 'Current instruction section links once to the readable report')
                self.assertNotIn('download', links[0].attrs)
                self.assertTrue(landing.find('section', id='medium-details'), 'Back link has an existing target')
                language_links = landing.find('a', **{'class': 'lang-link'})
                self.assertEqual(len(language_links), 1)
                self.assertEqual(language_links[0].attrs['href'], '/model/'+('en/' if language == 'ru' else ''))
                # Retain the current source/download routes even though the old
                # generated "advanced" container no longer exists on this page.
                for target in ('/model/release.json', '/model/SHA256SUMS.txt', '/model/reports/validation-1.2.4.json'):
                    matches = [a for a in landing.find('a') if urlsplit(a.attrs.get('href', '')).path == target]
                    self.assertEqual(len(matches), 1)
                    self.assertTrue((SITE / target.lstrip('/')).is_file())
                css = lambda tree: [n.attrs['href'] for n in tree.find('link', rel='stylesheet')]
                scripts = lambda tree: [n.attrs['src'] for n in tree.find('script') if 'src' in n.attrs]
                normalize_css = lambda values: [re.sub(r'/public-\d+\.\d+\.\d+-', '/public-VERSION-', value) for value in values]
                self.assertEqual(normalize_css(css(doc)), normalize_css(css(snapshot)), 'Reader preserves style payload hashes while refreshing the selected-version alias')
                self.assertEqual(scripts(doc), scripts(snapshot), 'Reader preserves language/theme/navigation scripts')
                landing_snapshot = Document(load_current_wrapper(language)).root
                self.assertEqual(css(landing), css(landing_snapshot), 'Landing preserves its current styles')
                for tag, klass in (('header', 'site-header'), ('footer', 'wrap sf-footer')):
                    current_scope = landing.find(tag, **{'class': klass})
                    source_scope = landing_snapshot.find(tag, **{'class': klass})
                    self.assertEqual(len(current_scope), 1)
                    self.assertEqual(len(source_scope), 1)
                    self.assertEqual(navigation_contract(current_scope[0]), navigation_contract(source_scope[0]))

    def test_escaping_and_unsupported_input(self):
        title, body = parse_report('# Текст 中文 🙂\n\n## Проверка\n\nСлово `<script>alert(1)</script>` и x < y & z.\n')
        self.assertEqual(title, 'Текст 中文 🙂')
        self.assertNotIn('<script>', body)
        self.assertIn('&lt;script&gt;', body)
        self.assertEqual(Document(body).root.find('p')[0].text(), 'Слово <script>alert(1)</script> и x < y & z.')
        for block in ['[link](javascript:alert)', '[link](../secret)', '[link](https://example.com)', '### Unsupported', '- item', '> quote', '```code', '1. first\n3. skipped', '| a | b |\n|---|---|\n| one |']:
            with self.subTest(block=block), self.assertRaises(ValueError):
                parse_report('# Title\n\n## Section\n\n'+block+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', type=Path, required=True)
    args, rest = parser.parse_known_args()
    SITE = args.site.resolve()
    unittest.main(argv=[__file__]+rest)
