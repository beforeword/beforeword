#!/usr/bin/env python3
"""Check public update artifacts and accessibility hooks; no browser rendering."""
from __future__ import annotations

import argparse
import ast
from datetime import datetime
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest
import xml.etree.ElementTree as ET

import public_updates

ROOT = Path(__file__).resolve().parents[1]
SITE = None
ATOM = '{http://www.w3.org/2005/Atom}'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def find(self, tag=None, **attrs):
        found = []
        for node in self.children:
            if isinstance(node, Node):
                if (tag is None or node.tag == tag) and all(node.attrs.get(k) == v for k, v in attrs.items()):
                    found.append(node)
                found.extend(node.find(tag, **attrs))
        return found

    def text(self):
        return ''.join(node.text() if isinstance(node, Node) else node for node in self.children)


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(source)
        self.close()
        assert len(self.stack) == 1, 'Unclosed HTML element'

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        assert len(self.stack) > 1 and self.stack[-1].tag == tag, 'Unbalanced HTML: ' + tag
        self.stack.pop()

    def handle_data(self, text):
        self.stack[-1].children.append(text)


def pages():
    for language, suffix in [('ru', ''), ('en', 'en/')]:
        yield language, SITE / ('model/' + suffix + 'index.html')
        home = SITE / (suffix + 'index.html')
        if home.exists():
            yield language, home


