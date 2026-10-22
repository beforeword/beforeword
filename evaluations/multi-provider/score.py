#!/usr/bin/env python3
"""Score independently reviewed beforeword model outputs.

No model is called. A verdict is supplied by a named reviewer; the script
does not infer validity from matching slogans or keywords.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

VERDICTS = {"met", "not_met", "unclear"}
RESULT_STATUSES = {"response_received", "request_failed"}


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise ValueError(f"File unavailable: {path}")
    records: list[dict[str, Any]] = []
    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError as err:
            raise ValueError(f"Malformed JSON at {path}:{i}") from err
        if not isinstance(data, dict):
            raise ValueError(f"Expected object at {path}:{i}")
        records.append(data)
    if not records:
        raise ValueError(f"No records in {path}")
    return records


def record_id(record: dict[str, Any]) -> str:
    """Bind manual judgment to exact recorded sample, not just case ID."""
    payload = json.dumps(
        record, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:24]


def validate_results(results: list[dict[str, Any]]) -> None:
    seen_samples: set[tuple[str, str]] = set()
    seen_ids: set[str] = set()
    for r in results:
        model, case, status = (
            r.get("model_requested"),
            r.get("case_id"),
            r.get("status"),
        )
        if not isinstance(model, str) or not model:
            raise ValueError("Missing model_requested")
        if not isinstance(case, str) or not case:
            raise ValueError("Missing case_id")
        if status not in RESULT_STATUSES:
            raise ValueError(f"{case}: invalid status {status!r}")
        if status == "response_received" and not isinstance(
            r.get("response_text"), str
        ):
            raise ValueError(f"{case}: response_received requires text")
        if not isinstance(r.get("criteria"), str):
            raise ValueError(f"{case}: missing case-specific criteria")
        if (model, case) in seen_samples:
            raise ValueError(
                f"Duplicate ({model}, {case}); split repeated runs into "
                "separate result files so answers are not silently pooled."
            )
        seen_samples.add((model, case))
        sample_id = record_id(r)
        if sample_id in seen_ids:
            raise ValueError(f"Duplicate audit ID {sample_id}")
        seen_ids.add(sample_id)


def review_template(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output = []
    for r in results:
        if r["status"] != "response_received":
            continue
        output.append(
            {
                "record_id": record_id(r),
                "model_requested": r["model_requested"],
                "case_id": r["case_id"],
                "response_text": r["response_text"],
                "criteria": r["criteria"],
                "verdict": "",
                "reviewer": "",
                "notes": "",
            }
        )
    return output


def checked_reviews(
    results: list[dict[str, Any]], reviews: list[dict[str, Any]]
) -> dict[str, dict[str, Any]]:
    available = {
        record_id(r): r for r in results if r["status"] == "response_received"
    }
    by_id = {}
    for entry in reviews:
        rid = entry.get("record_id")
        if not isinstance(rid, str) or rid not in available:
            raise ValueError(f"Unknown or stale record_id: {rid!r}")
        if rid in by_id:
            raise ValueError(f"Repeated review for audit ID {rid}")
        r = available[rid]
        if entry.get("case_id") != r["case_id"] or entry.get(
            "model_requested"
        ) != r["model_requested"]:
            raise ValueError(f"Review and response identifiers differ for {rid}")
        verdict = entry.get("verdict") or ""
        if verdict and verdict not in VERDICTS:
            raise ValueError(f"Invalid verdict for {rid}: {verdict!r}")
        if verdict and not (isinstance(entry.get("reviewer"), str)
                            and entry["reviewer"].strip()):
            raise ValueError(f"Named reviewer required for {rid}")
        by_id[rid] = {
            "verdict": verdict if verdict else "unreviewed",
            "reviewer": entry.get("reviewer") or None,
            "notes": entry.get("notes") or None,
        }
    return by_id


def summarize(
    results: list[dict[str, Any]],
    reviews: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "method": "human_criteria_review",
        "judgments_automatically_generated": False,
        "coverage": "Only observed cases in this results file, not the full benchmark unless all 24 are present.",
        "models": {},
    }
    by_model: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in results:
        by_model[r["model_requested"]].append(r)

    for model, entries in sorted(by_model.items()):
        case_rows = []
        pairs: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for r in entries:
            rid = record_id(r)
            verdict = (
                "request_failed"
                if r["status"] == "request_failed"
                else reviews.get(rid, {}).get("verdict", "unreviewed")
            )
            line = {
                "record_id": rid,
                "case_id": r["case_id"],
                "pair_id": r.get("pair_id"),
                "variant": r.get("variant"),
                "status": r["status"],
                "verdict": verdict,
                "reviewer": reviews.get(rid, {}).get("reviewer"),
            }
            case_rows.append(line)
            if isinstance(r.get("pair_id"), str) and r["pair_id"]:
                pairs[r["pair_id"]].append(line)

        pair_rows = []
        for pair_id, members in sorted(pairs.items()):
            variants = {m["variant"] for m in members}
            verdicts = [m["verdict"] for m in members]
            if len(members) != 2 or variants != {"a", "b"}:
                outcome = "incomplete"
            elif "request_failed" in verdicts:
                outcome = "incomplete"
            elif "not_met" in verdicts:
                outcome = "not_met"
            elif "unclear" in verdicts:
                outcome = "unclear"
            elif "unreviewed" in verdicts:
                outcome = "unreviewed"
            elif verdicts.count("met") == 2:
                outcome = "met"
            else:
                raise ValueError(f"Unrecognized labels for pair {pair_id}")
            pair_rows.append(
                {
                    "pair_id": pair_id,
                    "outcome": outcome,
                    "member_case_ids": sorted(x["case_id"] for x in members),
                }
            )

        out["models"][model] = {
            "observed_samples": len(entries),
            "case_counts": dict(sorted(Counter(x["verdict"] for x in case_rows).items())),
            "observed_pairs": len(pair_rows),
            "pair_counts": dict(sorted(Counter(x["outcome"] for x in pair_rows).items())),
            "pair_outcomes": pair_rows,
            "case_outcomes": case_rows,
        }
    return out


def self_test() -> None:
    """Synthetic tests only: no provider is called and no real scores are claimed."""
    def sample(model: str, case: str, pair: str, variant: str) -> dict[str, Any]:
        return {
            "model_requested": model,
            "case_id": case,
            "pair_id": pair,
            "variant": variant,
            "status": "response_received",
            "response_text": "Mock answer",
            "criteria": "Synthetic criteria; not evidence of any model quality",
            "timestamp_utc": "2026-10-22T00:00:00+00:00",
        }
    rows = [
        sample("mock/a", "x-a", "x", "a"),
        sample("mock/a", "x-b", "x", "b"),
        sample("mock/a", "y-a", "y", "a"),
        sample("mock/a", "y-b", "y", "b"),
        sample("mock/b", "z-a", "z", "a"),
        sample("mock/b", "z-b", "z", "b"),
    ]
    rows[-1]["status"] = "request_failed"
    rows[-1]["response_text"] = None
    validate_results(rows)
    template = review_template(rows)
    assert len(template) == 5
    labels = [
        dict(r, verdict=("not_met" if r["case_id"] == "y-a" else "met"), reviewer="synthetic-test")
        for r in template
    ]
    checked = checked_reviews(rows, labels)
    summary = summarize(rows, checked)
    assert summary["models"]["mock/a"]["pair_counts"] == {"met": 1, "not_met": 1}
    assert summary["models"]["mock/b"]["pair_counts"] == {"incomplete": 1}
    assert summary["models"]["mock/b"]["case_counts"]["request_failed"] == 1
    try:
        validate_results(rows + [rows[0]])
    except ValueError:
        pass
    else:
        raise AssertionError("Repeated runs must be detected")
    print("PASS: synthetic labels, full/failed pairs, duplicated samples, missing tool output.")
    print("No model was run, judged or certified.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", type=Path, help="Provider runner JSONL output")
    parser.add_argument("--template", type=Path, help="Write blank human review JSONL")
    parser.add_argument("--labels", type=Path, help="Read completed human reviews")
    parser.add_argument("--out", type=Path, help="Write aggregate JSON (with --labels)")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    if args.results is None:
        parser.error("--results is required")
    if bool(args.template) == bool(args.labels):
        parser.error("Select exactly one: --template or --labels")
    if args.out and not args.labels:
        parser.error("--out requires --labels")

    results = read_jsonl(args.results)
    validate_results(results)
    if args.template:
        template = review_template(results)
        if args.template.exists():
            parser.error(f"Refusing to overwrite {args.template}")
        args.template.parent.mkdir(parents=True, exist_ok=True)
        args.template.write_text(
            "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in template),
            encoding="utf-8",
        )
        print(f"Prepared {len(template)} blank reviews. No scores assigned: {args.template}")
    else:
        labels = checked_reviews(results, read_jsonl(args.labels))
        summary = summarize(results, labels)
        txt = json.dumps(summary, ensure_ascii=False, indent=2) + "\n"
        if args.out:
            if args.out.exists():
                parser.error(f"Refusing to overwrite {args.out}")
            args.out.parent.mkdir(parents=True, exist_ok=True)
            args.out.write_text(txt, encoding="utf-8")
            print(f"Human-labelled summary saved to {args.out}")
        else:
            print(txt)
    return 0


if __name__ == "__main__":
    sys.exit(main())
