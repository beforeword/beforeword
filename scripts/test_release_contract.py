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


class ReleaseContractTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
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


if __name__ == "__main__":
    unittest.main()