class UpdatesDelivery(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'references/updates.json').read_text(encoding='utf-8'))

    def test_metadata_version_and_exact_json(self):
        module = ast.parse((ROOT / 'scripts/build_guide.py').read_text(encoding='utf-8'))
        versions = [ast.literal_eval(node.value) for node in module.body if isinstance(node, ast.Assign)
                    and any(isinstance(target, ast.Name) and target.id == 'VERSION' for target in node.targets)]
        self.assertEqual(versions, [self.data['current_version']])
        manifest = json.loads((SITE / 'model/release.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['version'], self.data['current_version'])
        self.assertEqual(self.data['status'], 'public-testing')
        self.assertEqual((SITE / 'model/updates.json').read_bytes(), (ROOT / 'references/updates.json').read_bytes())
        updated = datetime.fromisoformat(self.data['updated'].replace('Z', '+00:00'))
        self.assertIsNotNone(updated.utcoffset(), 'Publication timestamp has an explicit timezone')

    def test_shared_fragment_controls_and_static_copy(self):
        for language, path in pages():
            with self.subTest(page=str(path.relative_to(SITE))):
                raw = path.read_bytes()
                page = raw.decode('utf-8', errors='strict')
                self.assertNotIn('\ufffd', page)
                doc = Document(page).root
                self.assertTrue(doc.find('meta', charset='utf-8'))
                fragment = public_updates.render(language)
                self.assertEqual(page.count(fragment), 1, 'The same generated component is used exactly once')
                self.assertEqual(len(doc.find('aside', **{'class': 'bw-update-shell'})), 1)
                component = doc.find('aside', **{'class': 'bw-update-shell'})[0]
                all_ids = [node.attrs['id'] for node in doc.find() if 'id' in node.attrs]
                self.assertEqual(len(all_ids), len(set(all_ids)), 'IDs remain unique across the host page')
                ids = {node.attrs['id']: node for node in component.find() if 'id' in node.attrs}
                disclosure = ids['bw-updates']
                self.assertEqual(disclosure.tag, 'details')
                self.assertNotIn('open', disclosure.attrs, 'The status remains compact before interaction')
                self.assertEqual(next(node for node in disclosure.children if isinstance(node, Node)).tag, 'summary')
                for node in component.find():
                    for attr in ('aria-controls', 'aria-labelledby', 'aria-describedby'):
                        for target in node.attrs.get(attr, '').split():
                            self.assertIn(target, ids, attr + ' resolves inside the component')
                    if 'for' in node.attrs:
                        self.assertIn(node.attrs['for'], ids, 'Every form field has a resolved label')
                    if 'data-update-copy' in node.attrs:
                        self.assertIn(node.attrs['data-update-copy'], ids, 'Copy controls have a real field')
                        self.assertEqual(node.attrs.get('type'), 'button')
                self.assertEqual(len(component.find('button')), 2)
                instruction_link = component.find('a', **{'class': 'bw-update-instructions'})
                self.assertEqual(len(instruction_link), 1)
                target = '/model/' + ('en/' if language == 'en' else '') + '#instruction-details'
                self.assertEqual(instruction_link[0].attrs['href'], target)
                target_page = SITE / target.split('#')[0].lstrip('/') / 'index.html'
                self.assertEqual(len(Document(target_page.read_text(encoding='utf-8')).root.find('details', id='instruction-details')), 1)
                self.assertFalse(component.find('form'), 'The component does not submit a task or user data')
                for field_id in ('bw-update-prompt', 'bw-update-feed-url'):
                    self.assertIn('readonly', ids[field_id].attrs)
                    self.assertEqual(len(component.find('label', **{'for': field_id})), 1)
                prompt = ids['bw-update-prompt'].text()
                self.assertIn('https://beforeword.xyz/model/updates.json', prompt)
                self.assertRegex(prompt, r'(?<![\d.])' + re.escape(self.data['current_version']) + r'(?!\d|\.\d)')
                self.assertIn('успешного создания задачи' if language == 'ru' else 'successfully created the task', prompt)
                self.assertIn('не обещай фоновое отслеживание' if language == 'ru' else 'do not promise background monitoring', prompt)
                follow = component.find('section', **{'class': 'bw-update-follow'})[0]
                note = follow.find('p', **{'class': 'bw-update-note'})[0].text()
                self.assertRegex(note, r'копирование\b[^.]*\bне\b[^.]*(?:включает|создаёт)' if language == 'ru'
                                 else r'[Cc]opying\b[^.]*(?:does not|doesn’t|doesn\'t)\b')
                self.assertEqual(ids['bw-update-feed-url'].attrs['value'], f'https://beforeword.xyz/model/updates-{language}.atom')
                changes = component.find('section', **{'class': 'bw-update-release'})[0].find('li')
                self.assertEqual([node.text() for node in changes], self.data['languages'][language]['changes'])
                statuses = component.find('p', **{'class': 'bw-update-feedback'})
                self.assertEqual(len(statuses), 1)
                status = statuses[0]
                self.assertEqual(status.attrs['role'], 'status')
                self.assertEqual(status.attrs['aria-live'], 'polite')
                self.assertEqual(status.attrs['aria-atomic'], 'true')
                self.assertNotEqual(status.attrs['data-copied'], status.attrs['data-feed-copied'])
                self.assertTrue(status.attrs['data-selected'] and status.attrs['data-failed'])
                self.assertEqual(status.text(), '', 'Static HTML does not claim copying or tracking succeeded')

    def test_asset_hashes_and_feed_discovery(self):
        for language, path in pages():
            with self.subTest(page=str(path.relative_to(SITE))):
                doc = Document(path.read_text(encoding='utf-8')).root
                for extension, tag, attribute in [('css', 'link', 'href'), ('js', 'script', 'src')]:
                    source = (ROOT / f'assets/updates.{extension}').read_bytes()
                    digest = hashlib.sha256(source).hexdigest()[:12]
                    url = f'/model/assets/updates-{digest}.{extension}'
                    assets = doc.find(tag, **{attribute: url})
                    self.assertEqual(len(assets), 1, 'The filename keys the asset to its content')
                    self.assertEqual((SITE / url.lstrip('/')).read_bytes(), source)
                    if extension == 'js':
                        self.assertIn('defer', assets[0].attrs)
                discovery = doc.find('link', rel='alternate', type='application/atom+xml')
                self.assertEqual(len(discovery), 1)
                self.assertEqual(discovery[0].attrs['href'], f'/model/updates-{language}.atom')
                self.assertEqual(discovery[0].attrs['title'], self.data['languages'][language]['title'])

    def test_atom_content_and_language_routes(self):
        for language in ('ru', 'en'):
            with self.subTest(language=language):
                raw = (SITE / f'model/updates-{language}.atom').read_bytes()
                raw.decode('utf-8', errors='strict')
                self.assertRegex(raw[:100], br'encoding=[\'"]utf-8[\'"]')
                feed = ET.fromstring(raw)
                self.assertEqual(feed.tag, ATOM + 'feed')
                self.assertEqual(feed.attrib['{http://www.w3.org/XML/1998/namespace}lang'], language)
                self.assertEqual(feed.findtext(ATOM + 'id'), f'https://beforeword.xyz/model/updates-{language}.atom')
                self.assertEqual(feed.findtext(ATOM + 'title'), self.data['languages'][language]['title'])
                self.assertEqual(feed.findtext(ATOM + 'updated'), self.data['updated'])
                self.assertEqual(feed.findtext(ATOM + 'author/' + ATOM + 'name'), 'beforeword')
                self.assertEqual(feed.findtext(ATOM + 'author/' + ATOM + 'uri'), 'https://beforeword.xyz/')
                links = {link.attrib['rel']: link.attrib for link in feed.findall(ATOM + 'link')}
                self.assertEqual(links['self']['href'], f'https://beforeword.xyz/model/updates-{language}.atom')
                self.assertEqual(links['self']['type'], 'application/atom+xml')
                self.assertEqual(links['alternate']['href'], self.data['urls'][language])
                expected_route = 'https://beforeword.xyz/model/' + ('en/' if language == 'en' else '') + '#bw-updates'
                self.assertEqual(self.data['urls'][language], expected_route)
                entries = feed.findall(ATOM + 'entry')
                self.assertEqual(len(entries), 1)
                entry = entries[0]
                self.assertEqual(entry.findtext(ATOM + 'id'), f"urn:beforeword:instructions:{self.data['current_version']}:{language}")
                self.assertEqual(entry.findtext(ATOM + 'title'), 'beforeword ' + self.data['current_version'])
                self.assertEqual(entry.findtext(ATOM + 'updated'), self.data['updated'])
                self.assertEqual(entry.find(ATOM + 'link').attrib['href'], expected_route)
                summary = entry.find(ATOM + 'summary')
                self.assertEqual(summary.attrib['type'], 'text')
                release = self.data['languages'][language]
                self.assertEqual(summary.text, release['intro'] + '\n\n' + '\n'.join(release['changes']))
                self.assertEqual(len(summary), 0, 'Feed content is text rather than executable markup')

    def test_animation_scope_and_reduced_motion(self):
        css = (ROOT / 'assets/updates.css').read_text(encoding='utf-8')
        animations = re.findall(r'(?<![\w-])animation\s*:\s*([^;}]+)', css)
        active = [value for value in animations if value.strip() != 'none']
        self.assertEqual(len(active), 1)
        self.assertIn('bw-spiral-draw', active[0])
        times = re.findall(r'(?<![\w.])([\d.]+)(ms|s)\b', active[0])
        self.assertIn(len(times), (1, 2), 'Animation declares a duration and at most one delay')
        seconds = [float(value) / (1000 if unit == 'ms' else 1) for value, unit in times]
        self.assertGreater(seconds[0], 0)
        self.assertIn('infinite', active[0], 'Repeat while the panel is open')
        open_selector = '.bw-update-shell .bw-updates[open]>summary .bw-update-spiral path'
        normal = css.split('@media(prefers-reduced-motion:reduce)')[0]
        rule = re.search(re.escape(open_selector) + r'\{([^}]+)\}', normal)
        self.assertIsNotNone(rule, 'Animation belongs only to the outer open panel')
        self.assertIn('animation:' + active[0], rule[1])
        self.assertRegex(normal, r'\.bw-update-spiral path\{[^}]*stroke-dashoffset:0[^}]*\}', 'Closed state keeps the complete mark')
        reduced = re.search(r'@media\s*\(prefers-reduced-motion\s*:\s*reduce\)(.*?)(?=@media|\Z)', css, re.S)
        self.assertIsNotNone(reduced)
        self.assertIn('animation:none', reduced[1])
        self.assertIn(open_selector + '{animation:none', reduced[1], 'Reduced-motion override has the same specificity')
        for match in re.finditer(r'(?:^|[{}])\s*([^{}]+)\{', css):
            selector = match[1].strip()
            if selector.startswith('@') or all(re.fullmatch(r'from|to|[\d.]+%', part.strip()) for part in selector.split(',')):
                continue
            self.assertTrue(all(part.strip().startswith('.bw-update-shell') for part in selector.split(',')),
                            'Style selectors stay inside the component: ' + selector)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', type=Path, required=True)
    args, rest = parser.parse_known_args()
    SITE = args.site.resolve()
    unittest.main(argv=[__file__] + rest)
