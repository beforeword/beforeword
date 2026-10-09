#!/usr/bin/env python3
"""Build explicit, deterministic beforeword directory packages without network access.

This prepares files only. It does not install, submit, create a GPT, or publish.
Run with --write to generate outputs or --check to report generated-file drift.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path, PurePosixPath
import re
import stat
import sys
from urllib.parse import urlparse
import zipfile

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from release_contract import VERSION, DATE, require_selected

CATALOG = ROOT / "catalog"
SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
ZIP_DATE = (*map(int, DATE.split("-")), 0, 0, 0)
OWNED_TREES = ("plugins/claude/beforeword", "plugins/openai/beforeword",
               "catalog/packages", "catalog/gpt-store")
HANDWRITTEN_FILES = {"catalog/gpt-store/README.md", "catalog/gpt-store/README.ru.md"}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def text_field(value: object, label: str, maximum: int | None = None) -> str:
    require(isinstance(value, str) and bool(value.strip()), f"{label} must be nonempty text")
    require("\x00" not in value, f"{label} contains a null character")
    if maximum is not None:
        require(len(value) <= maximum, f"{label} exceeds {maximum} characters")
    return value


def https_url(value: object, label: str) -> str:
    value = text_field(value, label)
    parsed = urlparse(value)
    require(parsed.scheme == "https" and bool(parsed.netloc), f"{label} must be an HTTPS URL")
    require(not parsed.username and not parsed.password, f"{label} must not include credentials")
    return value


def load_listing() -> dict:
    listing = json.loads((CATALOG / "listing.json").read_text(encoding="utf-8"))
    require(isinstance(listing, dict), "listing.json must contain an object")
    require(listing.get("name") == "beforeword", "Catalog name must be beforeword")
    require(listing.get("version") == VERSION, "Catalog and release-contract versions differ")
    publisher = listing.get("publisher", {})
    text_field(publisher.get("name"), "publisher.name")
    https_url(publisher.get("url"), "publisher.url")
    for key in ("website", "support", "privacyPolicy", "documentation", "repository"):
        https_url(listing.get(key), key)
    for language in ("en", "ru"):
        local = listing.get("locales", {}).get(language)
        require(isinstance(local, dict), f"locales.{language} is required")
        for key, limit in (("subtitle", 30), ("summary", 160), ("description", 4000)):
            text_field(local.get(key), f"locales.{language}.{key}", limit)
        for key in ("starters", "capabilities"):
            values = local.get(key)
            require(isinstance(values, list) and len(values) == 3,
                    f"locales.{language}.{key} must have exactly three entries")
            for index, value in enumerate(values):
                text_field(value, f"locales.{language}.{key}[{index}]", 128 if key == "starters" else None)
    license_meta = listing.get("license", {})
    require(license_meta.get("status") in ("pending-owner-decision", "approved"),
            "license.status must be pending-owner-decision or approved")
    return listing


def source_skill() -> bytes:
    spec = importlib.util.spec_from_file_location("beforeword_package_plugins", ROOT / "scripts/package_plugins.py")
    require(spec is not None and spec.loader is not None, "Cannot load the existing skill packager")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.skill_text("en", "read").encode("utf-8")


def zip_bytes(files: dict[str, bytes]) -> bytes:
    result = io.BytesIO()
    with zipfile.ZipFile(result, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            require(not PurePosixPath(name).is_absolute() and ".." not in PurePosixPath(name).parts,
                    f"Unsafe archive path: {name}")
            info = zipfile.ZipInfo(name, ZIP_DATE)
            info.create_system = 3
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(info, data, compresslevel=9)
    return result.getvalue()


def expected_outputs() -> tuple[dict[str, bytes], dict]:
    """Return expected file bytes and release metadata; never writes anything."""
    contract = require_selected(ROOT)
    listing = load_listing()
    english, russian = (listing["locales"][language] for language in ("en", "ru"))
    core = {language: (ROOT / f"assets/core.{language}.txt").read_bytes() for language in ("en", "ru")}
    for language, data in core.items():
        require(sha256(data) == contract["core_sha256"][language], f"The selected {language} core hash does not match")
        data.decode("utf-8")

    approved_license = listing["license"]["status"] == "approved"
    license_data = None
    license_id = None
    if approved_license:
        license_path = CATALOG / "approved-LICENSE.txt"
        require(license_path.is_file(), "Approved status requires catalog/approved-LICENSE.txt")
        license_data = license_path.read_bytes()
        text_field(license_data.decode("utf-8"), "approved-LICENSE.txt")
        license_id = text_field(listing["license"].get("spdx") or listing["license"].get("proposed"),
                                "license SPDX identifier")

    common = {
        "skills/read/SKILL.md": source_skill(),
        "README.md": (CATALOG / "plugin-readme.en.md").read_bytes(),
        "README.ru.md": (CATALOG / "plugin-readme.ru.md").read_bytes(),
        "assets/logo.svg": (CATALOG / "assets/logo.svg").read_bytes(),
    }
    if license_data is not None:
        common["LICENSE"] = license_data
    identity = {
        "name": listing["name"], "version": listing["version"],
        "description": english["summary"], "author": listing["publisher"],
        "homepage": listing["website"], "repository": listing["repository"],
        "keywords": ["beforeword", "reading", "text", "interpretation", "claims"],
    }
    if license_id is not None:
        identity["license"] = license_id
    claude = {
        **identity, "displayName": listing["name"],
        "documentationUrl": listing["documentation"], "supportUrl": listing["support"],
        "privacyPolicyUrl": listing["privacyPolicy"],
        "icon": "./assets/logo.svg",
    }
    openai = {
        "$schema": SCHEMA, **identity,
        "extensions": {
            "com.openai": {
                "interface": {
                    "displayName": listing["name"], "shortDescription": english["subtitle"],
                    "longDescription": english["description"], "developerName": listing["publisher"]["name"],
                    "category": "Productivity", "capabilities": english["capabilities"],
                    "websiteURL": listing["website"], "supportURL": listing["support"],
                    "privacyPolicyURL": listing["privacyPolicy"],
                    "defaultPrompt": english["starters"],
                    "logo": "./assets/logo.svg", "composerIcon": "./assets/logo.svg",
                },
                "publication": {
                    "translations": {
                        "ru-RU": {"subtitle": russian["subtitle"], "description": russian["description"]},
                    },
                },
            },
        },
    }
    bundles = {
        "claude": {**common, ".claude-plugin/plugin.json": json_bytes(claude)},
        "openai": {**common, "plugin.json": json_bytes(openai)},
    }
    outputs: dict[str, bytes] = {}
    package_records = {}
    for provider, files in bundles.items():
        source_path = f"plugins/{provider}/beforeword"
        archive_path = f"catalog/packages/beforeword_{provider}_directory_{listing['version']}.zip"
        for name, data in files.items():
            outputs[f"{source_path}/{name}"] = data
        archive = zip_bytes(files)
        outputs[archive_path] = archive
        package_records[provider] = {
            "source": source_path, "archive": archive_path, "sha256": sha256(archive),
            "files": sorted(files), "status": "prepared",
            "submissionBlockers": [] if approved_license else ["owner-license-decision-pending"],
        }

    gpt_locales = {}
    for language in ("en", "ru"):
        instruction = (ROOT / f"assets/medium.{language}.txt").read_bytes().decode("utf-8")
        require(len(instruction) < 8000, f"GPT instructions in {language} must remain below 8000 characters")
        name = f"instructions.{language}.txt"
        outputs[f"catalog/gpt-store/{name}"] = instruction.encode("utf-8")
        local = listing["locales"][language]
        gpt_locales[language] = {
            "title": listing["name"], "description": local["summary"],
            "starters": local["starters"], "instructionsPath": f"./{name}",
            "instructionCharacters": len(instruction),
            "instructionEdition": "medium",
            "instructionSource": f"assets/medium.{language}.txt",
            "scopeIncludedInInstructionSource": True,
        }
    outputs["catalog/gpt-store/draft.json"] = json_bytes({
        "name": listing["name"], "version": listing["version"], "status": "prepared-not-created",
        "availability": "Account publication eligibility has not been checked.",
        "locales": gpt_locales,
    })
    manifest = {
        "name": listing["name"], "version": listing["version"],
        "recordType": "package-build",
        "status": "prepared" if approved_license else "blocked-license-decision",
        "runtimeValidation": "not-run-by-build",
        "portalStatusRecord": "../submission-status.json",
        "license": listing["license"],
        "blockers": [] if approved_license else ["Owner approval of a distribution license is pending."],
        "sourceCoreSha256": {language: sha256(data) for language, data in core.items()},
        "sharedSkillSha256": sha256(common["skills/read/SKILL.md"]),
        "packages": package_records,
        "files": {name: {"sha256": sha256(data), "bytes": len(data)} for name, data in sorted(outputs.items())},
    }
    outputs["catalog/packages/manifest.json"] = json_bytes(manifest)
    return outputs, manifest


def generated_files() -> set[str]:
    result = set()
    for directory in OWNED_TREES:
        path = ROOT / directory
        if path.exists():
            result.update(str(file.relative_to(ROOT)) for file in path.rglob("*") if file.is_file() or file.is_symlink())
    # Versioned archives remain immutable, downloadable historical artifacts.
    current_version = load_listing()["version"]
    historical_archives = {name for name in result
                           if (match := re.fullmatch(r"catalog/packages/beforeword_(?:claude|openai)_directory_(\d+\.\d+\.\d+)\.zip", name))
                           and match.group(1) != current_version}
    return result - HANDWRITTEN_FILES - historical_archives


def drift(outputs: dict[str, bytes]) -> list[str]:
    findings = []
    for name, expected in outputs.items():
        path = ROOT / name
        if path.is_symlink():
            findings.append(f"symlink: {name}")
        elif not path.is_file():
            findings.append(f"missing: {name}")
        elif path.read_bytes() != expected:
            findings.append(f"changed: {name}")
    findings.extend(f"unexpected: {name}" for name in sorted(generated_files() - outputs.keys()))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--write", action="store_true", help="Write deterministic package outputs")
    action.add_argument("--check", action="store_true", help="Compare outputs without writing")
    args = parser.parse_args()
    try:
        outputs, manifest = expected_outputs()
        if args.write:
            extras = sorted(generated_files() - outputs.keys())
            require(not extras, "Unexpected files in generated trees; review before rebuilding: " + ", ".join(extras))
            for name, data in outputs.items():
                target = ROOT / name
                require(not target.is_symlink(), f"Refusing to overwrite symlink: {name}")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
        findings = drift(outputs)
        print(json.dumps({"mode": "write" if args.write else "check", "files": len(outputs),
                          "drift": findings, "status": manifest["status"],
                          "blockers": manifest["blockers"]}, ensure_ascii=False, indent=2))
        return 1 if findings else 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Catalog build failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
