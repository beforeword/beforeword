#!/usr/bin/env python3
"""Preserve the 28 September model pages from a supplied website archive.

Only page/resource URLs, indexing metadata, and a clearly separate archive
banner change. The historical comparison text and eight instruction downloads
are preserved. Run once with --site ROOT --output NEW_EMPTY_DIRECTORY.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re

PUBLIC = '/model/history/2026-09-28/'


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def snapshot(site: Path, output: Path) -> Path:
    site, output = site.resolve(), output.resolve()
    if output.exists() or output == site or site in output.parents:
        raise ValueError('Use a new output directory outside the supplied site.')
    files: dict[str, bytes] = {}
    sources: dict[str, dict] = {}

    def original(relative: str) -> bytes:
        path = site / relative
        if path.is_symlink() or not path.is_file() or site not in path.resolve().parents:
            raise ValueError(f'Missing or unsafe source: {relative}')
        data = path.read_bytes()
        sources[relative] = {'sha256': digest(data), 'bytes': len(data)}
        return data

    resources = set()
    for language, relative in (('ru', 'model/index.html'), ('en', 'model/en/index.html')):
        raw = original(relative)
        page = raw.decode('utf-8')
        if page.count('id="comparison-20260927"') != 1:
            raise ValueError('Expected exactly one historical comparison per page.')
        resources.update(re.findall(r'(?:href|src)="(/assets/[^"?#]+)"', page))
        page = page.replace('/model/', PUBLIC).replace('/assets/', PUBLIC + 'assets/')
        page, count = re.subn(r'<meta\b[^>]*name="robots"[^>]*>', '<meta name="robots" content="noindex,follow">', page)
        if count != 1:
            raise ValueError('Expected exactly one robots meta element.')
        title = 'Архив: редакция от 28 сентября 2026' if language == 'ru' else 'Archive: 28 September 2026 edition'
        note = ('Сохранённая страница с прежними примерами, инструкциями и авторской сводкой. Слова «текущая редакция» ниже относятся к этой архивной странице. '
                if language == 'ru' else 'A preserved page with earlier examples, instructions, and the author’s summary. “Current edition” below refers to this archived page. ')
        current = '/model/' + ('en/' if language == 'en' else '')
        label = 'Открыть актуальную инструкцию' if language == 'ru' else 'Open the current instructions'
        banner = ('<aside class="beforeword-archive-notice" aria-label="'+title+'"><strong>'+title+'</strong><p>'+note+
                  '<a href="'+current+'">'+label+'</a>.</p></aside>')
        page, count = re.subn(r'(<body\b[^>]*>)', lambda m: m[1]+'\n'+banner, page, count=1)
        if count != 1:
            raise ValueError('Expected a page body.')
        page = page.replace('</head>', '<link rel="stylesheet" href="'+PUBLIC+'assets/archive-notice.css">\n</head>', 1)
        output_relative = 'index.html' if language == 'ru' else 'en/index.html'
        files[output_relative] = page.encode('utf-8')

    while resources:
        resource = sorted(resources)[0]
        resources.remove(resource)
        relative = resource.lstrip('/')
        if relative in files:
            continue
        data = original(relative)
        if Path(relative).suffix in ('.css', '.js', '.svg'):
            text = data.decode('utf-8')
            resources.update(item for item in re.findall(r'["\'](/assets/[^"\')?#]+)', text) if item.lstrip('/') not in files)
            data = text.replace('/assets/', PUBLIC+'assets/').encode('utf-8')
        files[relative] = data

    for language in ('ru', 'en'):
        for prefix in ('', 'full-', 'compact-', 'micro-'):
            name = f'beforeword-{prefix}{language}.txt'
            files[name] = original('model/'+name)
    files['assets/archive-notice.css'] = (
        '.beforeword-archive-notice{max-width:74rem;margin:1rem auto;padding:1rem 1.25rem;'
        'border:2px solid currentColor;background:#fffdf5;color:#171715;font:1rem/1.55 system-ui,sans-serif}'
        '.beforeword-archive-notice p{margin:.5rem 0 0}.beforeword-archive-notice a{color:inherit;text-decoration:underline}'
        '@media(max-width:40rem){.beforeword-archive-notice{margin:.75rem;padding:.8rem}}\n'
    ).encode('utf-8')
    manifest = {'edition':'2026-09-28', 'source':'BW 210.zip supplied by the project owner',
                'public_base':PUBLIC, 'purpose':'Historical material; not current instructions or a new evaluation.',
                'changes':['Internal model and resource URLs point into this snapshot.', 'Robots metadata changed to noindex,follow.',
                           'A separate archive notice and its stylesheet were added.'],
                'source_files':sources, 'snapshot_files':{name:{'sha256':digest(data),'bytes':len(data)} for name,data in sorted(files.items())}}
    files['snapshot.json'] = (json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    output.mkdir(parents=True)
    for name,data in files.items():
        target=output/name
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(data)
    return output


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    print(snapshot(args.site,args.output))
