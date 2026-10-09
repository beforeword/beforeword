"""Release metadata and exact selected-core pins; no behavioral assessment."""
from __future__ import annotations

import datetime
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def load_contract(root: Path = ROOT) -> dict:
    value = json.loads((root / "references/release-contract.json").read_bytes())
    if value.get("schema_version") != 1:
        raise ValueError("Unsupported release-contract schema")
    if not re.fullmatch(r"\d+\.\d+\.\d+", value.get("version", "")):
        raise ValueError("Release version must be MAJOR.MINOR.PATCH")
    datetime.date.fromisoformat(value["date_utc"])
    if value.get("status") not in ("awaiting-selection", "selected"):
        raise ValueError("Unknown release selection status")
    if value["status"] == "awaiting-selection" and value.get("core_sha256") is not None:
        raise ValueError("Pending selection must not declare selected-core hashes")
    return value


def require_selected(root: Path = ROOT) -> dict:
    value = load_contract(root)
    if value["status"] != "selected":
        raise ValueError("Release build blocked: awaiting exact RU/EN core selection")
    pins = value.get("core_sha256")
    if not isinstance(pins, dict) or set(pins) != {"ru", "en"}:
        raise ValueError("Selected release requires both RU and EN core hashes")
    for language, expected in pins.items():
        if not isinstance(expected, str) or not re.fullmatch(r"[0-9a-f]{64}", expected):
            raise ValueError(f"Invalid selected {language} core hash")
        raw = (root / f"assets/core.{language}.txt").read_bytes()
        raw.decode("utf-8")
        if hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError(f"Selected {language} core bytes differ from release contract")
    return value


_metadata = load_contract()
VERSION = _metadata["version"]
DATE = _metadata["date_utc"]
