#!/usr/bin/env python3
"""Apply the reviewed current-version wording correction only."""
from pathlib import Path
import argparse
import importlib.util
import json
import os

HERE = Path(__file__).resolve().parent
SITE = Path('/home/befohuyc/public_html')
BACKUPS = Path('/root/beforeword-boundary-20261112/wording-followup-state')
spec = importlib.util.spec_from_file_location('boundary_wording_engine', HERE / 'patch_site.py')
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)


def run(command, site=SITE, backups=BACKUPS):
    site, backups = engine.roots(site, backups)
    pointer = backups / 'selected.json'
    manifest_hash = engine.sha((HERE / 'overlays.json').read_bytes())
    patch_hash = engine.sha((HERE / 'exact-patches.json').read_bytes())
    if command == 'prepare' and not pointer.exists():
        # Verify the full old-page hashes before checking the declared exact
        # replacements; freeze only after both checks agree with the payload.
        plan = engine.build_plan(site, HERE / 'empty-patches.json', HERE / 'overlays.json')
        patches = json.loads((HERE / 'exact-patches.json').read_text())['patches']
        outputs = {e['path']: e['after']['sha256'] for e in plan['entries']}
        for name in sorted({p['path'] for p in patches}):
            _, raw = engine.get_file(site, name)
            after = engine.replace_text(raw, [p for p in patches if p['path'] == name], name)
            engine.need(engine.sha(after) == outputs[name], 'Exact patch and payload disagree: ' + name)
        result = engine.prepare(site, backups, HERE / 'empty-patches.json', HERE / 'overlays.json')
        record = {'release': result['release'], 'manifest_sha256': manifest_hash, 'patch_sha256': patch_hash}
        engine.write_private(pointer, (json.dumps(record) + '\n').encode())
        return {'status': 'prepared', 'release': result['release'], 'files': 7}
    engine.need(pointer.is_file() and not pointer.is_symlink(), 'Prepare this follow-up first')
    record = json.loads(pointer.read_text())
    engine.need(record['manifest_sha256'] == manifest_hash and record['patch_sha256'] == patch_hash, 'Prepared follow-up changed')
    release = record['release']
    if command == 'prepare':
        result = engine.verify(site, backups, release)
        engine.need(result['state'] == 'prepared', 'Follow-up is already applied or rolled back')
        return {'status': 'prepared', 'release': release, 'reused': True}
    return getattr(engine, command)(site, backups, release)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'apply', 'verify', 'rollback'])
    args = parser.parse_args()
    engine.need(os.geteuid() == 0, 'Use the authorized root console')
    try:
        print(json.dumps(run(args.command), separators=(',', ':')))
    except Exception as error:
        print(json.dumps({'status': 'stopped', 'error_type': type(error).__name__}), flush=True)
        raise SystemExit(1)
