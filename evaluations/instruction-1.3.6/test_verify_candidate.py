#!/usr/bin/env python3
"""Offline regression checks for the source verifier, not model behavior."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("verify_candidate.py")
ROOT = SCRIPT.resolve().parents[2]
spec = importlib.util.spec_from_file_location("verify_candidate", SCRIPT)
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class CandidateSourceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for relative in ("evaluations/instruction-1.3.6", "references", "assets", "downloads/1.3.5"):
            shutil.copytree(ROOT / relative, self.root / relative)

    def test_default_is_local_and_reports_actual_source_hashes(self):
        with patch.object(verifier, "download", side_effect=AssertionError("Unexpected network request")):
            result = verifier.check()
        self.assertEqual(result["source"], {"mode": "local", "root": str(ROOT)})
        self.assertFalse(result["semantic_behavior_proven"])
        self.assertEqual(result["archived_baseline_release"], "1.3.5")
        self.assertTrue(result["archived_baseline_hashes_match"])
        self.assertTrue(result["selected_source_hashes_match"])
        for name, digest in result["source_sha256"].items():
            self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), digest)

    def assert_cli_failure(self, detail):
        for flags in ([], ["-O"]):
            result = subprocess.run([sys.executable, "-B", *flags, str(SCRIPT), "--source-root", str(self.root)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stdout)
            failure = json.loads(result.stderr)
            self.assertEqual(failure["result"], "CHECK_FAILED")
            self.assertIn(detail, failure["detail"])

    def test_modified_sample_fails_in_normal_and_optimized_python(self):
        sample_path = self.root / verifier.ROOT / "samples.jsonl"
        samples = [json.loads(line) for line in sample_path.read_text().splitlines()]
        samples[7]["input"][0]["content"] = "This is a changed prompt."
        sample_path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in samples) + "\n")
        self.assert_cli_failure('sample["input"] ==')

    def test_modified_selected_release_fails_in_normal_and_optimized_python(self):
        path = self.root / "assets/core.en.txt"
        path.write_bytes(path.read_bytes() + b"changed\n")
        self.assert_cli_failure("en core hash mismatch")

    def test_modified_archived_baseline_fails_in_normal_and_optimized_python(self):
        path = self.root / "downloads/1.3.5/beforeword_core_EN.txt"
        path.write_bytes(path.read_bytes() + b"changed\n")
        self.assert_cli_failure("Archived 1.3.5 en core hash mismatch")

    def test_archived_manifest_version_and_source_hash_are_checked(self):
        path = self.root / "downloads/1.3.5/manifest.json"
        original = path.read_text()
        manifest = json.loads(original)
        manifest["version"] = "9.9.9"
        path.write_text(json.dumps(manifest))
        self.assert_cli_failure("Archived baseline version mismatch")
        manifest = json.loads(original)
        manifest["source_files_sha256"]["assets/core.en.txt"] = "0" * 64
        path.write_text(json.dumps(manifest))
        self.assert_cli_failure("Archived 1.3.5 en source hash mismatch")

    def test_selected_release_can_advance_without_rewriting_archived_baseline(self):
        archive = self.root / "downloads/1.3.5"
        before = {path.name: path.read_bytes() for path in archive.iterdir() if path.is_file()}
        contract = self.root / "references/release-contract.json"
        pins = json.loads(contract.read_text())
        pins["version"] = "9.9.9"
        for lang in ("en", "ru"):
            path = self.root / f"assets/core.{lang}.txt"
            content = path.read_bytes() + b"Selected-release test fixture.\n"
            path.write_bytes(content)
            pins["core_sha256"][lang] = hashlib.sha256(content).hexdigest()
        contract.write_text(json.dumps(pins))
        result = verifier.check(source_root=self.root)
        self.assertEqual(result["selected_stable_release"], "9.9.9")
        self.assertEqual(result["archived_baseline_release"], "1.3.5")
        self.assertEqual(before, {path.name: path.read_bytes() for path in archive.iterdir() if path.is_file()})

    def test_original_selected_baseline_still_passes(self):
        contract = self.root / "references/release-contract.json"
        pins = json.loads(contract.read_text())
        pins["version"] = "1.3.5"
        for lang in ("en", "ru"):
            content = (self.root / f"downloads/1.3.5/beforeword_core_{lang.upper()}.txt").read_bytes()
            (self.root / f"assets/core.{lang}.txt").write_bytes(content)
            pins["core_sha256"][lang] = hashlib.sha256(content).hexdigest()
        contract.write_text(json.dumps(pins))
        result = verifier.check(source_root=self.root)
        self.assertEqual(result["selected_stable_release"], "1.3.5")
        path = self.root / "assets/core.en.txt"
        content = path.read_bytes() + b"changed\n"
        path.write_bytes(content)
        pins["core_sha256"]["en"] = hashlib.sha256(content).hexdigest()
        contract.write_text(json.dumps(pins))
        self.assert_cli_failure("Selected baseline differs from its archive")

    def test_remote_mode_requires_immutable_ref_and_reports_it(self):
        for ref in ("main", "v1.3.6", "abc123", "a" * 39, "g" * 40):
            with self.assertRaises(ValueError):
                verifier.check(ref=ref)
        # Synthetic transport verifies selection and provenance, not GitHub availability.
        ref = "a" * 40
        with patch.object(verifier, "download", side_effect=lambda name, actual_ref: (ROOT / name).read_bytes() if actual_ref == ref else b"") as download:
            result = verifier.check(ref=ref)
        self.assertEqual(result["source"], {"mode": "remote_commit", "commit": ref})
        self.assertEqual(download.call_count, len(result["source_sha256"]))

    def test_local_and_remote_cannot_be_mixed(self):
        with self.assertRaises(ValueError):
            verifier.check(source_root=self.root, ref="a" * 40)


if __name__ == "__main__":
    unittest.main()
