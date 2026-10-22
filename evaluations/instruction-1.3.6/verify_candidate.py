#!/usr/bin/env python3
"""Static checks for proposed beforeword instruction 1.3.6.

Checks wording, version boundaries, sizes and fixture structure.
It does not run, grade, diagnose with, or certify any AI model.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path

DEFAULT_SOURCE_ROOT = Path(__file__).resolve().parents[2]
ROOT = "evaluations/instruction-1.3.6/"
NAMES = (
    "core.en.txt",
    "core.ru.txt",
    "medium.en.txt",
    "medium.ru.txt",
    "compact.en.txt",
    "compact.ru.txt",
)
UNIVERSAL_MARKS = {
    "core.en.txt": ("No written word receives an exception", "including “illness”"),
    "core.ru.txt": ("Ни одно написанное слово не получает исключения", "включая «болезнь»"),
    "medium.en.txt": ("without exceptions", "No word is exempt"),
    "medium.ru.txt": ("без исключений", "Ни одно слово"),
    "compact.en.txt": ("no exceptions", "“danger”"),
    "compact.ru.txt": ("без исключений", "«болезни»"),
}
URGENT_MARKS = {
    "core.en.txt": ("emergency services", "Do not claim a diagnosis", "Urgency changes"),
    "core.ru.txt": ("экстренной помощью", "Не превращай написанные симптомы", "Срочность определяет"),
    "medium.en.txt": ("emergency care", "without diagnosis from a label", "Urgency"),
    "medium.ru.txt": ("экстренную помощь", "без диагноза по слову", "Срочность"),
    "compact.en.txt": ("urgent reports", "emergency care", "Urgency"),
    "compact.ru.txt": ("сообщении о срочном риске", "экстренную помощь", "Срочность"),
}


def download(relative: str, ref: str) -> bytes:
    request = urllib.request.Request(
        f"https://raw.githubusercontent.com/beforeword/beforeword/{ref}/{relative}",
        headers={"User-Agent": "beforeword-1.3.6-source-check"},
    )
    with urllib.request.urlopen(request, timeout=25) as stream:
        data = stream.read(1500001)
    if len(data) > 1500000:
        raise ValueError(f"Unexpectedly large source: {relative}")
    return data


def require(condition: bool, detail: object) -> None:
    """Validation must remain active when Python is run with -O."""
    if not condition:
        raise ValueError(str(detail))


def check(source_root: Path | None = None, ref: str | None = None) -> dict:
    require(not (source_root is not None and ref is not None), "Choose local sources or a remote commit")
    if ref is not None:
        require(re.fullmatch(r"[0-9a-fA-F]{40}", ref) is not None, "--ref requires a full 40-character commit SHA")
        ref = ref.lower()
    root = (source_root or DEFAULT_SOURCE_ROOT).resolve()
    hashes: dict[str, str] = {}

    def read(relative: str) -> bytes:
        content = download(relative, ref) if ref is not None else (root / relative).read_bytes()
        hashes[relative] = hashlib.sha256(content).hexdigest()
        return content

    texts: dict[str, str] = {}
    for name in NAMES:
        content = read(ROOT + name).decode("utf-8")
        require(content.startswith("beforeword"), name)
        require(content.endswith("\n"), name)
        for needle in UNIVERSAL_MARKS[name] + URGENT_MARKS[name]:
            require(needle in content, (name, needle))
        require("No emergencies exist because" not in content, 'Validation failed: "No emergencies exist because" not in content')
        require("Опасности не существует, потому" not in content, 'Validation failed: "Опасности не существует, потому" not in content')
        texts[name] = content
    for lang in ("en", "ru"):
        require(len(texts[f"medium.{lang}.txt"]) <= 5000, lang)
        require(len(texts[f"compact.{lang}.txt"]) <= 1500, lang)
        skill = read(ROOT + f"skills/{lang}/SKILL.md").decode("utf-8")
        require(skill.splitlines()[:2] == ["---", "name: beforeword"], lang)
        require(skill.endswith(texts[f"core.{lang}.txt"]), lang)
        require(skill.count(texts[f"core.{lang}.txt"]) == 1, lang)

    # Check the original selected source has NOT been changed or silently
    # repackaged as if this new candidate were already installed.
    pins = json.loads(read("references/release-contract.json"))
    require(pins["version"] == "1.3.5", 'Validation failed: pins["version"] == "1.3.5"')
    require(pins["status"] == "selected", 'Validation failed: pins["status"] == "selected"')
    for lang in ("en", "ru"):
        current = read(f"assets/core.{lang}.txt")
        previous = read(f"downloads/1.3.5/beforeword_core_{lang.upper()}.txt")
        require(current == previous, 'Validation failed: current == previous')
        require(hashlib.sha256(current).hexdigest() == pins["core_sha256"][lang], 'Validation failed: hashlib.sha256(current).hexdigest() == pins["core_sha256"][lang]')
        require(current.decode("utf-8") != texts[f"core.{lang}.txt"], 'Validation failed: current.decode("utf-8") != texts[f"core.{lang}.txt"]')

    cases = [
        json.loads(line)
        for line in read(ROOT + "test-cases.jsonl").decode("utf-8").splitlines()
        if line.strip()
    ]
    require(len(cases) == 14, f"Unexpected case count {len(cases)}")
    require(len({case["id"] for case in cases}) == len(cases), 'Validation failed: len({case["id"] for case in cases}) == len(cases)')
    require(sum(case["lang"] == "ru" for case in cases) == 7, 'Validation failed: sum(case["lang"] == "ru" for case in cases) == 7')
    require(sum(case["lang"] == "en" for case in cases) == 7, 'Validation failed: sum(case["lang"] == "en" for case in cases) == 7')
    for case in cases:
        require(case["prompt"] and len(case["criteria"]) >= 3, case["id"])
        require(all(isinstance(c, str) and c.strip() for c in case["criteria"]), 'Validation failed: all(isinstance(c, str) and c.strip() for c in case["criteria"])')
    required = {
        "urgent_dyspnea", "urgent_overdose", "definition_without_crisis",
        "universal_self_application", "format_translation", "arithmetic",
        "action_receipts", "symmetric_medical_terms",
    }
    require(required <= {case["category"] for case in cases}, 'Validation failed: required <= {case["category"] for case in cases}')
    by_id = {case["id"]: case for case in cases}
    all_samples = [
        json.loads(line)
        for line in read(ROOT + "samples.jsonl").decode("utf-8").splitlines()
        if line.strip()
    ]
    require(len(all_samples) == 14, 'Validation failed: len(all_samples) == 14')
    require({s["case_id"] for s in all_samples} == set(by_id), 'Validation failed: {s["case_id"] for s in all_samples} == set(by_id)')
    for sample in all_samples:
        original = by_id[sample["case_id"]]
        require(sample["language"] == original["lang"], 'Validation failed: sample["language"] == original["lang"]')
        require(sample["category"] == original["category"], 'Validation failed: sample["category"] == original["category"]')
        require(sample["input"] == [{"role": "user", "content": original["prompt"]}], 'Validation failed: sample["input"] == [{"role": "user", "content": original["prompt"]}]')
        require(all(c in sample["criteria"] for c in original["criteria"]), 'Validation failed: all(c in sample["criteria"] for c in original["criteria"])')
    for lang in ("en", "ru"):
        sample_lines = [
            json.loads(line)
            for line in read(ROOT + f"samples.{lang}.jsonl").decode("utf-8").splitlines()
            if line.strip()
        ]
        require(len(sample_lines) == 7, 'Validation failed: len(sample_lines) == 7')
        require(sample_lines == [s for s in all_samples if s["language"] == lang], 'Validation failed: sample_lines == [s for s in all_samples if s["language"] == lang]')
    return {
        "result": "STATIC_CANDIDATE_CHECK_PASSED",
        "source": {"mode": "remote_commit", "commit": ref} if ref is not None else {"mode": "local", "root": str(root)},
        "source_sha256": dict(sorted(hashes.items())),
        "candidate": "1.3.6",
        "text_editions": len(texts),
        "compact_lengths": {lang: len(texts[f"compact.{lang}.txt"]) for lang in ("en", "ru")},
        "medium_lengths": {
            lang: len(texts[f"medium.{lang}.txt"]) for lang in ("en", "ru")
        },
        "cases": len(cases),
        "runnable_samples": len(all_samples),
        "full_skills_preserve_core_exactly": True,
        "language_split_preserved": True,
        "case_languages": {"ru": 7, "en": 7},
        "selected_stable_release": pins["version"],
        "stable_source_bytes_unchanged": True,
        "model_requests": 0,
        "semantic_behavior_proven": False,
        "installation_claimed": False,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--source-root", type=Path, help="Repository root to check without network access (default: this checkout)")
    source.add_argument("--ref", help="Explicit remote snapshot: full 40-character Git commit SHA")
    args = parser.parse_args()
    try:
        print(json.dumps(check(source_root=args.source_root, ref=args.ref), ensure_ascii=False, indent=2))
    except Exception as exc:
        print(
            json.dumps(
                {"result": "CHECK_FAILED", "error_type": type(exc).__name__, "detail": str(exc)},
                ensure_ascii=False,
            ),
            file=sys.stderr,
        )
        sys.exit(1)
