"""Bind current source editions and recorded checks without transferring old results."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath

from release_contract import ROOT, require_selected

EDITIONS = ("core", "medium", "compact")
LANGUAGES = ("en", "ru")


def describe(raw: bytes) -> dict:
    return {"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw),
            "characters": len(raw.decode("utf-8"))}


def selected_editions(root: Path = ROOT) -> dict:
    return {edition: {language: describe((root / f"assets/{edition}.{language}.txt").read_bytes())
                      for language in LANGUAGES} for edition in EDITIONS}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def load_current_review(root: Path = ROOT) -> tuple[str, dict]:
    contract = require_selected(root)
    version = contract["version"]
    relative = f"references/development-review-{version}.json"
    report = json.loads((root / relative).read_bytes())
    require(report.get("instruction_version") == version, "Current review instruction version differs")
    current = selected_editions(root)
    manifest = json.loads((root / f"references/instruction-editions-{version}.json").read_bytes())
    require(manifest.get("version") == version, "Current edition manifest version differs")
    for edition in EDITIONS:
        for language in LANGUAGES:
            pinned = manifest.get("editions", {}).get(edition, {}).get(language, {})
            require(all(pinned.get(key) == value for key, value in current[edition][language].items()),
                    f"Current edition manifest differs from selected {edition}.{language} source")
            maximum = {"medium": 5000, "compact": 1500}.get(edition)
            require(maximum is None or current[edition][language]["characters"] <= maximum,
                    f"Selected {edition}.{language} exceeds its character limit")
            entry = report.get("selected_editions", {}).get(edition, {}).get(language, {})
            require(all(entry.get(key) == value for key, value in current[edition][language].items()),
                    f"Current review differs from selected {edition}.{language} source")
            if "text" in entry:
                require(entry["text"].encode("utf-8") == (root / f"assets/{edition}.{language}.txt").read_bytes(),
                        f"Current review text differs from selected {edition}.{language} source")
    # Existing released records retain their original schema and observations.
    if report.get("schema_version") == 1:
        require(version == "1.4.1", "New current reviews require the raw-evidence schema")
        return relative, report
    require(report.get("schema_version") == 2, "Unsupported current review schema")
    status, runs = report.get("status"), report.get("runs")
    require(status in ("pending", "recorded"), "Unknown current review status")
    require(isinstance(runs, list), "Current review runs must be an array")
    require((status == "pending" and not runs) or (status == "recorded" and bool(runs)),
            "Review status and recorded runs disagree")
    for section in ("reader_adapter", "comparison"):
        count = report.get(section, {}).get("provider_calls", 0)
        require(type(count) is int and count >= 0, "Provider-call count must be nonnegative")
        require(status != "pending" or count == 0, "Pending review cannot claim provider calls")
    previous = report.get("previous_candidate_runs", [])
    require(isinstance(previous, list), "Previous candidate runs must be an array")
    runs_to_check = [(run, current) for run in runs]
    if previous:
        archive = json.loads((root / f"references/instruction-candidates-{version}.json").read_bytes())
        require(archive.get("instruction_version") == version, "Candidate archive version differs")
        candidates = {entry["revision"]: entry for entry in archive["candidates"]}
        for run in previous:
            revision = run.get("candidate_revision")
            require(revision in candidates, "Previous run has no frozen candidate source")
            frozen = candidates[revision]["files"]
            expected = {}
            for edition in EDITIONS:
                expected[edition] = {}
                for language in LANGUAGES:
                    entry = frozen[f"assets/{edition}.{language}.txt"]
                    actual = describe(entry["text"].encode("utf-8"))
                    require(all(entry.get(key) == value for key, value in actual.items()),
                            "Frozen candidate source metadata differs from its text")
                    expected[edition][language] = actual
            runs_to_check.append((run, expected))
    identifiers = set()
    for run, expected in runs_to_check:
        require(isinstance(run, dict), "Recorded run must be an object")
        identifier = run.get("id")
        require(isinstance(identifier, str) and bool(identifier) and identifier not in identifiers,
                "Recorded run needs a unique id")
        identifiers.add(identifier)
        edition, language = run.get("edition"), run.get("language")
        require(edition in EDITIONS and language in LANGUAGES, "Recorded run edition is invalid")
        require(run.get("instruction_sha256") == expected[edition][language]["sha256"],
                "Recorded run instruction hash differs")
        count = run.get("observed_answers")
        require(type(count) is int and count > 0, "Recorded run needs a positive observed-answer count")
        require(isinstance(run.get("environment"), str) and bool(run["environment"].strip()),
                "Recorded run needs its actual environment")
        require(run.get("review_status") in ("unreviewed", "reviewed"), "Recorded run review status is invalid")
        evidence = run.get("evidence")
        require(isinstance(evidence, list) and bool(evidence), "Recorded run needs raw evidence")
        for record in evidence:
            relative_path = record.get("path", "")
            path = PurePosixPath(relative_path)
            require(bool(relative_path) and not path.is_absolute() and ".." not in path.parts and
                    path.parts[0] == "references", "Evidence path must stay inside references")
            source = root / path
            require(source.is_file() and not source.is_symlink() and
                    source.resolve().is_relative_to(root.resolve()), "Evidence source is missing or unsafe")
            require(hashlib.sha256(source.read_bytes()).hexdigest() == record.get("sha256"),
                    "Recorded raw evidence hash differs")
    return relative, report


def review_summary(relative: str, report: dict, *, version: str, raw: bytes) -> dict:
    return {"report": relative, "instruction_version": report["instruction_version"],
            "historical": report["instruction_version"] != version,
            "status": report.get("status", "recorded"),
            "scope": "Recorded checks retain their exact edition, environment and limitations; pending means no current model-response result. Historical findings do not transfer to new source bytes.",
            "development_outputs": sum(run["observed_answers"] for run in report["runs"]),
            "previous_candidate_outputs": sum(run["observed_answers"] for run in report.get("previous_candidate_runs", [])),
            "reader_outputs": report.get("reader_adapter", {}).get("provider_calls", 0),
            "comparison_outputs": report.get("comparison", {}).get("provider_calls", 0),
            "report_sha256": hashlib.sha256(raw).hexdigest()}


def current_evidence_files(root: Path = ROOT) -> list[str]:
    """Validated repository-relative sources to accompany the public report."""
    relative, report = load_current_review(root)
    files = {relative, f"references/instruction-editions-{report['instruction_version']}.json"}
    if report.get("previous_candidate_runs"):
        files.add(f"references/instruction-candidates-{report['instruction_version']}.json")
    if report.get("schema_version") == 2:
        for run in report["runs"] + report.get("previous_candidate_runs", []):
            files.update(item["path"] for item in run["evidence"])
    return sorted(files)
