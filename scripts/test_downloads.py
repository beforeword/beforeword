"""Check download provenance, exact instructions, guide download targets and safe refresh."""
import hashlib
import io
import json
from pathlib import Path
import re
import stat
import subprocess
import tempfile
import unittest
import zipfile

from build_downloads import ROOT, VERSION, build_files, write_files
from build_public import settings


class DownloadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.files = build_files()

    def test_full_text_has_exact_scope_and_core(self):
        for language in ("ru", "en"):
            scope = (ROOT / "assets" / f"scope.{language}.txt").read_bytes().decode("utf-8").rstrip("\n") + "\n\n"
            core = (ROOT / "assets" / f"core.{language}.txt").read_bytes().decode("utf-8")
            self.assertLessEqual(len(self.files[f"beforeword_compact_{language.upper()}.txt"].decode("utf-8")), 1500,
                                 "Compact instructions must fit the declared settings field")
            medium = self.files[f"beforeword_5000_{language.upper()}.txt"]
            self.assertLessEqual(len(medium.decode("utf-8")), 5000, "The complete medium edition fits 5,000 characters")
            self.assertEqual(medium, (ROOT / "assets" / f"medium.{language}.txt").read_bytes())
            self.assertEqual(self.files[f"beforeword_core_{language.upper()}.txt"], (scope + core).encode("utf-8"))
            self.assertEqual(self.files[f"beforeword_compact_{language.upper()}.txt"],
                             (ROOT / "assets" / f"compact.{language}.txt").read_bytes())

    def test_perplexity_uses_medium_and_fits_its_declared_field(self):
        connectors = json.loads((ROOT / "references/connectors.json").read_text(encoding="utf-8"))
        platforms = json.loads((ROOT / "references/platforms.json").read_text(encoding="utf-8"))["connectors"]
        selected = next(item for item in connectors if item["id"] == "perplexity")
        self.assertEqual(selected["recommended"], "medium")
        self.assertEqual(next(item for item in platforms if item["id"] == "perplexity")["recommended"], "medium")
        for language in ("ru", "en"):
            medium = self.files[f"beforeword_5000_{language.upper()}.txt"].decode("utf-8")
            self.assertLessEqual(len(medium), 8000, "The selected project instruction fits its field")
            rendered = settings(language, [selected])
            self.assertIn('data-copy-target="medium-text"', rendered)
            self.assertIn('data-copy-details="medium-details"', rendered)
            self.assertIn(f'href="/model/beforeword-5000-{language}.txt"', rendered)
            self.assertNotIn('data-copy-target="instruction-text"', rendered)
            scope = (ROOT / "assets" / f"scope.{language}.txt").read_text(encoding="utf-8").rstrip("\n") + "\n\n"
            self.assertLess(len(scope + medium), 8000, "The GPT draft's medium edition plus scope also fits its field")

    def test_checksums_sizes_and_nonrecursive_source_archive(self):
        manifest = json.loads(self.files["manifest.json"])
        self.assertEqual(set(manifest["files"]), set(self.files) - {"manifest.json", "SHA256SUMS.txt"})
        for name, record in manifest["files"].items():
            self.assertEqual(record, {"sha256": hashlib.sha256(self.files[name]).hexdigest(), "bytes": len(self.files[name])})
        sums = {}
        for line in self.files["SHA256SUMS.txt"].decode().splitlines():
            digest, name = line.split("  ", 1)
            self.assertEqual(digest, hashlib.sha256(self.files[name]).hexdigest())
            sums[name] = digest
        self.assertEqual(set(sums), set(self.files) - {"SHA256SUMS.txt"})
        with zipfile.ZipFile(io.BytesIO(self.files[f"beforeword_toolkit_{VERSION}.zip"])) as archive:
            self.assertFalse(any(name.startswith("beforeword/downloads/") for name in archive.namelist()))
            actual = {name.removeprefix("beforeword/"): hashlib.sha256(archive.read(name)).hexdigest()
                      for name in archive.namelist()}
            self.assertEqual(manifest["source_files_sha256"], actual)
            for provider in ("claude", "openai"):
                license_path = f"plugins/{provider}/beforeword/LICENSE"
                source_license = ROOT / license_path
                if source_license.is_file():
                    self.assertEqual(archive.read("beforeword/" + license_path),
                                     source_license.read_bytes(),
                                     "The source toolkit must retain each package's license notice")
        self.assertEqual(len([name for name in self.files if name.endswith(".zip")]), 7)

    def test_guide_download_links_resolve_and_start_with_complete_text(self):
        prefix = f"https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/{VERSION}/"
        for filename in ("docs/ai-guide.en.md", "docs/ai-guide.ru.md"):
            text = (ROOT / filename).read_text(encoding="utf-8")
            targets = re.findall(re.escape(prefix) + r"([^\s)]+)", text)
            self.assertEqual(set(targets), set(self.files))
            self.assertIn(targets[0], ("beforeword_core_RU.txt", "beforeword_core_EN.txt"))
            self.assertIn(targets[1], ("beforeword_core_RU.txt", "beforeword_core_EN.txt"))

    def test_source_archive_extracts_with_readable_file_permissions(self):
        raw = self.files[f"beforeword_toolkit_{VERSION}.zip"]
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            for entry in archive.infolist():
                self.assertEqual(stat.S_IMODE(entry.external_attr >> 16), 0o644, entry.filename)
                self.assertTrue(stat.S_ISREG(entry.external_attr >> 16), entry.filename)
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            archive_path = target / "toolkit.zip"
            archive_path.write_bytes(raw)
            subprocess.run(["unzip", "-oq", str(archive_path), "-d", str(target / "extracted")], check=True)
            files = list((target / "extracted").rglob("*"))
            self.assertTrue(files)
            for path in files:
                if path.is_file():
                    self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o644, str(path))

    def test_refresh_refuses_undeclared_overwrites_and_check_is_read_only(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "release"
            write_files(target, self.files)
            write_files(target, self.files, check=True)
            changed = dict(self.files, **{"beforeword_core_EN.txt": b"modified"})
            with self.assertRaises(ValueError):
                write_files(target, changed)
            with self.assertRaises(ValueError):
                write_files(target, changed, check=True)
            self.assertEqual((target / "beforeword_core_EN.txt").read_bytes(), self.files["beforeword_core_EN.txt"])
            write_files(target, changed, replace=True)
            self.assertEqual((target / "beforeword_core_EN.txt").read_bytes(), b"modified")
            (target / "unrelated.txt").write_text("preserve")
            with self.assertRaises(ValueError):
                write_files(target, self.files, replace=True)
            self.assertEqual((target / "unrelated.txt").read_text(), "preserve")


if __name__ == "__main__":
    unittest.main()
