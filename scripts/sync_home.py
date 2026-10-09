#!/usr/bin/env python3
"""Update only the AI instruction area in supplied current RU/EN homepages.

Read current index.html and en/index.html from --source-root and write the two
updated pages under --site-root after build_public.py. Other homepage content
is preserved byte for byte; this tool does not fetch or deploy a website.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
from pathlib import Path
import re

import public_updates
from release_contract import ROOT, require_selected


def replace_one(source: str, pattern: str, replacement: str, label: str) -> str:
    found = list(re.finditer(pattern, source, re.S))
    if len(found) != 1:
        raise ValueError(f'Expected exactly one {label}; found {len(found)}')
    match = found[0]
    return source[:match.start()] + replacement + source[match.end():]


def replace_inside(source: str, tag: str, element_id: str, content: str) -> str:
    pattern = rf'(<{tag}\b[^>]*\bid="{re.escape(element_id)}"[^>]*>)(.*?)(</{tag}>)'
    matches = list(re.finditer(pattern, source, re.S))
    if len(matches) != 1:
        raise ValueError(f'Expected exactly one {element_id}')
    match = matches[0]
    return source[:match.start(2)] + content + source[match.end(2):]


def update(source: str, language: str) -> tuple[str, dict]:
    require_selected(ROOT)
    if not re.search(rf'<html\b[^>]*\blang="{language}"', source):
        raise ValueError('Homepage language does not match the requested language')
    original = source
    edits = []
    fragment = public_updates.render(language).replace(
        'class="bw-update-shell"', 'class="bw-update-shell bwh-inline-updates"', 1)
    pattern = r'<aside\b[^>]*\bclass="bw-update-shell(?: bwh-inline-updates)?"[^>]*>.*?</aside>'
    source = replace_one(source, pattern, fragment, 'homepage update panel')
    edits.append('shared update panel')
    for extension in ('css', 'js'):
        source = replace_one(
            source, rf'/model/assets/updates-[a-f0-9]+\.{extension}',
            f'/model/assets/{public_updates.asset_name(extension)}', f'update {extension} URL')
        edits.append(f'update {extension} URL')

    for edition, element_id, details_id in (
        ('medium', 'bwk-instruction-5000', 'bwk-instruction-5000-details'),
        ('core', 'bwk-instruction', 'bwk-instruction-details'),
    ):
        exact = (ROOT / f'assets/{edition}.{language}.txt').read_bytes().decode('utf-8')
        source = replace_inside(source, 'pre', element_id, html.escape(exact, quote=False))
        count = f'{len(exact):,}'.replace(',', '\u2009')
        if language == 'ru':
            label = 'Инструкция до 5 000 знаков' if edition == 'medium' else 'Полная инструкция'
            summary = f'{label} · {count} знаков'
        else:
            label = 'Instructions up to 5,000 characters' if edition == 'medium' else 'Full instructions'
            summary = f'{label} · {count} characters'
        pattern = rf'(<details\b[^>]*\bid="{details_id}"[^>]*><summary>).*?(</summary>)'
        match = list(re.finditer(pattern, source, re.S))
        if len(match) != 1:
            raise ValueError(f'Expected one summary for {details_id}')
        item = match[0]
        source = source[:item.start()] + item.group(1) + summary + item.group(2) + source[item.end():]
        edits.append(f'exact {edition} text and character count')

    # This note is outside both copy targets and does not change either edition.
    old_note = ('Выбери одну редакцию. Число знаков включает весь копируемый текст.' if language == 'ru'
                else 'Choose one edition. The count includes the entire copied text.')
    new_note = ('Полная инструкция ниже сохранена в версии 1.3.3 по результатам сравнения. Редакция до 5 000 знаков подготовлена отдельно и в этом тесте не проверялась. Число знаков включает весь копируемый текст.' if language == 'ru'
                else 'The full instructions below were retained in version 1.3.3 after the comparison. The 5,000-character edition was prepared separately and was not evaluated in that test. Character counts include the complete text copied.')
    if source.count(old_note) == 1:
        source = source.replace(old_note, new_note, 1)
    elif source.count(new_note) != 1:
        raise ValueError('Expected one current homepage edition note')
    edits.append('edition scope note outside copied text')
    if re.search(r'\b1\.2\.[34]\b', source):
        raise ValueError('An old instruction version remains on the homepage')
    for edition, element_id in (('core', 'bwk-instruction'), ('medium', 'bwk-instruction-5000')):
        match = re.search(rf'<pre\b[^>]*\bid="{element_id}"[^>]*>(.*?)</pre>', source, re.S)
        expected = (ROOT / f'assets/{edition}.{language}.txt').read_bytes()
        if not match or html.unescape(match.group(1)).encode('utf-8') != expected:
            raise ValueError('Homepage copy target differs from its instruction source')
    return source, {'language': language, 'source_sha256': hashlib.sha256(original.encode()).hexdigest(),
                    'result_sha256': hashlib.sha256(source.encode()).hexdigest(), 'edits': edits}


def sync(source_root: Path, site_root: Path) -> list[dict]:
    if source_root.resolve() == site_root.resolve():
        raise ValueError('Source and destination must be separate directories')
    pending = []
    for language, relative in (('ru', Path('index.html')), ('en', Path('en/index.html'))):
        path = source_root / relative
        if path.is_symlink() or not path.is_file():
            raise ValueError('Expected a regular current homepage source')
        result, receipt = update(path.read_bytes().decode('utf-8'), language)
        pending.append((site_root / relative, result, receipt))
    for destination, result, receipt in pending:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(result.encode('utf-8'))
    return [receipt for _, _, receipt in pending]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--site-root', type=Path, required=True)
    args = parser.parse_args()
    for receipt in sync(args.source_root, args.site_root):
        print(json.dumps(receipt, ensure_ascii=False))


if __name__ == '__main__':
    main()
