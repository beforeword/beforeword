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

from build_downloads import DEFERRED_FILES, ROOT, VERSION, build_files, write_files
from build_public import settings


class DownloadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.files = build_files()

    def test_full_text_has_exact_core_and_editions_remain_separate(self):
        for language in ("ru", "en"):
            core = (ROOT / "assets" / f"core.{language}.txt").read_bytes().decode("utf-8")
            self.assertLessEqual(len(self.files[f"beforeword_compact_{language.upper()}.txt"].decode("utf-8")), 1500,
                                 "Compact instructions must fit the declared settings field")
            medium = self.files[f"beforeword_5000_{language.upper()}.txt"]
            self.assertLessEqual(len(medium.decode("utf-8")), 5000, "The complete medium edition fits 5,000 characters")
            self.assertEqual(medium, (ROOT / "assets" / f"medium.{language}.txt").read_bytes())
            self.assertEqual(self.files[f"beforeword_core_{language.upper()}.txt"], core.encode("utf-8"))
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
            self.assertLess(len(medium), 8000, "The GPT draft uses the medium edition without a second scope prefix")

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
        hosted = {
            "https://beforeword.xyz/model/toolkit/beforeword_AI.html": f"beforeword_AI_{VERSION}.html",
            "https://beforeword.xyz/model/downloads/beforeword_toolkit.zip": f"beforeword_toolkit_{VERSION}.zip",
        }
        self.assertEqual(set(hosted.values()), DEFERRED_FILES)
        for filename in ("docs/ai-guide.en.md", "docs/ai-guide.ru.md"):
            text = (ROOT / filename).read_text(encoding="utf-8")
            targets = re.findall(re.escape(prefix) + r"([^\s)]+)", text)
            self.assertEqual(set(targets), set(self.files) - DEFERRED_FILES)
            for url, name in hosted.items():
                self.assertEqual(text.count(f"]({url})"), 1)
                self.assertNotIn(prefix + name, text)
            self.assertIn(targets[0], ("beforeword_core_RU.txt", "beforeword_core_EN.txt"))
            self.assertIn(targets[1], ("beforeword_core_RU.txt", "beforeword_core_EN.txt"))

    def test_hydration_restores_only_declared_files_then_strict_check_passes(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary).resolve() / "release"
            tracked = {name: raw for name, raw in self.files.items() if name not in DEFERRED_FILES}
            write_files(target, tracked)
            timestamps = {name: (target / name).stat().st_mtime_ns for name in tracked}
            with self.assertRaises(ValueError):
                write_files(target, self.files, check=True)
            write_files(target, self.files, hydrate=True)
            write_files(target, self.files, check=True)
            self.assertEqual(timestamps, {name: (target / name).stat().st_mtime_ns for name in tracked})
            # Rehydration is a verified no-op, including an already present large file.
            timestamps = {name: (target / name).stat().st_mtime_ns for name in self.files}
            write_files(target, self.files, hydrate=True)
            self.assertEqual(timestamps, {name: (target / name).stat().st_mtime_ns for name in self.files})
            one = sorted(DEFERRED_FILES)[0]
            (target / one).unlink()
            write_files(target, self.files, hydrate=True)
            write_files(target, self.files, check=True)

    def test_hydration_checks_all_tracked_provenance_before_any_write(self):
        for damaged in ("manifest.json", "SHA256SUMS.txt", "beforeword_core_EN.txt",
                        f"beforeword_toolkit_{VERSION}.zip"):
            with self.subTest(damaged=damaged), tempfile.TemporaryDirectory() as temporary:
                target = Path(temporary).resolve() / "release"
                tracked = {name: raw for name, raw in self.files.items() if name not in DEFERRED_FILES}
                tracked[damaged] = b"changed bytes"
                write_files(target, tracked)
                before = {p.name: p.read_bytes() for p in target.iterdir()}
                with self.assertRaisesRegex(ValueError, "Tracked downloads differ"):
                    write_files(target, self.files, hydrate=True)
                self.assertEqual(before, {p.name: p.read_bytes() for p in target.iterdir()})

    def test_hydration_refuses_other_missing_or_extra_files_and_changed_source_manifest(self):
        tracked = {name: raw for name, raw in self.files.items() if name not in DEFERRED_FILES}
        variants = [
            ({name: raw for name, raw in tracked.items() if name != "beforeword_core_EN.txt"}, self.files),
            (dict(tracked, **{"unexpected.txt": b"keep"}), self.files),
            (tracked, dict(self.files, **{"manifest.json": b"rebuilt from different source"})),
            ({}, self.files),
        ]
        for present, built in variants:
            with self.subTest(present=list(present)), tempfile.TemporaryDirectory() as temporary:
                target = Path(temporary).resolve() / "release"
                write_files(target, present)
                before = {p.name: p.read_bytes() for p in target.iterdir()}
                with self.assertRaises(ValueError):
                    write_files(target, built, hydrate=True)
                self.assertEqual(before, {p.name: p.read_bytes() for p in target.iterdir()})

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

    def test_toolkit_contains_a_complete_reproducible_browser_package_without_local_state(self):
        raw = self.files[f"beforeword_toolkit_{VERSION}.zip"]
        prefix = "beforeword/integrations/browser/"
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            names = archive.namelist()
            self.assertFalse(any(set(Path(name).parts) & {"node_modules", "build", "__pycache__", ".git"} for name in names))
            self.assertFalse(any(Path(name).name in {".env", "quotas.sqlite", "quotas.sqlite-wal", "quotas.sqlite-shm"} for name in names))
            for name in ("extension/manifest.json", "extension/privacy.html", "extension/providers.js", "tools/build-chrome.py", "tools/test-panel-privacy.cjs", "server/index.cjs", "server/store.cjs", "server/answer.cjs", "app.js", "package.json", "package-lock.json", "README.md"):
                self.assertEqual(archive.read(prefix + name), (ROOT / "integrations/browser" / name).read_bytes())
            manifest = json.loads(archive.read(prefix + "extension/manifest.json"))
            package = json.loads(archive.read(prefix + "package.json"))
            lock = json.loads(archive.read(prefix + "package-lock.json"))
            self.assertEqual(package["version"], manifest["version"])
            self.assertEqual(lock["packages"][""]["devDependencies"], package["devDependencies"])
            with tempfile.TemporaryDirectory() as temporary:
                output = Path(temporary).resolve()
                archive.extractall(output)
                browser = output / "beforeword/integrations/browser"
                # A user can build the downloaded source without any of this checkout's dependencies.
                subprocess.run(["python3", "-B", str(browser / "tools/build-chrome.py"), "--output", str(output / "one")], check=True, capture_output=True)
                subprocess.run(["python3", "-B", str(ROOT / "integrations/browser/tools/build-chrome.py"), "--output", str(output / "two")], check=True, capture_output=True)
                filename = "beforeword-0.5.6-chrome.zip"
                self.assertEqual((output / "one" / filename).read_bytes(), (output / "two" / filename).read_bytes())

    def test_refresh_refuses_undeclared_overwrites_and_check_is_read_only(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary).resolve() / "release"
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
