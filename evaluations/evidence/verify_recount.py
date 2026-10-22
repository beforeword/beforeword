#!/usr/bin/env python3
# /// script
# dependencies = []
# ///
"""Recalculate beforeword's published seven-route table without a model API.

Default: fetch two public, fixed-source records from beforeword's GitHub.
Use --source/--recount to verify exact local copies instead.
No model inference, hidden credentials, or grading is performed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

ORIGINAL_BLOB_SHA = "7751121083dc1bc6715fb688362ef1b4e074915f"
PUBLIC_PREFIX = "https://raw.githubusercontent.com/beforeword/beforeword/"
ORIGINAL_SOURCE = PUBLIC_PREFIX + "main/references/comparison-1.3.3.json"
RECOUNT_SOURCE = (
    PUBLIC_PREFIX
    + "bf8797171993aeff7ab7a921911f1bd0c556b5ca/"
    + "evaluations/evidence/seven-route-recount.json"
)
ARMS = ("no_beforeword", "beforeword_B", "beforeword_C")
AXES = (
    "all_original_criteria_result",
    "generic_utility",
    "boundary",
    "task",
    "format",
)


def read_bytes(where: str, *, local: bool = False) -> bytes:
    if local:
        return Path(where).read_bytes()
    request = urllib.request.Request(
        where, headers={"User-Agent": "beforeword-recount/0.1"}
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        result = response.read(15_000_000 + 1)
    if len(result) > 15_000_000:
        raise ValueError("Input exceeds 15 MB safety bound")
    return result


def git_blob_sha(raw: bytes) -> str:
    return hashlib.sha1(
        f"blob {len(raw)}\0".encode("ascii") + raw
    ).hexdigest()


def evaluate(source: dict[str, Any], recount: dict[str, Any]) -> dict[str, Any]:
    if len(source["schedule"]) != 504 or len(source["responses"]) != 500:
        raise AssertionError("Archived scheduled/received response counts changed")
    if source["study"]["counts"]["collection_gaps"] != 4:
        raise AssertionError("Archived technical gap count changed")
    ids = source["selection"]["complete_cluster_ids"]
    expected = {(x["case_id"], x["route_key"]) for x in ids}
    if len(ids) != 79 or len(expected) != 79:
        raise AssertionError("Expected exactly 79 unique selected clusters")
    selected = [
        x
        for x in source["responses"]
        if (x["case_id"], x["route_key"]) in expected
    ]
    if len(selected) != 474:
        raise AssertionError(f"Expected 474 selected responses: {len(selected)}")
    by_cluster: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for response in selected:
        key = (response["case_id"], response["route_key"], response["arm"])
        by_cluster.setdefault(key, []).append(response)
    if len(by_cluster) != 79 * 3:
        raise AssertionError("Missing cluster/arm groups")
    for name, items in by_cluster.items():
        if len(items) != 2 or {x["repetition"] for x in items} != {1, 2}:
            raise AssertionError(f"Missing or repeated paired answer in {name}")
        if any(
            x["measures"]["all_original_criteria_result"] not in ("met", "not_met")
            for x in items
        ):
            raise AssertionError(f"Unresolved judgment silently admitted into {name}")

    totals = {}
    for arm in ARMS:
        these = [r for r in selected if r["arm"] == arm]
        axes = {}
        for axis in AXES:
            axes[axis] = dict(Counter(r["measures"][axis] for r in these))
        totals[arm] = {"responses": len(these), "axes": axes}
    if totals != recount["aggregate"]:
        raise AssertionError("Published aggregate does not match source records")

    for entry in recount["by_route"]:
        route = entry["route_key"]
        for arm in ARMS:
            items = [
                r for r in selected if r["route_key"] == route and r["arm"] == arm
            ]
            actual = {
                "responses": len(items),
                "whole_response_met": sum(
                    r["measures"]["all_original_criteria_result"] == "met"
                    for r in items
                ),
                "generic_utility_met": sum(
                    r["measures"]["generic_utility"] == "met" for r in items
                ),
            }
            if actual != entry["arms"][arm]:
                raise AssertionError(f"Route tally differs: {route} {arm}")

    improvements, regressions = [], []
    for case, route in sorted(expected):
        baseline = by_cluster[case, route, "no_beforeword"]
        revised = by_cluster[case, route, "beforeword_B"]
        labels_base = [x["measures"]["all_original_criteria_result"] for x in baseline]
        labels_rev = [x["measures"]["all_original_criteria_result"] for x in revised]
        key = case + "|" + route
        if labels_base == ["not_met", "not_met"] and labels_rev == ["met", "met"]:
            improvements.append(key)
        if labels_base == ["met", "met"] and labels_rev == ["not_met", "not_met"]:
            regressions.append(key)
    # The source array order is not significant; per-arm repetitions are
    # independently checked above.
    spec = recount["strict_all_criteria_repetition_comparisons"]
    if sorted(improvements) != sorted(spec["improvements"]):
        raise AssertionError("Strict improvements differ")
    if sorted(regressions) != sorted(spec["regressions"]):
        raise AssertionError("Strict regressions differ")
    if len(improvements) != spec["strict_improvement_count"]:
        raise AssertionError("Improvement count differs")
    if len(regressions) != spec["strict_regression_count"]:
        raise AssertionError("Regression count differs")

    tasks = {c["case_id"]: c["prompt"] for c in source["cases"]}
    by_response_id = {r["anonymous_response_id"]: r for r in selected}
    for entry in recount["selected_samples"]:
        if entry["task_exact"] != tasks[entry["case_id"]]:
            raise AssertionError("Task wording changed in published recount")
        for arm, rows in entry["arm_records"].items():
            for row in rows:
                original = by_response_id.get(row["response_id"])
                if original is None:
                    raise AssertionError("Unknown recorded response ID")
                for rec_key, key in [
                    ("request_id", "request_id"),
                    ("repetition", "repetition"),
                    ("final_content_exact", "final_content"),
                    ("recorded_overall_judgment", "all_original_criteria_result"),
                    ("recorded_utility_judgment", "generic_utility"),
                    ("recorded_boundary_judgment", "boundary"),
                ]:
                    actual = (
                        original[key]
                        if key in ("request_id", "repetition", "final_content")
                        else original["measures"][key]
                    )
                    if row[rec_key] != actual:
                        raise AssertionError(
                            f"Selected response differs at {entry['case_id']}:{rec_key}"
                        )
                if (
                    original["case_id"] != entry["case_id"]
                    or original["route_key"] != entry["route"]
                    or original["arm"] != arm
                ):
                    raise AssertionError("Response attributed to wrong case/route/arm")

    return {
        "result": "RECOUNT_MATCHED_ARCHIVED_VALUES",
        "meaning": "Arithmetic and selected quoted bytes agree with the archived JSON, not an independent assessment of rubric truth or model internals.",
        "scheduled_requests": 504,
        "received_answers": 500,
        "eligible_clusters": 79,
        "matched_answers_per_arm": 158,
        "all_criteria_met": {
            arm: totals[arm]["axes"]["all_original_criteria_result"]["met"]
            for arm in ARMS
        },
        "strict_improvements_B": len(improvements),
        "strict_regressions_B": len(regressions),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, help="Optional local historical JSON")
    parser.add_argument("--recount", type=Path, help="Optional local recount JSON")
    args = parser.parse_args()
    if bool(args.source) != bool(args.recount):
        parser.error("Use both --source and --recount for offline local verification")
    source_bytes = read_bytes(str(args.source) if args.source else ORIGINAL_SOURCE,
                              local=bool(args.source))
    sha = git_blob_sha(source_bytes)
    if sha != ORIGINAL_BLOB_SHA:
        raise AssertionError(f"Original input blob changed: {sha}")
    source = json.loads(source_bytes)
    recount_bytes = read_bytes(
        str(args.recount) if args.recount else RECOUNT_SOURCE,
        local=bool(args.recount),
    )
    summary = evaluate(source, json.loads(recount_bytes))
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
