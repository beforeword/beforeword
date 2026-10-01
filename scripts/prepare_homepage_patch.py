#!/usr/bin/env python3
"""Prepare two homepage instruction edits from a supplied current site snapshot."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BLOCK = re.compile(r'(<pre\b[^>]*\bid=["\']bwk-instruction["\'][^>]*>)(.*?)(</pre\s*>)', re.I | re.S)


def prepare(site: Path, output: Path) -> dict:
    site = site.resolve(strict=True)
    output = output.resolve()
    if output == site or site in output.parents or output == ROOT or ROOT in output.parents:
        raise ValueError('Output must be outside the source site and this package.')
    if output.exists():
        raise ValueError('Output must be a new directory; no existing files are overwritten.')
    edits = []
    for language, relative in (('ru', 'index.html'), ('en', 'en/index.html')):
        source = site / relative
        if source.is_symlink():
            raise ValueError(f'Refusing symlink: {relative}')
        raw = source.read_bytes()
        text = raw.decode('utf-8')
        matches = list(BLOCK.finditer(text))
        if len(matches) != 1:
            raise ValueError(f'{relative}: expected exactly one pre#bwk-instruction; found {len(matches)}. Review the current page manually.')
        match = matches[0]
        instruction = ((ROOT / 'assets' / f'scope.{language}.txt').read_text(encoding='utf-8').rstrip('\n')
                       + '\n\n' + (ROOT / 'assets' / f'core.{language}.txt').read_text(encoding='utf-8'))
        result = (text[:match.start(2)] + html.escape(instruction, quote=False) + text[match.end(2):]).encode('utf-8')
        edits.append((relative, result, {'path': relative, 'source_sha256': hashlib.sha256(raw).hexdigest(),
                                      'result_sha256': hashlib.sha256(result).hexdigest(),
                                      'change': 'Only the inner text of pre#bwk-instruction is replaced.'}))
    output.mkdir(parents=True)
    for relative, result, _ in edits:
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(result)
    manifest = {'status': 'prepared; source snapshot must match current deployed homepage before upload',
                'files': [entry for _, _, entry in edits],
                'deployment': 'not_performed'}
    (output / 'homepage-patch.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.site, args.output), ensure_ascii=False, indent=2))
    except (OSError, ValueError) as exc:
        parser.exit(2, f'{exc}\n')
