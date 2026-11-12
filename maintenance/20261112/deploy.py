#!/usr/bin/env python3
"""Fixed-root, journalled public/API/MCP deployment. No arbitrary CLI paths."""
from __future__ import annotations
import argparse
import errno
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys

HERE = Path(__file__).resolve().parent
STATE_ROOT = Path('/root/beforeword-boundary-20261112/deploy-state')
ROOTS = {
    'public': Path('/home/befohuyc/public_html'),
    'api': Path('/home/befohuyc/beforeword-api'),
    'mcp': Path('/opt/beforeword-mcp/releases/bb079a16c94ca6b6b76e'),
}
UNITS = {'api': 'beforeword-api.service', 'mcp': 'beforeword-mcp.service'}
EXPORTS = [
    {'path': 'downloads/beforeword-public-boundary-20261112-9b2414b75a3d64dc.zip', 'sha256': 'af3ffd38bf4271ca0614dc006275e518239be5fcdde6ba95c02b8846888809bd'},
    {'path': 'downloads/beforeword-runtime-boundary-20261112-c0e75975d3e7d6b1.zip', 'sha256': '70a1fc5d9d5039fcea48afea92fcf85bba0a7dc8612866565526ea55b9e6f030'},
    {'path': 'downloads/beforeword-data-boundary-20261112-c395513cc2ef5f78.zip', 'sha256': '0dfd878188aa8eb8d97b9c6135c845c31a561e99287747151ad6a54c61e8b168'},
]


class Stop(RuntimeError):
    pass


