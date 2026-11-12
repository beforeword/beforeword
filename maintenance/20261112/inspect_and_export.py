#!/usr/bin/env python3
"""Read-only, bounded source-location inventory. Run with python3 -I.

The CLI has one fixed private root. No source text, environment, command line,
unit contents, stderr or exception details are emitted. A static reference is
a candidate location, not a finding that a running process loaded that file.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

KNOWN_ROOT = Path('/home/befohuyc/beforeword-private')
MAX_FILE = 2 * 1024 * 1024
MAX_FILES = 5000
MAX_DIRECTORIES = 10000
MAX_TOTAL = 64 * 1024 * 1024
MAX_OUTPUT = 128 * 1024
MAX_RESULTS = 160
MAX_MATCHES = 80
MAX_LITERAL_CANDIDATES = 256
SOURCE_SUFFIXES = {'.js', '.cjs', '.mjs', '.py'}
DATA_SUFFIXES = {'.txt', '.json'}
PROPERTIES = ('Id', 'ActiveState', 'SubState', 'FragmentPath', 'WorkingDirectory', 'User', 'MainPID')
UNIT = re.compile(r'[A-Za-z0-9_@.:-]{1,180}\.service\Z')
SAFE_PATH = re.compile(r'[A-Za-z0-9_./+@-]{1,600}\Z')
SKIP_DIRECTORY = re.compile(r'(?:^|[-_])(?:backups?|releases?|caches?)(?:$|[-_])', re.I)
ACTIVE_FORBIDDEN_DIRECTORY = re.compile(r'(?:^|[-_])(?:backups?|caches?)(?:$|[-_])', re.I)
PROMPT_NAME = re.compile(r'(?:^|[._-])(?:core|instructions?|prompts?)(?:[._-]|$)', re.I)
CATEGORIES = (
    ('beforeword', re.compile(r'beforeword', re.I)),
    ('instruction', re.compile(r'instruction', re.I)),
    ('prompt', re.compile(r'prompt', re.I)),
)
# Only unescaped static strings. No interpolation, decoding or evaluation.
LITERAL = re.compile(r'''(["'])([A-Za-z0-9_./+@-]{1,600})\1''')


class Refused(Exception):
    pass


def safe_name(value):
    return isinstance(value, str) and bool(SAFE_PATH.fullmatch(value)) and all(len(p) <= 120 for p in value.split('/'))


def hidden_or_environment(parts):
    for part in parts:
        low = part.lower()
        if part.startswith('.') or low == 'env' or low.startswith('env.') or low.endswith('.env'):
            return True
    return False


def skipped_directory(name):
    return name.startswith('.') or name.lower() in {'node_modules', '__pycache__'} or bool(SKIP_DIRECTORY.search(name))


def allowed_file(path):
    return path.suffix.lower() in SOURCE_SUFFIXES or (path.suffix.lower() in DATA_SUFFIXES and bool(PROMPT_NAME.search(path.name)))


def canonical_candidate(root, path):
    """Resolve an explicit reference/active directory, never broaden the root."""
    if not safe_name(str(path)) or hidden_or_environment(path.parts):
        raise Refused()
    resolved = path.resolve(strict=True)
    relative = resolved.relative_to(root)
    if not safe_name(relative.as_posix()) or hidden_or_environment(relative.parts):
        raise Refused()
    return resolved


def read_regular(root, path):
    """Open each canonical component via pinned directory descriptors."""
    relative = path.relative_to(root)
    if not relative.parts or not safe_name(relative.as_posix()) or hidden_or_environment(relative.parts) or not allowed_file(path):
        raise Refused()
    if not hasattr(os, 'O_NOFOLLOW') or not hasattr(os, 'O_DIRECTORY'):
        raise Refused()
    flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_DIRECTORY
    directory = os.open(root, flags)
    fd = None
    try:
        for component in relative.parts[:-1]:
            child = os.open(component, flags, dir_fd=directory)
            os.close(directory)
            directory = child
        fd = os.open(relative.name, os.O_RDONLY | os.O_NOFOLLOW | getattr(os, 'O_NONBLOCK', 0), dir_fd=directory)
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_size > MAX_FILE:
            raise Refused()
        chunks, size = [], 0
        while True:
            chunk = os.read(fd, min(65536, MAX_FILE + 1 - size))
            if not chunk:
                break
            chunks.append(chunk)
            size += len(chunk)
            if size > MAX_FILE:
                raise Refused()
        after = os.fstat(fd)
        fields = ('st_dev', 'st_ino', 'st_size', 'st_mtime_ns', 'st_ctime_ns', 'st_mode', 'st_uid', 'st_gid', 'st_nlink')
        if any(getattr(before, k) != getattr(after, k) for k in fields) or size != before.st_size:
            raise Refused()
        raw = b''.join(chunks)
        return {'path': relative.as_posix(), 'size': size, 'sha256': hashlib.sha256(raw).hexdigest()}, raw
    finally:
        if fd is not None:
            os.close(fd)
        os.close(directory)


def systemctl_inventory(run=subprocess.run):
    """Capture only requested properties; never request ExecStart/environment."""
    def command(arguments):
        result = run(['systemctl', *arguments], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                     stderr=subprocess.DEVNULL, text=True, encoding='utf-8', errors='replace',
                     timeout=5, check=False, env={'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C', 'SYSTEMD_PAGER': ''})
        if result.returncode != 0 or len(result.stdout) > 1024 * 1024:
            raise Refused()
        return result.stdout
    try:
        names = set()
        for arguments in (['list-units', '--all', '--type=service', '--no-legend', '--no-pager', '--plain'],
                          ['list-unit-files', '--type=service', '--no-legend', '--no-pager']):
            for line in command(arguments).splitlines():
                fields = line.split()
                if fields and UNIT.fullmatch(fields[0]) and 'beforeword' in fields[0].lower():
                    names.add(fields[0])
        services = []
        for name in sorted(names)[:24]:
            raw = command(['show', name, '--no-pager', '--property=' + ','.join(PROPERTIES)])
            values = {}
            for line in raw.splitlines():
                key, sep, value = line.partition('=')
                if not sep or key not in PROPERTIES or key in values:
                    continue
                if key == 'Id':
                    if value == name:
                        values[key] = value
                elif key in {'ActiveState', 'SubState'}:
                    if re.fullmatch(r'[a-z-]{1,48}', value):
                        values[key] = value
                elif key == 'MainPID':
                    if re.fullmatch(r'[0-9]{1,10}', value):
                        values[key] = int(value)
                elif key == 'User':
                    if re.fullmatch(r'[A-Za-z0-9_.-]{0,80}', value):
                        values[key] = value
                elif value.startswith('/') and safe_name(value) and not hidden_or_environment(Path(value).parts):
                    values[key] = value
            if values.get('Id') == name:
                services.append(values)
        return 'available', services
    except (OSError, ValueError, subprocess.SubprocessError, Refused):
        return 'unavailable', []


def inspect(root=KNOWN_ROOT, services=None, services_status='not_requested'):
    root = Path(root)
    output = {'schema_version': 1, 'root': str(root), 'status': 'complete', 'services_status': services_status,
              'services': services or [], 'sources': [], 'prompt_files': [],
              'limits': {'visited_files': 0, 'visited_directories': 0, 'read_bytes': 0, 'refused_files': 0, 'truncated': False}}
    limits = output['limits']
    try:
        if root.is_symlink() or not root.is_dir() or root.resolve(strict=True) != root:
            raise Refused()
    except (OSError, ValueError, Refused):
        output['status'] = 'root_unavailable'
        return output
    seeds = [root]
    # Only active beforeword unit WorkingDirectory may select an otherwise
    # skipped releases/current target, and only inside this same private root.
    for service in services or []:
        if service.get('ActiveState') != 'active' or not UNIT.fullmatch(service.get('Id', '')) or 'beforeword' not in service['Id'].lower():
            continue
        value = service.get('WorkingDirectory')
        if not isinstance(value, str):
            continue
        try:
            candidate = canonical_candidate(root, Path(value))
            if any(part.lower() in {'node_modules', '__pycache__'} or ACTIVE_FORBIDDEN_DIRECTORY.search(part) for part in candidate.relative_to(root).parts):
                continue
            if candidate.is_dir() and candidate not in seeds:
                seeds.insert(0, candidate)
        except (OSError, ValueError, RuntimeError, Refused):
            pass
    seen, cache, references_seen = set(), {}, set()

    def read(path):
        if limits['visited_files'] >= MAX_FILES or limits['read_bytes'] >= MAX_TOTAL:
            limits['truncated'] = True
            raise Refused()
        limits['visited_files'] += 1
        info, raw = read_regular(root, path)
        if limits['read_bytes'] + len(raw) > MAX_TOTAL:
            limits['truncated'] = True
            raise Refused()
        limits['read_bytes'] += len(raw)
        # Retain only hashes for references; source bytes are not cached.
        return info, raw

    def reference(source, literal):
        path = Path(literal)
        if not path.is_absolute():
            path = source.parent / path
        target = canonical_candidate(root, path)
        if not allowed_file(target):
            raise Refused()
        relative = target.relative_to(root)
        # Only ancestors of an active seed bypass the releases exclusion.
        # Dependencies, backups and caches inside it remain excluded.
        policy_base = max((seed for seed in seeds if seed == root or seed in target.parents), key=lambda seed: len(seed.parts))
        if any(skipped_directory(p) for p in target.relative_to(policy_base).parts[:-1]):
            raise Refused()
        key = relative.as_posix()
        if key not in cache:
            info, _ = read(target)
            cache[key] = info
        return cache[key]

    for seed in seeds:
        for directory, dirs, files in os.walk(seed, followlinks=False):
            limits['visited_directories'] += 1
            if limits['visited_directories'] > MAX_DIRECTORIES:
                limits['truncated'] = True
                return output
            parent = Path(directory)
            dirs[:] = sorted(d for d in dirs if not skipped_directory(d) and safe_name(d) and not (parent / d).is_symlink())
            for name in sorted(files):
                path = parent / name
                if path in seen or not safe_name(name) or hidden_or_environment(path.relative_to(root).parts) or not allowed_file(path):
                    continue
                seen.add(path)
                if len(output['sources']) + len(output['prompt_files']) >= MAX_RESULTS or limits['visited_files'] >= MAX_FILES or limits['read_bytes'] >= MAX_TOTAL:
                    limits['truncated'] = True
                    return output
                try:
                    info, raw = read(path)
                    if path.suffix.lower() not in SOURCE_SUFFIXES:
                        output['prompt_files'].append(info)
                        continue
                    matches, references, literal_candidates = [], [], 0
                    for number, line in enumerate(raw.decode('utf-8', errors='replace').splitlines(), 1):
                        categories = [label for label, pattern in CATEGORIES if pattern.search(line)]
                        if len(matches) < MAX_MATCHES and categories:
                            matches.append({'line': number, 'categories': categories})
                        elif categories:
                            limits['truncated'] = True
                        for match in LITERAL.finditer(line):
                            if literal_candidates >= MAX_LITERAL_CANDIDATES:
                                limits['truncated'] = True
                                break
                            literal_candidates += 1
                            literal = match.group(2)
                            if not allowed_file(Path(literal)):
                                continue
                            try:
                                target = reference(path, literal)
                                category = 'core_path_reference' if PROMPT_NAME.search(Path(target['path']).name) else 'source_path_reference'
                                identity = (info['path'], number, target['path'])
                                if identity not in references_seen and len(references) < MAX_MATCHES:
                                    references.append({'line': number, 'category': category, **target})
                                    references_seen.add(identity)
                            except (OSError, ValueError, RuntimeError, Refused):
                                continue
                    if matches or references:
                        output['sources'].append({**info, 'matches': matches, 'references': references})
                    if len(json.dumps(output).encode()) > MAX_OUTPUT - 8192:
                        output['sources'] = output['sources'][:-1]
                        limits['truncated'] = True
                        return output
                except (OSError, ValueError, RuntimeError, Refused):
                    limits['refused_files'] += 1
    return output


def inspection_summary():
    status,services=systemctl_inventory()
    result=inspect(services=services,services_status=status)
    print(json.dumps({'kind':'private_inspection','status':result['status'],'root':result['root'],'services_status':status,'services':services,'limits':result['limits'],'source_count':len(result['sources']),'prompt_file_count':len(result['prompt_files']),'scope':'static source references; no loaded-prompt attestation'},separators=(',',':')))
    ranked=sorted(result['sources'],key=lambda item:(not bool(PROMPT_NAME.search(Path(item['path']).name)),not ('answer' in Path(item['path']).name.lower()),item['path']))
    for item in result['prompt_files'][:12]:
        print(json.dumps({'kind':'prompt_file',**item},separators=(',',':')))
    for item in ranked[:16]:
        lines=[m['line'] for m in item['matches'] if 'instruction' in m['categories'] or 'prompt' in m['categories']]
        refs=[{'path':v['path'],'sha256':v['sha256'],'line':v['line']} for v in item['references'] if v['category']=='core_path_reference']
        print(json.dumps({'kind':'source','path':item['path'],'sha256':item['sha256'],'lines':lines[:12],'prompt_references':refs[:8]},separators=(',',':')))
    if len(ranked)>16 or len(result['prompt_files'])>12:
        print(json.dumps({'kind':'summary_limits','omitted_source_rows':max(0,len(ranked)-16),'omitted_prompt_rows':max(0,len(result['prompt_files'])-12)}))

def export_public_data():
    from pathlib import Path
    import os,stat,hashlib,json,zipfile,datetime
    def require(condition):
     if not condition:raise RuntimeError('Public export safety precondition failed')
    r=Path('/home/befohuyc/public_html')
    out=r/'downloads/beforeword-data-boundary-20261112-c395513cc2ef5f78.zip'
    names=set('assets/ai-20261104/examples.json\nassets/ai-20261104/real-runs.json'.splitlines())
    blocked={'ma','api','server','private','beforeword-private','beforeword-api'}
    entries=[];missing=[];total=0;created=False
    require(not out.exists() and out.parent.is_dir() and not out.parent.is_symlink())
    try:
     with zipfile.ZipFile(out,'x',zipfile.ZIP_DEFLATED) as z:
      created=True
      for n in sorted(names):
       p=r/n
       require(not n.startswith('/') and all(x not in blocked and x not in {'.','..'} and not x.startswith('.') for x in Path(n).parts))
       require(not any(q.is_symlink() for q in [p,*p.parents] if q!=r.parent))
       if not p.exists(): missing.append(n);continue
       s=p.stat();require(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size<16777216)
       data=p.read_bytes();e=p.stat()
       require((s.st_ino,s.st_size,s.st_mtime_ns)==(e.st_ino,e.st_size,e.st_mtime_ns))
       total+=len(data);require(total<268435456)
       z.writestr('public/'+n,data)
       entries.append({'path':n,'size':len(data),'sha256':hashlib.sha256(data).hexdigest()})
      z.writestr('baseline.json',json.dumps({'schema_version':1,'source':'live_public_static_files','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':entries,'missing':missing},indent=2))
     os.chmod(out,0o644)
     print(json.dumps({'url':'https://beforeword.xyz/downloads/'+out.name,'size':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'files':len(entries),'missing':len(missing)}))
    except BaseException:
     if created and out.exists():out.unlink()
     raise

if __name__=='__main__':
    if sys.argv[1:] not in ([],['--inspect-only']):
        print('{"status":"arguments_refused"}')
        raise SystemExit(2)
    try:
        inspection_summary()
    except Exception:
        print('{"kind":"private_inspection","status":"inspection_failed"}')
        raise SystemExit(1)
    if not sys.argv[1:]:
        export_public_data()
