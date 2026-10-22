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
        for name, digest in result["source_sha256"].items():
            self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), digest)

    def test_modified_sample_fails_in_normal_and_optimized_python(self):
        sample_path = self.root / verifier.ROOT / "samples.jsonl"
        samples = [json.loads(line) for line in sample_path.read_text().splitlines()]
        samples[7]["input"][0]["content"] = "This is a changed prompt."
        sample_path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in samples) + "\n")
        for flags in ([], ["-O"]):
            result = subprocess.run([sys.executable, *flags, str(SCRIPT), "--source-root", str(self.root)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stdout)
            self.assertEqual(json.loads(result.stderr)["result"], "CHECK_FAILED")

    def test_modified_selected_release_fails(self):
        path = self.root / "assets/core.en.txt"
        path.write_bytes(path.read_bytes() + b"changed\n")
        with self.assertRaises(ValueError):
            verifier.check(source_root=self.root)

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
