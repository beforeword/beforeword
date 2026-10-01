#!/usr/bin/env python3
"""Prepare an additive upload patch against an exact existing site snapshot.

No network access, deployment, or edits to the supplied site. The output must
be a new directory. public_html contains only new or changed website files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile

import build_public
import prepare_homepage_patch


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def prepare(site: Path, output: Path, repo_url: str | None = None) -> dict:
    site = site.resolve(strict=True)
    output = output.resolve()
    if output.exists():
        raise ValueError('Output must be a new directory; existing files are not overwritten.')
    if site == output or site in output.parents or output in site.parents:
        raise ValueError('Source and output must be separate directories.')
    if build_public.ROOT == output or build_public.ROOT in output.parents:
        raise ValueError('Use an output directory outside the source repository.')
    history = json.loads((build_public.ROOT / 'assets/history/2026-09-28/snapshot.json').read_text(encoding='utf-8'))
    for relative, record in history['source_files'].items():
        original = site / relative
        if not original.is_file() or digest(original.read_bytes()) != record['sha256']:
            raise ValueError('Current model material or resource differs from the preserved snapshot: ' + relative + '. Review and preserve the new source before replacing it.')
    # Validate both homepages and the sitemap before creating the release.
    with tempfile.TemporaryDirectory(prefix='beforeword-home-') as temporary:
        home = Path(temporary) / 'patch'
        home_manifest = prepare_homepage_patch.prepare(site, home)
        sitemap_raw = (site / 'sitemap.xml').read_bytes()
        sitemap = sitemap_raw.decode('utf-8')
        updated_urls = []
        targets = {'https://beforeword.xyz/', 'https://beforeword.xyz/en/',
                   'https://beforeword.xyz/model/', 'https://beforeword.xyz/model/en/'}

        def update_url(match: re.Match) -> str:
            block = match.group(0)
            location = re.search(r'<loc>([^<]+)</loc>', block)
            if not location or location.group(1) not in targets:
                return block
            updated_urls.append(location.group(1))
            replacement = '<lastmod>' + build_public.build_guide.DATE + '</lastmod>'
            if '<lastmod>' in block:
                return re.sub(r'<lastmod>[^<]*</lastmod>', replacement, block, count=1)
            return block.replace('</loc>', '</loc>' + replacement, 1)

        sitemap_result = re.sub(r'<url\b[^>]*>.*?</url>', update_url, sitemap, flags=re.S)
        if set(updated_urls) != targets or len(updated_urls) != 4:
            raise ValueError('Expected exactly one sitemap entry for each updated public page.')
        public = build_public.build(output, repo_url)
        for entry in home_manifest['files']:
            relative = entry['path']
            destination = public / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(home / relative, destination)
        (public / 'sitemap.xml').write_bytes(sitemap_result.encode('utf-8'))

    files = []
    for result in sorted(public.rglob('*')):
        if not result.is_file():
            continue
        relative = result.relative_to(public).as_posix()
        original = site / relative
        if original.is_symlink():
            raise ValueError('Refusing source symlink: ' + relative)
        before = digest(original.read_bytes()) if original.is_file() else None
        after = digest(result.read_bytes())
        if before == after:
            result.unlink()
            continue
        files.append({'path': relative, 'action': 'replace' if before else 'add',
                      'before_sha256': before, 'after_sha256': after,
                      'bytes': result.stat().st_size})
    manifest = {
        'version': build_public.build_guide.VERSION,
        'status': 'prepared_against_supplied_snapshot; not_deployed',
        'files': files,
        'delete': [],
        'homepage_changes': home_manifest['files'],
        'sitemap_changes': {'lastmod_only': updated_urls, 'date_utc': build_public.build_guide.DATE},
        'source_tree': [{'path': p.relative_to(site).as_posix(), 'sha256': digest(p.read_bytes())}
                        for p in sorted(site.rglob('*')) if p.is_file()],
    }
    (output / 'site-patch.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (output / 'INSTALL_RU.txt').write_text(
        'beforeword ' + build_public.build_guide.VERSION + ' — обновление существующего сайта\n\n'
        '1. Сохрани резервную копию текущего public_html.\n'
        '2. Загрузи СОДЕРЖИМОЕ public_html из этого архива в public_html сайта, подтвердив замену одноимённых файлов.\n'
        '   Не создавай второй вложенный public_html. Удалять существующие файлы не требуется.\n'
        '3. Очисти кеш сайта, если он включён.\n'
        '4. Открой /model/ и /model/en/, проверь копирование, загрузки и переключение языка на компьютере и телефоне.\n'
        '   Проверь главную страницу на обоих языках: кнопка запроса с beforeword должна копировать новую полную инструкцию.\n\n'
        'В главных страницах заменён только текст pre#bwk-instruction; остальное сохранено.\n'
        'В sitemap.xml обновлены только даты четырёх изменённых страниц.\n'
        'Прежние страницы /model/ и их TXT сохранены в /model/history/2026-09-28/.\n'
        'site-patch.json содержит исходные и новые хеши. Если после исходного архива сайт менялся, сначала сверь изменённые файлы.\n'
        'Архив подготовлен локально. Загрузка на хостинг и проверка опубликованных страниц не выполнялись.\n', encoding='utf-8')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--github-url', type=build_public.github_url)
    args = parser.parse_args()
    try:
        result = prepare(args.site, args.output, args.github_url)
        print(json.dumps({'files': len(result['files']), 'output': str(args.output.resolve()),
                          'status': result['status']}, ensure_ascii=False))
    except (OSError, ValueError) as exc:
        parser.exit(2, f'{exc}\n')
