#!/usr/bin/env python3
"""Failure-path fixtures; no systemd, external roots or network calls."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('unified_deploy', HERE / 'deploy.py')
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)


class FakeLifecycle:
    def __init__(self):
        self.calls = []
        self.fail_contract = False
        self.fail_restart_once = False

    def active(self):
        self.calls.append('active')

    def contracts(self):
        self.calls.append('contracts')
        if self.fail_contract:
            raise d.Stop('fixture contract failure')

    def restart(self):
        self.calls.append('restart')
        if self.fail_restart_once:
            self.fail_restart_once = False
            raise d.Stop('fixture restart failure')


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name).resolve()
        self.package = self.base / 'package'
        self.package.mkdir()
        for name in ('deploy.py', 'patch_site.py'):
            shutil.copyfile(HERE / name, self.package / name)
        self.roots = {name: self.base / name for name in ('public', 'api', 'mcp')}
        for root in self.roots.values():
            root.mkdir()
        self.state_root = self.base / 'private-state'
        self.life = FakeLifecycle()
        self.write(self.roots['public'] / 'index.html', b'public OLD')
        self.write(self.roots['api'] / 'extension/instructions.js', b'api OLD')
        self.write(self.roots['api'] / 'server/answer.cjs', b'api GUARD')
        self.write(self.roots['mcp'] / 'lib/core.en.txt', b'mcp OLD')
        self.write(self.roots['mcp'] / 'server.mjs', b'mcp GUARD')
        self.write_json(self.package / 'public/patches.json', {'schema_version':1,'patches':[{'path':'index.html','old':'OLD','new':'NEW','expected_count':1}]})
        self.write_json(self.package / 'public/overlays.json', {'schema_version':1,'overlays':[],'checks':[]})
        for name, filename, entries, guard in (
            ('api','backend-target-patches.json',[('extension/instructions.js',b'api OLD',b'api NEW'),('server/adapter.cjs',None,b'adapter NEW')],('server/answer.cjs',b'api GUARD')),
            ('mcp','manifest.json',[('lib/core.en.txt',b'mcp OLD',b'mcp NEW')],('server.mjs',b'mcp GUARD'))):
            files = []
            for path, old, new in entries:
                self.write(self.package/name/'payload'/path, new)
                files.append({'path':path,'source':'payload/'+path,'expected_sha256':None if old is None else d.digest(old),'sha256':d.digest(new),'size':len(new)})
            self.write_json(self.package/name/filename, {'target_root':str(d.ROOTS[name]),'files':files,'guards':[{'path':guard[0],'sha256':d.digest(guard[1])}]})
            self.write(self.package/name/('verify_backend_profile.cjs' if name=='api' else 'verify_core.cjs'), b'// fixture verifier; never executed')
        self.exports = []
        for i in range(3):
            raw = ('fixture export '+str(i)).encode()
            path = 'downloads/task-'+str(i)+'.zip'
            self.write(self.roots['public']/path, raw)
            self.exports.append({'path':path,'sha256':d.digest(raw)})
        self.deploy = d.Deployment(self.package,self.roots,self.state_root,self.life,self.exports)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, path, raw):
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(raw)

    def write_json(self, path, value):
        self.write(path,(json.dumps(value)+'\n').encode())

    def originals(self):
        self.assertEqual((self.roots['public']/'index.html').read_bytes(),b'public OLD')
        self.assertEqual((self.roots['api']/'extension/instructions.js').read_bytes(),b'api OLD')
        self.assertEqual((self.roots['mcp']/'lib/core.en.txt').read_bytes(),b'mcp OLD')
        self.assertFalse((self.roots['api']/'server/adapter.cjs').exists())

    def test_prepare_then_success_verify_and_repeatable_export_cleanup(self):
        self.assertEqual(self.deploy.prepare()['status'],'prepared')
        self.originals()
        self.assertEqual(len(self.deploy.state()['components']),3)
        self.assertEqual(self.deploy.prepare()['reused'],True)
        self.assertEqual(self.deploy.apply()['status'],'applied')
        self.assertEqual(self.deploy.verify()['state'],'applied')
        state = self.deploy.state()
        self.deploy.cleanup_exports(state)
        for item in self.exports:
            self.assertFalse((self.roots['public']/item['path']).exists())
            backup=self.state_root/'export-backup'/Path(item['path']).name
            self.assertEqual(d.digest(backup.read_bytes()),item['sha256'])
        self.assertEqual(self.deploy.rollback()['status'],'rolled_back')
        self.originals()
        self.assertEqual(self.deploy.verify()['state'],'rolled_back')

    def test_prepare_all_roots_fail_before_public_write(self):
        self.write(self.roots['mcp']/'lib/core.en.txt',b'OTHER')
        with self.assertRaises(Exception): self.deploy.prepare()
        self.assertEqual((self.roots['public']/'index.html').read_bytes(),b'public OLD')
        self.assertEqual(self.deploy.state()['status'],'prepare_failed')
        self.assertNotIn('restart',self.life.calls)

    def test_apply_rechecks_all_before_first_write(self):
        self.deploy.prepare()
        self.write(self.roots['api']/'extension/instructions.js',b'EXTERNAL')
        with self.assertRaises(Exception): self.deploy.apply()
        self.assertEqual((self.roots['public']/'index.html').read_bytes(),b'public OLD')
        self.assertEqual((self.roots['api']/'extension/instructions.js').read_bytes(),b'EXTERNAL')
        self.assertNotIn('restart',self.life.calls)

    def test_second_component_write_failure_restores_first_and_new_files(self):
        self.deploy.prepare()
        engine=self.deploy.components['api']['engine']
        real=engine.replace_bytes
        def fail(root,name,raw,*args):
            if name=='server/adapter.cjs': raise OSError('fixture write failure')
            return real(root,name,raw,*args)
        with patch.object(engine,'replace_bytes',side_effect=fail):
            with self.assertRaises(d.Stop): self.deploy.apply()
        self.originals()
        self.assertEqual(self.deploy.state()['status'],'rolled_back')
        self.assertIn('restart',self.life.calls)

    def test_prepared_readonly_guard_drift_does_not_block_other_rollback(self):
        self.deploy.prepare()
        engine=self.deploy.components['api']['engine']
        real=engine.apply
        def fail(*args):
            self.write(self.roots['api']/'server/answer.cjs',b'EXTERNAL GUARD')
            return real(*args)
        with patch.object(engine,'apply',side_effect=fail):
            with self.assertRaises(d.Stop): self.deploy.apply()
        self.originals()
        self.assertEqual((self.roots['api']/'server/answer.cjs').read_bytes(),b'EXTERNAL GUARD')
        self.assertEqual(self.deploy.state()['status'],'rolled_back')

    def test_contract_failure_rolls_back_all_domains_before_restart_new(self):
        self.deploy.prepare();self.life.fail_contract=True
        with self.assertRaises(d.Stop): self.deploy.apply()
        self.originals()
        self.assertEqual(self.deploy.state()['status'],'rolled_back')
        self.assertEqual(self.life.calls.count('restart'),1)

    def test_restart_failure_rolls_back_then_restarts_old_services(self):
        self.deploy.prepare();self.life.fail_restart_once=True
        with self.assertRaises(d.Stop): self.deploy.apply()
        self.originals()
        self.assertEqual(self.deploy.state()['status'],'rolled_back')
        self.assertEqual(self.life.calls.count('restart'),2)

    def test_post_restart_health_failure_rolls_back_all_and_restarts_old(self):
        self.deploy.prepare()
        real=self.life.active
        calls=0
        def active():
            nonlocal calls
            calls+=1
            if calls==2: raise d.Stop('fixture post-restart health failure')
            real()
        with patch.object(self.life,'active',side_effect=active):
            with self.assertRaises(d.Stop): self.deploy.apply()
        self.originals()
        self.assertEqual(self.deploy.state()['status'],'rolled_back')
        self.assertEqual(self.life.calls.count('restart'),2)

    def test_cleanup_failure_rolls_back_changed_domains(self):
        self.deploy.prepare()
        with patch.object(self.deploy,'cleanup_exports',side_effect=d.Stop('fixture cleanup failure')):
            with self.assertRaises(d.Stop): self.deploy.apply()
        self.originals()
        self.assertEqual(self.deploy.state()['status'],'rolled_back')
        self.assertEqual(self.life.calls.count('restart'),2)

    def test_third_version_blocks_all_rollback_without_overwriting_it(self):
        self.deploy.prepare();self.deploy.apply()
        self.write(self.roots['api']/'extension/instructions.js',b'EXTERNAL')
        with self.assertRaises(d.Stop): self.deploy.rollback()
        self.assertEqual((self.roots['api']/'extension/instructions.js').read_bytes(),b'EXTERNAL')
        self.assertEqual((self.roots['public']/'index.html').read_bytes(),b'public NEW')
        self.assertEqual(self.deploy.state()['status'],'recovery_required')

    def test_changed_package_refused_before_write(self):
        self.deploy.prepare()
        self.write(self.package/'api/payload/server/adapter.cjs',b'CHANGED')
        with self.assertRaises(d.Stop): self.deploy.apply()
        self.originals()

    def test_wrong_export_hash_refused_without_cleanup_or_writes(self):
        self.write(self.roots['public']/self.exports[0]['path'],b'OTHER EXPORT')
        with self.assertRaises(d.Stop): self.deploy.prepare()
        self.originals()
        self.assertTrue((self.roots['public']/self.exports[0]['path']).exists())

    def test_backend_allowlist_refuses_unlisted_path(self):
        engine=self.deploy.components['api']['engine']
        with self.assertRaises(d.Stop): engine.relative_name('server/credentials.cjs')


if __name__=='__main__': unittest.main(verbosity=2)
