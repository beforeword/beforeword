#!/usr/bin/env python3
"""Check package structure and exact payload preservation; never invokes a host.

Passing these checks describes local files only, not platform acceptance or
runtime behavior. A pending license is reported as a publication blocker.
"""

from __future__ import annotations

import io
import json
from pathlib import PurePosixPath
import re
import stat
import sys
import xml.etree.ElementTree as ET
import zipfile

sys.dont_write_bytecode = True

import build


def check_svg(data: bytes) -> None:
    svg = ET.fromstring(data.decode("utf-8"))
    build.require(svg.tag == "{http://www.w3.org/2000/svg}svg", "Logo must have an SVG root")
    viewbox = [float(part) for part in re.split(r"[ ,]+", svg.attrib.get("viewBox", "").strip()) if part]
    build.require(len(viewbox) == 4 and viewbox[2] > 0 and viewbox[3] > 0, "Logo needs a positive viewBox")
    build.require(viewbox[2] == viewbox[3], "Logo viewBox must be square")
    for dimension in ("width", "height"):
        if dimension in svg.attrib:
            match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)(?:px)?", svg.attrib[dimension])
            build.require(bool(match) and float(match.group(1)) > 0, f"Logo {dimension} must be positive")
    build.require(not any(element.tag.rsplit("}", 1)[-1] in ("script", "foreignObject") for element in svg.iter()),
                  "Logo must not contain active content")
    for element in svg.iter():
        for key, value in element.attrib.items():
            local = key.rsplit("}", 1)[-1]
            build.require(not local.lower().startswith("on"), "Logo must not contain event handlers")
            if local == "href":
                build.require(value.startswith("#"), "Logo must not load external resources")


def checked_reference(reference: str, names: set[str]) -> str:
    build.require(reference.startswith("./"), f"Asset reference must be relative: {reference}")
    path = PurePosixPath(reference)
    build.require(".." not in path.parts, f"Asset reference escapes its package: {reference}")
    clean = str(path)
    build.require(clean in names, f"Referenced asset is missing: {reference}")
    return clean


