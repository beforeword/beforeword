#!/usr/bin/env python3
"""Independently recompute beforeword 1.3.3 archived comparison summaries.

Reads the already-public frozen 500-response export.
No API calls, provider access, scoring, grading, or claims of independence.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

SOURCE = Path(__file__).resolve().parents[2] / "references" / "comparison-1.3.3.json"
ARMS = ("no_beforeword", "beforeword_B", "beforeword_C")
AXES = ("generic_utility", "all_original_criteria_result", "boundary", "task", "format")
ALLOWED = {"met", "not_met", "unresolved", "not_applicable"}


def audit(source: Path = SOURCE) -> dict[str, Any]:
    doc = json.loads(source.read_text(encoding="utf-8"))
    rows = doc["responses"]
    schedule = doc["schedule"]
    case_ids = {x["case_id"] for x in doc["cases"]}
    route_ids = {x["route_key"] for x in doc["routes"]}
    if len(case_ids) != 12 or len(route_ids) != 7:
        raise ValueError("Unexpected number of cases or routes")
    if len(schedule) != 504 or len(rows) != 500:
        raise ValueError("Unexpected planned/received totals")
    if len({x["request_id"] for x in schedule}) != len(schedule):
        raise ValueError("Repeated scheduled request IDs")
    if len({x["request_id"] for x in rows}) != len(rows):
        raise ValueError("Repeated response request IDs")
    schedule_ids = {x["request_id"] for x in schedule}
    if not all(x["request_id"] in schedule_ids for x in rows):
        raise ValueError("Response without a scheduled request")

    hash_mismatches = []
    for r in rows:
        if r["case_id"] not in case_ids or r["route_key"] not in route_ids:
            raise ValueError("Response with unregistered case/route")
        if r["arm"] not in ARMS or r["repetition"] not in (1, 2):
            raise ValueError("Unknown arm or repetition")
        if not all(r["measures"].get(axis) in ALLOWED for axis in AXES):
            raise ValueError(f"Unknown grading category in {r['request_id']}")
        if hashlib.sha256(
            r["final_content"].encode("utf-8")
        ).hexdigest() != r["final_content_utf8_sha256"]:
            hash_mismatches.append(r["request_id"])
    if hash_mismatches:
        raise ValueError(f"Response text hash mismatches: {hash_mismatches[:4]}")

    clusters: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        clusters[(r["case_id"], r["route_key"])].append(r)
    if len(clusters) != 84:
        raise ValueError("Missing case × route clusters")

    complete: list[list[dict[str, Any]]] = []
    exclusions: list[dict[str, Any]] = []
    for (case, route), entries in sorted(clusters.items()):
        counts = Counter(e["arm"] for e in entries)
        unresolved = [
            {
                "arm": e["arm"],
                "repetition": e["repetition"],
                "all_criteria_result": e["measures"]["all_original_criteria_result"],
                "generic_utility": e["measures"]["generic_utility"],
            }
            for e in entries
            if any(
                e["measures"][axis] not in ("met", "not_met")
                for axis in ("all_original_criteria_result", "generic_utility")
            )
        ]
        duplicates = len(
            {(e["arm"], e["repetition"]) for e in entries}
        ) != len(entries)
        if any(counts.get(arm, 0) != 2 for arm in ARMS) or unresolved or duplicates:
            exclusions.append(
                {
                    "case_id": case,
                    "route_key": route,
                    "response_count": len(entries),
                    "arm_counts": {arm: counts[arm] for arm in ARMS},
                    "unresolved": unresolved,
                    "duplicate_arm_repetition": duplicates,
                }
            )
        else:
            complete.append(entries)
    if len(complete) != 79 or len(exclusions) != 5:
        raise ValueError("Expected 79 complete clusters and five exclusions")

    arm_scores: dict[str, dict[str, dict[str, int]]] = {}
    for arm in ARMS:
        selected = [r for entries in complete for r in entries if r["arm"] == arm]
        if len(selected) != 158:
            raise ValueError(f"Wrong denominator for {arm}")
        arm_scores[arm] = {
            axis: dict(sorted(Counter(r["measures"][axis] for r in selected).items()))
            for axis in AXES
        }

    paired_tables: dict[str, dict[str, dict[str, int]]] = {}
    for right_arm in ARMS[1:]:
        contrast: dict[str, dict[str, int]] = {}
        for axis in AXES:
            labels = Counter()
            for entries in complete:
                for rep in (1, 2):
                    a = next(
                        x for x in entries if x["arm"] == "no_beforeword"
                        and x["repetition"] == rep
                    )["measures"][axis]
                    b = next(
                        x for x in entries if x["arm"] == right_arm
                        and x["repetition"] == rep
                    )["measures"][axis]
                    if a == b == "not_applicable":
                        continue
                    if not all(v in ("met", "not_met") for v in (a, b)):
                        raise ValueError(f"Unresolved paired value on {axis}")
                    if a == "met" and b == "met":
                        labels["both_met"] += 1
                    elif a == "met":
                        labels["left_only"] += 1
                    elif b == "met":
                        labels["right_only"] += 1
                    else:
                        labels["neither_met"] += 1
            contrast[axis] = {
                x: labels[x] for x in
                ("both_met", "left_only", "right_only", "neither_met")
            }
        paired_tables[right_arm] = contrast

    # Compare independently counted tuples with the archive's own
    # selected-cluster tables. This detects silent denominator drift.
    published = doc["complete_cluster_comparisons"]["overall"]
    if published["complete_three_arm_clusters"] != len(complete):
        raise ValueError("Published complete cluster denominator differs")
    for record in published["contrasts"]:
        if record["left_arm"] != "no_beforeword":
            continue
        right = record["right_arm"]
        for axis in AXES:
            expected = record["measures"][axis]["paired_counts"]
            if expected != paired_tables[right][axis]:
                raise ValueError(f"Mismatch with published {right}/{axis} paired table")

    return {
        "source_file": source.as_posix(),
        "source_versions": {
            "instruction_release": doc["release_version"],
            "model_identifiers": [x["model_id"] for x in doc["routes"]],
        },
        "counts": {
            "planned_requests": len(schedule),
            "recorded_final_answers": len(rows),
            "missing_or_blocked": len(schedule) - len(rows),
            "cases": len(case_ids),
            "routes": len(route_ids),
            "arms": len(ARMS),
            "repetitions": 2,
            "complete_case_route_clusters": len(complete),
            "excluded_case_route_clusters": len(exclusions),
            "matched_answers_per_arm": 158,
            "all_response_text_hashes_match": True,
        },
        "complete_cluster_arm_scores": arm_scores,
        "paired_vs_baseline": paired_tables,
        "exclusions": exclusions,
        "publication_gate": {
            "decision": doc["selection"]["decision"],
            "all_gates_pass": doc["selection"]["all_gates_pass"],
        },
        "limits": [
            "Recomputation of archived reviewer labels only; not new independent scoring.",
            "Matched responses share prompts and model routes; 158 samples per arm are not 158 independent experiments.",
            "A specific beforeword boundary criterion is not a general helpfulness metric.",
            "Results depend on the archived model routes, authored cases, instructions and reviewer judgments.",
            "No proof of causal efficacy of one instruction clause or current provider model behavior.",
        ],
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, default=SOURCE)
    p.add_argument("--out", type=Path)
    a = p.parse_args()
    result = audit(a.source)
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if a.out:
        if a.out.exists():
            p.error(f"Refusing to overwrite {a.out}")
        a.out.parent.mkdir(parents=True, exist_ok=True)
        a.out.write_text(rendered, encoding="utf-8")
        print("Archive counts, response hashes and paired tables audited")
        print(f"Audit file: {a.out}")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
