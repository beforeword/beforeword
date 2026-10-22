#!/usr/bin/env python3
"""Static checks for proposed beforeword instruction 1.3.6.

Checks wording, version boundaries, sizes and fixture structure.
It does not run, grade, diagnose with, or certify any AI model.
"""
from __future__ import annotations

import hashlib
import json
import sys
import urllib.request

BASE = "https://raw.githubusercontent.com/beforeword/beforeword/3a7329f99475e9b080ffb79bd26034d3b6cb0abf/"
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
    "compact.en.txt": ("no word is exempt", "medical labels"),
    "compact.ru.txt": ("ни одно слово", "«болезнь»"),
}
URGENT_MARKS = {
    "core.en.txt": ("emergency services", "Do not claim a diagnosis", "Urgency changes"),
    "core.ru.txt": ("экстренной помощью", "Не превращай написанные симптомы", "Срочность определяет"),
    "medium.en.txt": ("emergency care", "without diagnosis from a label", "Urgency"),
    "medium.ru.txt": ("экстренную помощь", "без диагноза по слову", "Срочность"),
    "compact.en.txt": ("urgent reported risks", "without diagnosis", "word status"),
    "compact.ru.txt": ("срочном сообщении", "без диагноза", "статус слова"),
}


def download(relative: str) -> bytes:
    request = urllib.request.Request(
        BASE + relative, headers={"User-Agent": "beforeword-1.3.6-source-check"}
    )
    with urllib.request.urlopen(request, timeout=25) as stream:
        data = stream.read(1500001)
    if len(data) > 1500000:
        raise ValueError(f"Unexpectedly large source: {relative}")
    return data


def check() -> dict:
    texts: dict[str, str] = {}
    for name in NAMES:
        content = download(ROOT + name).decode("utf-8")
        assert content.startswith("beforeword"), name
        assert content.endswith("\n"), name
        for needle in UNIVERSAL_MARKS[name] + URGENT_MARKS[name]:
            assert needle in content, (name, needle)
        assert "No emergencies exist because" not in content
        assert "Опасности не существует, потому" not in content
        texts[name] = content
    for lang in ("en", "ru"):
        assert len(texts[f"medium.{lang}.txt"]) <= 5000, lang
        assert len(texts[f"compact.{lang}.txt"]) < 2400, lang

    # Check the original selected source has NOT been changed or silently
    # repackaged as if this new candidate were already installed.
    pins = json.loads(download("references/release-contract.json"))
    assert pins["version"] == "1.3.5"
    assert pins["status"] == "selected"
    for lang in ("en", "ru"):
        current = download(f"assets/core.{lang}.txt")
        previous = download(f"downloads/1.3.5/beforeword_core_{lang.upper()}.txt")
        assert current == previous
        assert hashlib.sha256(current).hexdigest() == pins["core_sha256"][lang]
        assert current.decode("utf-8") != texts[f"core.{lang}.txt"]

    cases = [
        json.loads(line)
        for line in download(ROOT + "test-cases.jsonl").decode("utf-8").splitlines()
        if line.strip()
    ]
    assert len(cases) == 14, f"Unexpected case count {len(cases)}"
    assert len({case["id"] for case in cases}) == len(cases)
    assert sum(case["lang"] == "ru" for case in cases) == 7
    assert sum(case["lang"] == "en" for case in cases) == 7
    for case in cases:
        assert case["prompt"] and len(case["criteria"]) >= 3, case["id"]
        assert all(isinstance(c, str) and c.strip() for c in case["criteria"])
    required = {
        "urgent_dyspnea", "urgent_overdose", "definition_without_crisis",
        "universal_self_application", "format_translation", "arithmetic",
        "action_receipts", "symmetric_medical_terms",
    }
    assert required <= {case["category"] for case in cases}
    return {
        "result": "STATIC_CANDIDATE_CHECK_PASSED",
        "candidate": "1.3.6",
        "text_editions": len(texts),
        "medium_lengths": {
            lang: len(texts[f"medium.{lang}.txt"]) for lang in ("en", "ru")
        },
        "cases": len(cases),
        "case_languages": {"ru": 7, "en": 7},
        "selected_stable_release": pins["version"],
        "stable_source_bytes_unchanged": True,
        "model_requests": 0,
        "semantic_behavior_proven": False,
        "installation_claimed": False,
    }


if __name__ == "__main__":
    try:
        print(json.dumps(check(), ensure_ascii=False, indent=2))
    except Exception as exc:
        print(
            json.dumps(
                {"result": "CHECK_FAILED", "error_type": type(exc).__name__, "detail": str(exc)},
                ensure_ascii=False,
            ),
            file=sys.stderr,
        )
        sys.exit(1)
