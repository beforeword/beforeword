#!/usr/bin/env python3
"""Offline checks of release selection and byte-preserving packaging boundaries."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import build_downloads
import package_plugins
from release_contract import VERSION, require_selected
from release_evidence import describe, load_current_review, selected_editions, review_summary


class ReleaseContractTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        (self.root / "assets").mkdir()
        (self.root / "references").mkdir()
        self.cores = {"ru": "beforeword · инструкция\r\nы\u0301\t \r\n\r\n".encode(),
                      "en": b"beforeword reading instructions\nLast line has spaces  \n\n"}
        for language, raw in self.cores.items():
            (self.root / f"assets/core.{language}.txt").write_bytes(raw)
        self.contract = {"schema_version": 1, "version": VERSION, "date_utc": "2026-10-09",
                         "status": "awaiting-selection", "core_sha256": None}
        self.save()

    def save(self):
        (self.root / "references/release-contract.json").write_text(json.dumps(self.contract))

    def select(self):
        self.contract.update(status="selected", core_sha256={lang: hashlib.sha256(raw).hexdigest()
                                                              for lang, raw in self.cores.items()})
        self.save()

    def test_metadata_alone_cannot_build_release(self):
        with self.assertRaisesRegex(ValueError, "awaiting exact"):
            require_selected(self.root)
        with patch.object(package_plugins, "ROOT", self.root):
            with self.assertRaisesRegex(ValueError, "awaiting exact"):
                package_plugins.build_bundles("ru")

    def test_any_changed_selected_core_blocks_release(self):
        self.select()
        require_selected(self.root)
        (self.root / "assets/core.en.txt").write_bytes(self.cores["en"] + b"changed")
        with self.assertRaisesRegex(ValueError, "Selected en core bytes differ"):
            require_selected(self.root)

    def test_unversioned_core_unicode_crlf_and_final_whitespace_survive_all_skill_packages(self):
        self.select()
        with patch.object(package_plugins, "ROOT", self.root):
            for language, raw in self.cores.items():
                for bundle in package_plugins.build_bundles(language).values():
                    skill = next(value.encode() for path, value in bundle["file_contents"].items()
                                 if path.endswith("SKILL.md"))
                    self.assertTrue(skill.endswith(raw))
                    self.assertEqual(skill.count(raw), 1)
                    self.assertNotIn(VERSION.encode(), raw)

    def test_requested_version_cannot_relabel_selected_core(self):
        self.select()
        with patch.object(package_plugins, "ROOT", self.root):
            with self.assertRaisesRegex(ValueError, "version differs"):
                package_plugins.build_bundles("en", version="9.0.0")

    def test_replace_cannot_overwrite_an_old_download_version(self):
        previous = self.root / "downloads/1.3.2"
        previous.mkdir(parents=True)
        path = previous / "original.txt"
        path.write_bytes(b"historical")
        with patch.object(build_downloads, "ROOT", self.root):
            with self.assertRaisesRegex(ValueError, "historical downloads"):
                build_downloads.write_files(previous, {"original.txt": b"replacement"}, replace=True)
        self.assertEqual(path.read_bytes(), b"historical")

    def prepare_review(self):
        self.select()
        for edition in ('medium', 'compact'):
            for language in ('en', 'ru'):
                (self.root / f'assets/{edition}.{language}.txt').write_bytes(self.cores[language])
        self.review = {'schema_version': 2, 'instruction_version': VERSION,
                       'status': 'pending', 'selected_editions': selected_editions(self.root), 'runs': []}
        (self.root / f'references/instruction-editions-{VERSION}.json').write_text(json.dumps({
            'version': VERSION, 'editions': self.review['selected_editions']}))
        self.review_path = self.root / f'references/development-review-{VERSION}.json'
        self.write_review()

    def write_review(self):
        self.review_path.write_text(json.dumps(self.review))

    def test_pending_current_review_reports_zero_model_outputs(self):
        self.prepare_review()
        relative, review = load_current_review(self.root)
        summary = review_summary(relative, review, version=VERSION, raw=self.review_path.read_bytes())
        self.assertEqual(summary['status'], 'pending')
        self.assertEqual(summary['development_outputs'], 0)
        self.assertFalse(summary['historical'])

    def test_changed_short_edition_cannot_reuse_current_evidence(self):
        self.prepare_review()
        (self.root / 'assets/compact.ru.txt').write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'selected compact.ru source'):
            load_current_review(self.root)

    def test_current_edition_manifest_cannot_misreport_source_length(self):
        self.prepare_review()
        path = self.root / f'references/instruction-editions-{VERSION}.json'
        manifest = json.loads(path.read_text())
        manifest['editions']['medium']['en']['characters'] += 1
        path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'edition manifest differs'):
            load_current_review(self.root)

    def test_recorded_current_run_requires_matching_raw_evidence(self):
        self.prepare_review()
        evidence = self.root / 'references/raw.json'
        evidence.write_bytes(b'{"request":"exact request","response":"exact response"}\n')
        self.review['status'] = 'recorded'
        self.review['runs'] = [{'id': 'bounded-run', 'edition': 'core', 'language': 'en',
                               'instruction_sha256': self.review['selected_editions']['core']['en']['sha256'],
                               'environment': 'local test fixture; no model call', 'observed_answers': 1,
                               'review_status': 'unreviewed', 'evidence': [
                                   {'path': 'references/raw.json', 'sha256': hashlib.sha256(evidence.read_bytes()).hexdigest()}]}]
        self.write_review()
        load_current_review(self.root)
        evidence.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'raw evidence hash differs'):
            load_current_review(self.root)

    def test_pending_review_cannot_claim_recorded_runs(self):
        self.prepare_review()
        self.review['runs'] = [{'observed_answers': 10}]
        self.write_review()
        with self.assertRaisesRegex(ValueError, 'status and recorded runs disagree'):
            load_current_review(self.root)

    def test_pending_review_cannot_claim_reader_calls(self):
        self.prepare_review()
        self.review['reader_adapter'] = {'provider_calls': 1}
        self.write_review()
        with self.assertRaisesRegex(ValueError, 'Pending review cannot claim provider calls'):
            load_current_review(self.root)

    def test_recorded_review_cannot_omit_evidence_or_borrow_old_instruction(self):
        self.prepare_review()
        self.review.update(status='recorded', runs=[{
            'id': 'run', 'edition': 'core', 'language': 'en',
            'instruction_sha256': '0' * 64, 'environment': 'fixture',
            'observed_answers': 1, 'review_status': 'unreviewed', 'evidence': []}])
        self.write_review()
        with self.assertRaisesRegex(ValueError, 'instruction hash differs'):
            load_current_review(self.root)
        self.review['runs'][0]['instruction_sha256'] = self.review['selected_editions']['core']['en']['sha256']
        self.write_review()
        with self.assertRaisesRegex(ValueError, 'needs raw evidence'):
            load_current_review(self.root)

    def test_prior_candidate_failure_does_not_become_a_current_result(self):
        self.prepare_review()
        frozen = {f'assets/{edition}.{language}.txt': dict(describe(b'old candidate\n'), text='old candidate\n')
                  for edition in ('core', 'medium', 'compact') for language in ('en', 'ru')}
        (self.root / f'references/instruction-candidates-{VERSION}.json').write_text(json.dumps({
            'instruction_version': VERSION, 'candidates': [{'revision': 2, 'files': frozen}]}))
        evidence = self.root / 'references/failed-candidate.json'
        evidence.write_bytes(b'{"response":"recorded failure"}\n')
        self.review['previous_candidate_runs'] = [{
            'id': 'prior-failure', 'candidate_revision': 2, 'edition': 'core', 'language': 'en',
            'instruction_sha256': frozen['assets/core.en.txt']['sha256'],
            'environment': 'local test fixture; no model call', 'observed_answers': 1,
            'review_status': 'reviewed', 'outcome': 'needs_revision',
            'evidence': [{'path': 'references/failed-candidate.json',
                          'sha256': hashlib.sha256(evidence.read_bytes()).hexdigest()}]}]
        self.write_review()
        relative, review = load_current_review(self.root)
        summary = review_summary(relative, review, version=VERSION, raw=self.review_path.read_bytes())
        self.assertEqual(summary['status'], 'pending')
        self.assertEqual(summary['development_outputs'], 0)
        self.assertEqual(summary['previous_candidate_outputs'], 1)
        evidence.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'raw evidence hash differs'):
            load_current_review(self.root)


if __name__ == "__main__":
    unittest.main()