def run() -> dict:
    expected, metadata = build.expected_outputs()
    findings = build.drift(expected)
    build.require(not findings, "Generated outputs differ: " + "; ".join(findings))
    listing = build.load_listing()
    skill = build.source_skill()
    core_en = (build.ROOT / "assets/core.en.txt").read_bytes()
    build.require(skill.endswith(core_en), "The skill must end with the complete, byte-exact English core")
    build.require(skill.count(core_en) == 1, "The skill must contain exactly one unmodified English core")
    report = {}
    approved = listing["license"]["status"] == "approved"
    allowed_common = {"README.md", "README.ru.md", "assets/logo.svg", "skills/read/SKILL.md"}
    if approved:
        allowed_common.add("LICENSE")
    for provider in ("claude", "openai"):
        record = metadata["packages"][provider]
        directory = build.ROOT / record["source"]
        manifest_name = ".claude-plugin/plugin.json" if provider == "claude" else "plugin.json"
        names = {str(path.relative_to(directory)) for path in directory.rglob("*") if path.is_file()}
        build.require(names == allowed_common | {manifest_name}, f"Unexpected {provider} package files")
        data = {name: (directory / name).read_bytes() for name in names}
        for name, raw in data.items():
            raw.decode("utf-8")
            build.require(b"\x00" not in raw, f"Null bytes in {provider}/{name}")
        build.require(data["skills/read/SKILL.md"] == skill, f"Changed skill in {provider}")
        for name in ("README.md", "README.ru.md"):
            build.require(len(data[name].decode("utf-8").split()) >= 40, f"{provider}/{name} needs at least 40 words")
        check_svg(data["assets/logo.svg"])
        manifest = json.loads(data[manifest_name])
        build.require(manifest["name"] == listing["name"] and manifest["version"] == listing["version"],
                      f"Identity mismatch in {provider}")
        forbidden = {"mcpServers", "mcp", "hooks", "commands", "agents", "tools", "lspServers", "settings"}
        build.require(not (forbidden & manifest.keys()), f"Undeclared runtime capabilities in {provider}")
        build.require(("license" in manifest) == approved and ("LICENSE" in names) == approved,
                      f"License inclusion differs from the explicit decision in {provider}")
        if provider == "claude":
            allowed = {"name", "version", "displayName", "description", "author", "homepage", "repository",
                       "documentationUrl", "supportUrl", "privacyPolicyUrl", "icon", "keywords", "license"}
            build.require(not (manifest.keys() - allowed), "Unknown Claude manifest keys")
            build.https_url(manifest["privacyPolicyUrl"], "Claude privacyPolicyUrl")
            build.require(manifest["privacyPolicyUrl"] == listing["privacyPolicy"],
                          "Claude privacy policy differs from the reviewed listing")
            build.require((build.CATALOG / "PRIVACY.md").is_file(), "Privacy policy source is missing")
            checked_reference(manifest["icon"], names)
        else:
            allowed = {"$schema", "name", "version", "description", "author", "homepage", "repository",
                       "license", "keywords", "extensions"}
            build.require(not (manifest.keys() - allowed), "Unknown Agent Plugins manifest keys")
            build.require(manifest["$schema"] == build.SCHEMA, "Agent Plugins schema identifier differs")
            build.require(set(manifest["extensions"]) == {"com.openai"}, "Undeclared OpenAI extensions")
            extension = manifest["extensions"]["com.openai"]
            build.require(set(extension) == {"interface", "publication"}, "Undeclared OpenAI extension fields")
            interface = extension["interface"]
            build.require(interface["category"] == "Productivity", "Unexpected directory category")
            build.text_field(interface["shortDescription"], "OpenAI shortDescription", 30)
            build.text_field(interface["longDescription"], "OpenAI longDescription", 4000)
            build.https_url(interface["privacyPolicyURL"], "OpenAI privacyPolicyURL")
            build.text_field(interface["privacyPolicyURL"], "OpenAI privacyPolicyURL", 1024)
            build.require(interface["privacyPolicyURL"] == listing["privacyPolicy"],
                          "OpenAI privacy policy differs from the reviewed listing")
            build.require((build.CATALOG / "PRIVACY.md").is_file(), "Privacy policy source is missing")
            build.require(interface["capabilities"] == listing["locales"]["en"]["capabilities"],
                          "OpenAI displayed capabilities differ from the reviewed listing")
            build.require(interface["defaultPrompt"] == listing["locales"]["en"]["starters"],
                          "OpenAI starters differ from the reviewed listing")
            for key in ("logo", "composerIcon"):
                checked_reference(interface[key], names)
            translation = extension["publication"]["translations"]["ru-RU"]
            build.text_field(translation["subtitle"], "Russian subtitle", 30)
            build.text_field(translation["description"], "Russian description", 4000)

        archive_data = (build.ROOT / record["archive"]).read_bytes()
        build.require(build.sha256(archive_data) == record["sha256"], f"ZIP digest mismatch for {provider}")
        with zipfile.ZipFile(io.BytesIO(archive_data)) as archive:
            build.require(len(archive.infolist()) == len(names) and set(archive.namelist()) == names,
                          f"ZIP must contain each source file once for {provider}")
            for info in archive.infolist():
                build.require(archive.read(info) == data[info.filename], f"ZIP payload differs: {info.filename}")
                mode = info.external_attr >> 16
                build.require(info.create_system == 3 and stat.S_ISREG(mode) and stat.S_IMODE(mode) == 0o644,
                              f"ZIP entry must be a Unix regular file with mode 0644: {info.filename}")
                build.require(info.date_time == build.ZIP_DATE and not info.is_dir(), "ZIP metadata must be deterministic")
        build.require(build.zip_bytes(data) == archive_data, f"ZIP rebuild is not deterministic for {provider}")
        report[provider] = {"files": len(names), "archiveSha256": build.sha256(archive_data),
                            "instructionSha256": build.sha256(data["skills/read/SKILL.md"])}

    draft = json.loads((build.CATALOG / "gpt-store/draft.json").read_text(encoding="utf-8"))
    build.require(draft["status"] == "prepared-not-created", "GPT draft status must remain explicit")
    instruction_lengths = {}
    for language in ("en", "ru"):
        scope = (build.ROOT / f"assets/scope.{language}.txt").read_bytes().decode("utf-8")
        medium = (build.ROOT / f"assets/medium.{language}.txt").read_bytes().decode("utf-8")
        expected_instruction = scope.rstrip("\n") + "\n\n" + medium
        actual = (build.CATALOG / f"gpt-store/instructions.{language}.txt").read_bytes().decode("utf-8")
        build.require(actual == expected_instruction, f"GPT {language} instructions do not preserve the exact sources")
        build.require(len(actual) < 8000, f"GPT {language} instruction exceeds the character budget")
        local = draft["locales"][language]
        build.require(local["instructionEdition"] == "medium", "GPT condensed edition must be explicit")
        build.require(local["instructionSource"] == f"assets/medium.{language}.txt", "GPT instruction source differs")
        checked_reference(local["instructionsPath"], {f"instructions.{language}.txt"})
        build.require(local["instructionCharacters"] == len(actual), f"GPT {language} character count differs")
        build.require(local["starters"] == listing["locales"][language]["starters"], "GPT starters differ")
        instruction_lengths[language] = len(actual)
    return {"structure": "passed", "exactPayloadPreservation": "passed", "packages": report,
            "gptInstructionCharacters": instruction_lengths, "runtimeValidation": "not-run-by-check",
            "portalStatusRecord": "catalog/submission-status.json",
            "readiness": metadata["status"], "blockers": metadata["blockers"]}


def main() -> int:
    try:
        print(json.dumps(run(), ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile, ET.ParseError) as error:
        print(f"Catalog check failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
