#!/usr/bin/env python3
"""Bounded extraction of the reviewed, public-only export. No network."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import tempfile
import zipfile

MAX_TOTAL = 256 * 1024 * 1024
MAX_FILE = 16 * 1024 * 1024


def need(ok, message):
    if not ok:
        raise ValueError(message)


def extract(archive, destination, digest, allowlist):
    archive, destination = Path(archive), Path(destination)
    need(re.fullmatch('[a-f0-9]{64}', digest), 'Expected SHA256 required')
    need(archive.stat().st_size <= MAX_TOTAL, 'Archive too large')
    need(hashlib.sha256(archive.read_bytes()).hexdigest() == digest, 'Archive SHA256 mismatch')
    need(not destination.exists() and not destination.is_symlink(), 'Destination must be absent')
    allow = json.loads(Path(allowlist).read_text())
    explicit = set(allow['explicit_paths'])
    blocked = {'ma','api','server','private','beforeword-private','beforeword-api'}
    with zipfile.ZipFile(archive) as z:
        items = z.infolist()
        names = [i.filename for i in items]
        need(len(items) <= 5000 and len(set(names)) == len(names), 'Duplicate or excessive entries')
        need(sum(i.file_size for i in items) <= MAX_TOTAL, 'Expanded archive too large')
        need('baseline.json' in names, 'Baseline metadata missing')
        for item in items:
            need(not item.is_dir() and not item.flag_bits & 1, 'Directory/encrypted entry refused')
            need(not stat.S_ISLNK(item.external_attr >> 16), 'Symlink entry refused')
            need(0 <= item.file_size < MAX_FILE, 'Entry too large')
        baseline = json.loads(z.read('baseline.json'))
        need(baseline['schema_version'] == 1 and baseline['source'] == 'live_public_static_files', 'Unexpected baseline')
        files = baseline['files']
        need(len(files) == len({row['path'] for row in files}), 'Duplicate manifest paths')
        need(set(names) == {'baseline.json'} | {'public/' + row['path'] for row in files}, 'Manifest/archive mismatch')
        for row in files:
            n = row['path']; p = PurePosixPath(n)
            need(isinstance(n,str) and re.fullmatch(r'[A-Za-z0-9_./+\-]+', n) and not p.is_absolute() and str(p) == n, 'Invalid path')
            need(all(part not in blocked and not part.startswith('.') for part in p.parts), 'Protected path')
            asset = any(n.startswith(root + '/') for root in allow['asset_roots']) and p.suffix in allow['asset_suffixes']
            need(n in explicit or asset, 'Path outside export allowlist')
            raw = z.read('public/' + n)
            need(len(raw) == row['size'] and hashlib.sha256(raw).hexdigest() == row['sha256'], 'Public file mismatch: ' + n)
        destination.parent.mkdir(parents=True,exist_ok=True)
        temporary = Path(tempfile.mkdtemp(prefix='public-export-checked-', dir=destination.parent))
        try:
            for name in names:
                target = temporary / name
                target.parent.mkdir(parents=True,exist_ok=True)
                with target.open('xb') as stream:
                    stream.write(z.read(name))
            os.rename(temporary, destination)
        except BaseException:
            shutil.rmtree(temporary)
            raise
    return {'status':'extracted','files':len(files),'missing':len(baseline.get('missing',[])),'destination':str(destination),'sha256':digest}


if __name__ == '__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('archive');ap.add_argument('destination');ap.add_argument('--sha256',required=True);ap.add_argument('--allowlist',required=True)
    args=ap.parse_args()
    print(json.dumps(extract(args.archive,args.destination,args.sha256,args.allowlist),indent=2))