def need(condition, message):
    if not condition:
        raise Stop(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def read_json(path):
    raw = Path(path).read_bytes()
    need(len(raw) < 8 * 1024 * 1024, 'Manifest size limit')
    return json.loads(raw)


def canonical(value):
    need(isinstance(value, str) and bool(re.fullmatch(r'[A-Za-z0-9_./+\-]+', value)), 'Invalid explicit path')
    p = PurePosixPath(value)
    need(not p.is_absolute() and str(p) == value and all(part not in {'.', '..'} and not part.startswith('.') for part in p.parts), 'Invalid explicit path')
    return value


def load_engine(path, allowed=None):
    spec = importlib.util.spec_from_file_location('boundary_engine_' + str(id(path)) + str(id(allowed)), path)
    engine = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(engine)
    if allowed is not None:
        frozen = frozenset(canonical(name) for name in allowed)
        def exact_name(value):
            canonical(value)
            need(value in frozen, 'Path outside explicit backend manifest')
            return value
        engine.relative_name = exact_name
    return engine


class Lifecycle:
    """Only the two confirmed units and local, packaged verifier programs."""
    def __init__(self, package, roots):
        self.package, self.roots = Path(package), roots

    def command(self, arguments, capture=False):
        result = subprocess.run(arguments, stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL, timeout=45, check=False,
                                text=True, encoding='utf-8', errors='replace')
        need(result.returncode == 0, 'Service or local contract command failed')
        if capture:
            need(len(result.stdout) < 16384, 'Service output limit')
            return result.stdout

    def active(self):
        for name, unit in UNITS.items():
            raw = self.command(['systemctl', 'show', unit, '--no-pager', '--property=Id,ActiveState,SubState,WorkingDirectory'], True)
            value = dict(line.split('=', 1) for line in raw.splitlines() if '=' in line)
            need(value.get('Id') == unit and value.get('ActiveState') == 'active' and value.get('SubState') == 'running', 'Confirmed service is not active/running')
            need(value.get('WorkingDirectory') == str(self.roots[name]), 'Service working directory changed')

    def restart(self):
        for unit in UNITS.values():
            self.command(['systemctl', 'restart', unit])

    def contracts(self):
        node = shutil.which('node', path='/usr/local/bin:/usr/bin:/bin')
        need(node is not None, 'Node executable unavailable')
        for component, verifier in (('api', 'verify_backend_profile.cjs'), ('mcp', 'verify_core.cjs')):
            raw = self.command([node, str(self.package / component / verifier), str(self.roots[component])], True)
            data = json.loads(raw)
            expected = 'local_profile_matches' if component == 'api' else 'ok'
            need(data.get('status') == expected, 'Local contract status mismatch')


class Deployment:
    # Function parameters support local fixtures; the CLI supplies only constants.
    def __init__(self, package=HERE, roots=None, state_root=STATE_ROOT, lifecycle=None, exports=None):
        self.package = Path(package).resolve()
        self.roots = {k: Path(v) for k, v in (ROOTS if roots is None else roots).items()}
        need(set(self.roots) == {'public', 'api', 'mcp'}, 'Invalid component roots')
        self.state_root = Path(state_root)
        self.exports = EXPORTS if exports is None else exports
        self.engine_path = self.package / 'patch_site.py'
        self.base = load_engine(self.engine_path)
        self.lifecycle = lifecycle or Lifecycle(self.package, self.roots)
        self.components = {}
        self.package_files = [self.engine_path, self.package / 'deploy.py']
        self._inventory()

    def _inventory(self):
        public = self.package / 'public'
        patches, overlays = read_json(public / 'patches.json'), read_json(public / 'overlays.json')
        self.components['public'] = {'engine': load_engine(self.engine_path), 'patches': patches, 'overlays': overlays, 'source_dir': public}
        for name, filename in (('api', 'backend-target-patches.json'), ('mcp', 'manifest.json')):
            directory = self.package / name
            manifest_path = directory / filename
            manifest = read_json(manifest_path)
            # Test fixtures may remap local roots; package identity remains fixed.
            need(manifest.get('target_root') == str(ROOTS[name]), 'Backend manifest root mismatch')
            entries = manifest.get('files')
            need(isinstance(entries, list) and entries, 'Backend manifest has no files')
            allowed = set()
            normalized = []
            for entry in entries:
                path, source = canonical(entry['path']), canonical(entry['source'])
                need(source.startswith('payload/'), 'Backend source must be packaged payload')
                need('expected_sha256' in entry, 'Backend target needs old hash or explicit absence')
                allowed.update((path, source))
                normalized.append({k: entry[k] for k in ('path', 'source', 'expected_sha256', 'sha256')})
            checks = []
            for guard in manifest.get('guards', []):
                path = canonical(guard['path'])
                allowed.add(path)
                checks.append({'path': path, 'sha256': guard.get('expected_sha256', guard.get('sha256'))})
            self.components[name] = {'engine': load_engine(self.engine_path, allowed),
                                     'patches': {'schema_version': 1, 'patches': []},
                                     'overlays': {'schema_version': 1, 'overlays': normalized, 'checks': checks},
                                     'source_dir': directory}
            self.package_files.extend([manifest_path, directory / ('verify_backend_profile.cjs' if name == 'api' else 'verify_core.cjs')])
        self.package_files.extend([public / 'patches.json', public / 'overlays.json'])
        for component in self.components.values():
            for entry in component['overlays'].get('overlays', []):
                source = component['engine'].within(component['source_dir'], entry['source'])
                need(source.is_file() and not source.is_symlink(), 'Packaged payload unavailable')
                self.package_files.append(source)

    def package_digest(self):
        rows = []
        for path in sorted(set(self.package_files)):
            need(path.is_file() and not path.is_symlink(), 'Packaged input missing or symlink')
            rows.append((path.relative_to(self.package).as_posix(), digest(path.read_bytes())))
        return digest(json.dumps(rows, separators=(',', ':')).encode())

    def save(self, state):
        self.base.write_state(self.state_root, state)

    def state(self):
        for name, root in self.roots.items():
            resolved, _ = self.base.roots(root, self.backup_root(name))
            need(resolved == root, 'Fixed root resolves elsewhere')
        need((self.state_root / 'state.json').is_file(), 'Prepare this package first')
        state = read_json(self.state_root / 'state.json')
        need(state.get('package_digest') == self.package_digest(), 'Prepared package changed')
        need(state.get('roots') == {k: str(v) for k, v in self.roots.items()}, 'Prepared root identity changed')
        return state

    def backup_root(self, name):
        return self.state_root / 'backups' / name

    def frozen(self, state, name):
        component = self.components[name]
        return component['engine'].load_release(self.roots[name], self.backup_root(name), state['components'][name])

    def all_before(self, state):
        need(set(state['components']) == set(self.components), 'Incomplete prepared component set')
        for name, component in self.components.items():
            _, plan, component_state = self.frozen(state, name)
            need(component_state['status'] == 'prepared', 'Component is not prepared')
            engine = component['engine']
            engine.check_state(self.roots[name], plan, 'before')
            engine.check_readonly(self.roots[name], plan)
            engine.check_new_directories_absent(self.roots[name], plan)

    def all_after(self, state):
        for name, component in self.components.items():
            result = component['engine'].verify(self.roots[name], self.backup_root(name), state['components'][name])
            need(result['state'] == 'applied', 'Component is not applied')

    def stage_inputs(self, name, component):
        directory = self.state_root / 'inputs' / name
        directory.mkdir(parents=True, mode=0o700)
        os.chmod(directory, 0o700)
        for entry in component['overlays'].get('overlays', []):
            source = component['engine'].within(component['source_dir'], entry['source'])
            target = directory / entry['source']
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            raw = source.read_bytes()
            need(digest(raw) == entry['sha256'], 'Packaged payload hash mismatch')
            self.base.write_private(target, raw)
        for filename, value in (('patches.json', component['patches']), ('overlays.json', component['overlays'])):
            self.base.write_private(directory / filename, (json.dumps(value) + '\n').encode())
        return directory

    def prepare(self):
        with self.base.lock(self.state_root):
            if (self.state_root / 'state.json').exists():
                state = self.state()
                need(state['status'] == 'prepared', 'Existing deployment journal requires verify or rollback')
                self.all_before(state)
                return {'status': 'prepared', 'components': state['components'], 'reused': True}
            for name, root in self.roots.items():
                resolved, _ = self.base.roots(root, self.backup_root(name))
                need(resolved == root, 'Fixed root resolves elsewhere')
            self.lifecycle.active()
            state = {'schema_version': 1, 'status': 'preparing', 'package_digest': self.package_digest(),
                     'roots': {k: str(v) for k, v in self.roots.items()}, 'components': {}, 'exports_moved': []}
            self.save(state)
            try:
                inputs = {name: self.stage_inputs(name, component) for name, component in self.components.items()}
                # Validate ALL domains before preparing any component backup.
                for name, component in self.components.items():
                    component['engine'].build_plan(self.roots[name], inputs[name] / 'patches.json', inputs[name] / 'overlays.json')
                self.check_exports()
                for name, component in self.components.items():
                    result = component['engine'].prepare(self.roots[name], self.backup_root(name), inputs[name] / 'patches.json', inputs[name] / 'overlays.json')
                    state['components'][name] = result['release']
                    self.save(state)
                self.all_before(state)
                state['status'] = 'prepared'
                self.save(state)
                return {'status': 'prepared', 'components': state['components']}
            except BaseException:
                state['status'] = 'prepare_failed'
                self.save(state)
                raise

    def rollback_locked(self, state):
        # Cross-component preflight: no domain is overwritten if ANY target is
        # neither the frozen before nor after version.
        for name in state['components']:
            _, plan, _ = self.frozen(state, name)
            for entry in plan['files']:
                actual, _ = self.components[name]['engine'].get_file(self.roots[name], entry['path'])
                need(actual in (entry['before'], entry['after']), 'Cross-component rollback conflict')
        state['status'] = 'rolling_back'
        self.save(state)
        for name in reversed(list(state['components'])):
            engine = self.components[name]['engine']
            _, plan, component_state = self.frozen(state, name)
            if component_state['status'] in {'prepared', 'rolled_back'}:
                # Read-only guard drift is preserved and must not prevent
                # restoring this release's changed files in other domains.
                engine.check_state(self.roots[name], plan, 'before')
            else:
                engine.rollback(self.roots[name], self.backup_root(name), state['components'][name])
        self.lifecycle.restart()
        self.lifecycle.active()
        state['status'] = 'rolled_back'
        self.save(state)
        return {'status': 'rolled_back', 'exports_remain_private': state.get('exports_moved', [])}

    def apply(self):
        with self.base.lock(self.state_root):
            state = self.state()
            need(state['status'] == 'prepared', 'Apply requires prepared state; use rollback after interruption')
            self.all_before(state)
            self.check_exports()
            self.lifecycle.active()
            state['status'] = 'applying'
            self.save(state)
            try:
                for name, component in self.components.items():
                    state['current_component'] = name
                    self.save(state)
                    component['engine'].apply(self.roots[name], self.backup_root(name), state['components'][name])
                self.all_after(state)
                self.lifecycle.contracts()
                state['status'] = 'restarting'
                self.save(state)
                self.lifecycle.restart()
                self.lifecycle.active()
                self.lifecycle.contracts()
                self.all_after(state)
                state['status'] = 'verified_before_cleanup'
                self.save(state)
                self.cleanup_exports(state)
                state['status'] = 'applied'
                state.pop('current_component', None)
                self.save(state)
                return {'status': 'applied', 'components': state['components'], 'exports_moved': state['exports_moved']}
            except BaseException as error:
                try:
                    self.rollback_locked(state)
                except BaseException:
                    state['status'] = 'recovery_required'
                    self.save(state)
                    raise Stop('Apply failed; rollback requires recovery') from error
                raise Stop('Apply failed; all changed targets restored and services restarted') from error

    def rollback(self):
        with self.base.lock(self.state_root):
            state = self.state()
            need(state['status'] in {'applying', 'restarting', 'verified_before_cleanup', 'applied', 'rolling_back', 'recovery_required', 'rolled_back'}, 'Deployment has no applied state')
            try:
                return self.rollback_locked(state)
            except BaseException:
                state['status'] = 'recovery_required'
                self.save(state)
                raise

    def verify(self):
        with self.base.lock(self.state_root):
            state = self.state()
            if state['status'] == 'prepared':
                self.all_before(state)
            elif state['status'] == 'applied':
                self.all_after(state)
                self.lifecycle.contracts()
                self.check_exports(require_private=True)
            elif state['status'] == 'rolled_back':
                for name, component in self.components.items():
                    _, plan, _ = self.frozen(state, name)
                    component['engine'].check_state(self.roots[name], plan, 'before')
            else:
                raise Stop('Interrupted deployment; use rollback')
            self.lifecycle.active()
            return {'status': 'verified', 'state': state['status']}

    def export_locations(self, entry):
        canonical(entry['path'])
        need(entry['path'].startswith('downloads/') and len(PurePosixPath(entry['path']).parts) == 2, 'Export path outside fixed downloads')
        source = self.base.within(self.roots['public'], entry['path'])
        directory = self.state_root / 'export-backup'
        target = directory / source.name
        return source, directory, target

    def file_digest(self, path):
        need(not path.is_symlink(), 'Export symlink refused')
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            before = os.fstat(fd)
            need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size <= 512 * 1024 * 1024, 'Invalid export file')
            value = hashlib.sha256()
            size = 0
            while True:
                raw = os.read(fd, 1024 * 1024)
                if not raw:
                    break
                size += len(raw)
                need(size <= 512 * 1024 * 1024, 'Export grew beyond limit')
                value.update(raw)
            after = os.fstat(fd)
            need((before.st_ino, before.st_size, before.st_mtime_ns) == (after.st_ino, after.st_size, after.st_mtime_ns), 'Export changed while reading')
            return value.hexdigest()
        finally:
            os.close(fd)

    def check_exports(self, require_private=False):
        for entry in self.exports:
            source, directory, target = self.export_locations(entry)
            need(not directory.is_symlink(), 'Export backup directory symlink refused')
            if target.exists() or target.is_symlink():
                need(self.file_digest(target) == entry['sha256'], 'Private export hash mismatch')
            if source.exists() or source.is_symlink():
                need(not require_private, 'Export still public')
                need(self.file_digest(source) == entry['sha256'], 'Public export hash mismatch')
            else:
                need(target.exists(), 'Expected task export missing')

    def cleanup_exports(self, state):
        self.check_exports()
        for entry in self.exports:
            source, directory, target = self.export_locations(entry)
            directory.mkdir(mode=0o700, exist_ok=True)
            need(not directory.is_symlink() and stat.S_IMODE(directory.stat().st_mode) == 0o700, 'Export backup must be private')
            if not target.exists():
                need(self.file_digest(source) == entry['sha256'], 'Export changed before move')
                try:
                    os.rename(source, target)
                except OSError as error:
                    if error.errno != errno.EXDEV:
                        raise
                    # Cross-filesystem move: durable private copy, then compare
                    # the exact source again before removing that one task ZIP.
                    with target.open('xb') as dest, source.open('rb') as src:
                        os.fchmod(dest.fileno(), 0o600)
                        shutil.copyfileobj(src, dest, 1024 * 1024)
                        dest.flush()
                        os.fsync(dest.fileno())
                    need(self.file_digest(target) == entry['sha256'], 'Copied export hash mismatch')
            if source.exists():
                need(self.file_digest(source) == entry['sha256'] and self.file_digest(target) == entry['sha256'], 'Export conflict before final move removal')
                source.unlink()
            os.chmod(target, 0o600)
            self.base.syncdir(directory)
            self.base.syncdir(source.parent)
            if entry['path'] not in state['exports_moved']:
                state['exports_moved'].append(entry['path'])
            self.save(state)
        self.check_exports(require_private=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'apply', 'verify', 'rollback'])
    args = parser.parse_args()
    need(os.geteuid() == 0, 'Run from the authorized root console')
    result = getattr(Deployment(), args.command)()
    print(json.dumps(result, separators=(',', ':')))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'status': 'stopped', 'error_type': type(error).__name__}), file=sys.stderr)
        raise SystemExit(1)
