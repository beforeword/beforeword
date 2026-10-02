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
                self.assertEqual(len(doc.find('nav', **{'class': 'bw-language'})[0].find('a', href=other)), 1)
                self.assertTrue(doc.find('a', href='/model/'+suffix+'#checks'))
                self.assertTrue(doc.find('a', href='/model/'+suffix, **{'aria-current': 'location'}))
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
                links = landing.find('ul', **{'class': 'report-links'})[0].find('a')
                self.assertEqual(len(links), 1, 'Reader section has one clear destination')
                self.assertEqual(links[0].attrs['href'], route)
                self.assertNotIn('download', links[0].attrs)
                advanced = landing.find('section', id='advanced')[0].find('details')[0]
                self.assertNotIn('open', advanced.attrs)
                files = advanced.find('ul', **{'class': 'data-links'})[0].find('a')
                self.assertEqual(len(files), 3)
                for link, kind in zip(files, ['JSON', 'JSON', 'TXT']):
                    self.assertIn('download', link.attrs)
                    self.assertIn(kind, link.text())
                    self.assertIn('Скачать' if language == 'ru' else 'Download', link.text())
                css = lambda tree: [n.attrs['href'] for n in tree.find('link', rel='stylesheet')]
                landing_css = css(landing)
                update_css = [url for url in landing_css if re.fullmatch(r'/model/assets/updates-[a-f0-9]{12}\.css', url)]
                self.assertEqual(len(update_css), 1, 'The landing page includes its optional updates component style')
                self.assertEqual(css(doc), [url for url in landing_css if url not in update_css],
                                 'Reader and landing pages retain the same shared shell and public styles')
                for klass in ('bw-home', 'bw-links', 'bw-menu'):
                    self.assertEqual(doc.find(**{'class': klass})[0].text(), landing.find(**{'class': klass})[0].text())

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
