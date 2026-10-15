#!/usr/bin/env python3
"""Build the Chrome runtime archive, with an explicit file allowlist and hashes."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import stat
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    'analysis-core.js', 'analysis-examples.js', 'reading-guide.js', 'reading-guide.css',
    'analysis-model.js', 'reading-surface.js', 'background.js', 'form-core.js',
    'instructions.js', 'pages.js', 'pages.css', 'dictionary-core.js', 'dictionary-ui.js',
    'dictionary.css', 'panel.js', 'panel.html', 'panel.css', 'privacy.html', 'selection.js',
    'service-config.js', 'welcome.html', 'platform.js', 'providers.js', 'provider-auth.js',
    'assets/brand.svg', 'assets/icon-source.svg', 'icons/icon-16.png', 'icons/icon-32.png',
    'icons/icon-48.png', 'icons/icon-128.png', '_locales/en/messages.json',
    '_locales/ru/messages.json', 'manifest.json',
)

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def build(source):
    entries = {}
    for name in FILES:
        path = source / name
        if path.is_symlink() or any(p.is_symlink() for p in path.parents):
            raise ValueError('Symlink source refused: ' + name)
        entries[name] = path.read_bytes()
    manifest = json.loads(entries['manifest.json'])
    if manifest['manifest_version'] != 3 or manifest['version'] != '0.5.6':
        raise ValueError('Unexpected release manifest')
    if set(manifest['permissions']) != {'activeTab', 'scripting', 'storage', 'sidePanel', 'contextMenus'}:
        raise ValueError('Review changed permissions before packaging')
    if manifest['host_permissions'] != ['https://api.beforeword.xyz/*']:
        raise ValueError('Review changed mandatory hosts before packaging')
    for required in (manifest['background']['service_worker'], manifest['side_panel']['default_path'],
                     manifest['options_ui']['page'], *manifest['icons'].values()):
        if required not in entries:
            raise ValueError('Missing manifest resource: ' + required)
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, (2026, 10, 15, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
    raw = out.getvalue()
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        if archive.testzip() or {n: archive.read(n) for n in archive.namelist()} != entries:
            raise ValueError('ZIP byte verification failed')
    return raw, {name: {'sha256': digest(data), 'bytes': len(data)} for name, data in sorted(entries.items())}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'extension')
    parser.add_argument('--output', type=Path, default=ROOT / 'build')
    args = parser.parse_args()
    raw, members = build(args.source.resolve())
    if raw != build(args.source.resolve())[0]:
        raise ValueError('Non-deterministic build')
    args.output.mkdir(parents=True, exist_ok=True)
    name = 'beforeword-0.5.6-chrome.zip'
    (args.output / name).write_bytes(raw)
    report = {'version': '0.5.6', 'file': name, 'sha256': digest(raw), 'bytes': len(raw),
              'files': members, 'reproducible': True, 'storeSubmitted': False}
    (args.output / 'chrome-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'files'}))

if __name__ == '__main__':
    main()
