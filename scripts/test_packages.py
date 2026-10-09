"""Offline checks of the six exported archives; no installation or model calls."""

import hashlib
import io
import json
from pathlib import PurePosixPath
import stat
import unittest
import zipfile

from package_plugins import DEFAULT_VERSION, ROOT, build_bundles


EXPECTED_FILES = {
    "openai": {
        ".agents/plugins/marketplace.json",
        "plugins/beforeword/plugin.json",
        "plugins/beforeword/skills/read/SKILL.md",
        "README.md",
    },
    "claude": {
        ".claude-plugin/plugin.json",
        "skills/read/SKILL.md",
        "README.md",
    },
    "skill": {"SKILL.md", "README.md"},
}
SKILL_PATHS = {
    "openai": "plugins/beforeword/skills/read/SKILL.md",
    "claude": "skills/read/SKILL.md",
    "skill": "SKILL.md",
}


class PackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundles = {language: build_bundles(language) for language in ("ru", "en")}

    def test_six_distinct_named_archives_and_metadata(self):
        records = [r for bundles in self.bundles.values() for r in bundles.values()]
        self.assertEqual(len(records), 6)
        self.assertEqual(len({r["name"] for r in records}), 6)
        self.assertEqual(len({r["sha256"] for r in records}), 6)
        for language, bundles in self.bundles.items():
            self.assertEqual(set(bundles), set(EXPECTED_FILES))
            for provider, record in bundles.items():
                with self.subTest(language=language, provider=provider):
                    self.assertEqual(record["language"], language)
                    self.assertEqual(record["version"], DEFAULT_VERSION)
                    self.assertIn(f"_{language.upper()}_{DEFAULT_VERSION}.zip", record["name"])
                    self.assertEqual(record["sha256"], hashlib.sha256(record["bytes"]).hexdigest())
                    self.assertEqual(set(record["files"]), EXPECTED_FILES[provider])

    def test_exact_paths_safe_members_and_utf8_contents(self):
        for language, bundles in self.bundles.items():
            for provider, record in bundles.items():
                with self.subTest(language=language, provider=provider):
                    with zipfile.ZipFile(io.BytesIO(record["bytes"])) as archive:
                        names = archive.namelist()
                        self.assertEqual(len(names), len(set(names)))
                        self.assertEqual(set(names), EXPECTED_FILES[provider])
                        self.assertIsNone(archive.testzip())
                        for info in archive.infolist():
                            path = PurePosixPath(info.filename)
                            self.assertFalse(path.is_absolute())
                            self.assertNotIn("..", path.parts)
                            self.assertNotIn("\\", info.filename)
                            self.assertNotIn(":", info.filename)
                            self.assertFalse(info.is_dir())
                            mode = info.external_attr >> 16
                            self.assertFalse(stat.S_ISLNK(mode))
                            self.assertEqual(mode & 0o111, 0)
                            actual = archive.read(info).decode("utf-8")
                            self.assertEqual(actual, record["file_contents"][info.filename])

    def test_selected_core_is_exact_and_other_language_is_absent(self):
        cores = {lang: (ROOT / "assets" / f"core.{lang}.txt").read_bytes().decode("utf-8")
                 for lang in ("ru", "en")}
        for language, bundles in self.bundles.items():
            other = "en" if language == "ru" else "ru"
            for provider, record in bundles.items():
                with self.subTest(language=language, provider=provider):
                    with zipfile.ZipFile(io.BytesIO(record["bytes"])) as archive:
                        skill = archive.read(SKILL_PATHS[provider]).decode("utf-8")
                    core = cores[language]
                    self.assertTrue(skill.endswith(core))
                    self.assertEqual(skill.count(core), 1)
                    self.assertNotIn(cores[other].rstrip(), skill)
                    expected_name = "beforeword" if provider == "skill" else "read"
                    self.assertTrue(skill.startswith(f"---\nname: {expected_name}\n"))

    def test_manifests_have_only_declared_instruction_package_fields(self):
        for language, bundles in self.bundles.items():
            for provider, manifest_path in (
                ("openai", "plugins/beforeword/plugin.json"),
                ("claude", ".claude-plugin/plugin.json"),
            ):
                with self.subTest(language=language, provider=provider):
                    files = bundles[provider]["file_contents"]
                    manifest = json.loads(files[manifest_path])
                    expected_keys = {"name", "version", "description"}
                    if provider == "openai":
                        expected_keys.add("$schema")
                    self.assertEqual(set(manifest), expected_keys)
                    self.assertEqual(manifest["name"], "beforeword")
                    self.assertEqual(manifest["version"], DEFAULT_VERSION)
                    self.assertIsInstance(manifest["description"], str)
                    self.assertTrue(manifest["description"])
            marketplace = json.loads(bundles["openai"]["file_contents"][".agents/plugins/marketplace.json"])
            self.assertEqual(len(marketplace["plugins"]), 1)
            self.assertEqual(marketplace["plugins"][0]["source"],
                             {"source": "local", "path": "./plugins/beforeword"})
        # The allowlisted archive paths and manifest keys exclude scripts,
        # install hooks and server configuration from these particular exports.

    def test_repeated_builds_are_byte_identical_in_this_environment(self):
        for language in ("ru", "en"):
            repeated = build_bundles(language)
            for provider in EXPECTED_FILES:
                with self.subTest(language=language, provider=provider):
                    self.assertEqual(self.bundles[language][provider]["bytes"],
                                     repeated[provider]["bytes"])


if __name__ == "__main__":
    unittest.main()
