#!/usr/bin/env python3
"""Build versioned downloads and their SHA-256 manifest.

The source bundle excludes downloads/ to avoid recursive archives.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import tempfile
import zipfile

from build_guide import ROOT, VERSION, build as build_guide, source_bundle
from package_plugins import DEFAULT_VERSION, build_bundles, skill_text

REPOSITORY = "https://github.com/beforeword/beforeword"


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def build_files() -> dict[str, bytes]:
    if VERSION != DEFAULT_VERSION:
        raise ValueError("Guide and native package versions differ")
    files: dict[str, bytes] = {}
    with tempfile.TemporaryDirectory(prefix="beforeword-downloads-") as temporary:
        guide = build_guide(Path(temporary))
        files[f"beforeword_AI_{VERSION}.html"] = guide.read_bytes()
        for language in ("ru", "en"):
            for edition in ("core", "5000", "compact"):
                name = f"beforeword_{edition}_{language.upper()}.txt"
                files[name] = (Path(temporary) / name).read_bytes()
            files[f"beforeword-SKILL-{language}.md"] = skill_text(language).encode("utf-8")
            for record in build_bundles(language, version=VERSION).values():
                files[record["name"]] = record["bytes"]

    source = source_bundle()
    source_bytes = base64.b64decode(source["data"])
    with zipfile.ZipFile(io.BytesIO(source_bytes)) as archive:
        inputs = {name.removeprefix("beforeword/"): digest(archive.read(name))
                  for name in archive.namelist()}
    if any(path.startswith("downloads/") for path in inputs):
        raise ValueError("Source bundle must exclude generated downloads")
    files[f"beforeword_toolkit_{VERSION}.zip"] = source_bytes
    manifest = {
        "version": VERSION,
        "repository": REPOSITORY,
        "source_directory": ".",
        "build_command": "python3 -B scripts/build_downloads.py",
        "hash_algorithm": "sha256",
        "source_files_sha256": inputs,
        "files": {name: {"sha256": digest(raw), "bytes": len(raw)}
                  for name, raw in sorted(files.items())},
    }
    files["manifest.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    files["SHA256SUMS.txt"] = "".join(f"{digest(raw)}  {name}\n" for name, raw in sorted(files.items())).encode("utf-8")
    return files


def write_files(output: Path, files: dict[str, bytes], *, replace: bool = False, check: bool = False) -> None:
    output = Path(output)
    if output.is_symlink() or any(parent.is_symlink() for parent in output.parents):
        raise ValueError("Output directory must not use symlinks")
    resolved = output.resolve()
    if resolved.is_relative_to(ROOT / "downloads") and resolved != ROOT / "downloads" / VERSION:
        raise ValueError("Versioned historical downloads cannot be overwritten by this release")
    if resolved == ROOT or any(resolved.is_relative_to(ROOT / name)
                               for name in ("assets", "references", "scripts", "docs", ".github")):
        raise ValueError("Output directory cannot contain or replace source files")
    existing = {}
    if output.exists():
        if not output.is_dir():
            raise ValueError("Output must be a directory")
        for path in output.iterdir():
            if path.is_symlink() or not path.is_file():
                raise ValueError("Output must contain only regular release files")
            existing[path.name] = path.read_bytes()
    if check:
        if existing != files:
            differences = sorted(name for name in set(files) | set(existing)
                                 if files.get(name) != existing.get(name))
            raise ValueError("Downloads differ from the current source: " + ", ".join(differences))
        return
    if existing and existing != files and not replace:
        raise ValueError("Existing downloads differ; choose a new output directory or use --replace to regenerate them")
    if set(existing) - set(files):
        raise ValueError("Output contains unexpected files; use a new empty directory")
    output.mkdir(parents=True, exist_ok=True)
    for name, raw in files.items():
        (output / name).write_bytes(raw)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "downloads" / VERSION)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--replace", action="store_true", help="Replace generated downloads with the current source build")
    mode.add_argument("--check", action="store_true", help="Compare existing downloads with the current source without writing")
    args = parser.parse_args()
    files = build_files()
    write_files(args.output, files, replace=args.replace, check=args.check)
    action = "Checked" if args.check else "Prepared"
    print(f"{action} {len(files)} files ({sum(map(len, files.values())):,} bytes): {args.output}")


if __name__ == "__main__":
    main()
