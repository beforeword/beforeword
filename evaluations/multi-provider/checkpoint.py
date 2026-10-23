#!/usr/bin/env python3
"""Opt-in, resumable collection; a started request is never silently repeated.

SQLite stores intent before dispatch and the returned record afterwards. This
cannot guarantee provider-side exactly-once execution or establish billing.
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import importlib.util
import json
import math
import sqlite3
import sys
from contextlib import closing, contextmanager
from pathlib import Path
from typing import Any, Iterator

import run as runner

STATES = ("pending", "started", "response_received", "request_failed")


def encoded(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def make_plan(cases: list[dict[str, Any]], models: list[str], *, instruction: str | None = None,
              timeout: int = 90, max_tokens: int = 512, temperature: float | None = None,
              dataset_sha256: str | None = None) -> dict[str, Any]:
    if not cases or not models:
        raise ValueError("At least one case and model are required")
    if any(not isinstance(m, str) or not m.strip() or m != m.strip() for m in models):
        raise ValueError("Model identifiers must be nonblank and have no surrounding whitespace")
    if len(set(models)) != len(models):
        raise ValueError("Duplicate model identifiers would repeat requests")
    if type(timeout) is not int or type(max_tokens) is not int or min(timeout, max_tokens) < 1:
        raise ValueError("timeout and max_tokens must be positive integers")
    if temperature is not None and (type(temperature) not in (int, float) or not math.isfinite(temperature)):
        raise ValueError("temperature must be finite")
    ids = [c["case_id"] for c in cases]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate case IDs")
    for case in cases:
        runner.messages_for_case(case, instruction)  # Reject incompatible system messages before any request.
    return json.loads(encoded({
        "schema": 1, "models": models, "cases": cases, "instruction": instruction,
        "parameters": runner.request_parameters(timeout, max_tokens, temperature),
        "dataset_sha256": dataset_sha256,
        "runner_sha256": hashlib.sha256(Path(runner.__file__).read_bytes()).hexdigest(),
        "checkpoint_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "dispatch_policy": "stop_on_first_failure; never_retry_started_or_terminal",
    }))


def requests(plan: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    return [(model, case) for model in plan["models"] for case in plan["cases"]]


def validate_record(record: dict[str, Any], model: str, case: dict[str, Any], plan: dict[str, Any]) -> None:
    instruction = plan["instruction"]
    expected = {
        "model_requested": model, "case_id": case["case_id"], "criteria": case["criteria"],
        "messages_submitted": runner.messages_for_case(case, instruction),
        "request_parameters": plan["parameters"],
        "instruction_sha256": digest(instruction) if instruction is not None else None,
        "grading": "not_performed",
        **{key: case.get(key) for key in ("pair_id", "variant", "language", "category")},
    }
    if any(record.get(key) != value for key, value in expected.items()):
        raise ValueError("Returned record differs from the planned request; outcome left unresolved")
    status, text = record.get("status"), record.get("response_text")
    if status == "response_received" and isinstance(text, str) and text.strip():
        return
    if status == "request_failed" and text is None:
        return
    raise ValueError("Unsupported result; outcome left unresolved")


@contextmanager
def exclusive_lock(path: Path) -> Iterator[None]:
    # A separate SQLite transaction stays open across network calls. Its OS lock
    # is released after process death; no stale-file deletion/guessing is needed.
    with closing(sqlite3.connect(str(path) + ".lock.sqlite3", timeout=0, isolation_level=None)) as lock:
        try:
            lock.execute("BEGIN EXCLUSIVE")
        except sqlite3.OperationalError as exc:
            raise RuntimeError("Checkpoint is locked by another process or cannot be locked") from exc
        try:
            yield
        finally:
            lock.rollback()


def initialize(db: sqlite3.Connection, plan: dict[str, Any]) -> None:
    text = encoded(plan)
    db.execute("BEGIN IMMEDIATE")
    try:
        db.execute("CREATE TABLE metadata (id INTEGER PRIMARY KEY CHECK(id=1), plan TEXT NOT NULL, sha256 TEXT NOT NULL)")
        db.execute("CREATE TABLE requests (seq INTEGER PRIMARY KEY, state TEXT NOT NULL, started_utc TEXT, result TEXT, sha256 TEXT)")
        db.execute("INSERT INTO metadata VALUES (1, ?, ?)", (text, digest(text)))
        db.executemany("INSERT INTO requests VALUES (?, 'pending', NULL, NULL, NULL)",
                       [(i,) for i in range(len(requests(plan)))])
        db.commit()
    except BaseException:
        db.rollback()
        raise


def inspect(db: sqlite3.Connection, expected_plan: dict[str, Any] | None = None) -> tuple[dict[str, Any], list[tuple]]:
    metadata = db.execute("SELECT plan, sha256 FROM metadata ORDER BY id").fetchall()
    if len(metadata) != 1:
        raise ValueError("Invalid checkpoint metadata")
    text, checksum = metadata[0]
    if digest(text) != checksum:
        raise ValueError("Checkpoint plan checksum mismatch")
    plan = json.loads(text)
    if plan.get("schema") != 1:
        raise ValueError("Unsupported checkpoint schema")
    if expected_plan is not None and encoded(expected_plan) != text:
        raise ValueError("Run plan changed; refusing to mix models, instructions, datasets, code or parameters")
    items = requests(plan)
    rows = db.execute("SELECT seq, state, started_utc, result, sha256 FROM requests ORDER BY seq").fetchall()
    if [row[0] for row in rows] != list(range(len(items))):
        raise ValueError("Missing, duplicate or unexpected checkpoint request rows")
    for seq, state, started, result, checksum in rows:
        if state not in STATES:
            raise ValueError("Unknown checkpoint state")
        if state == "pending":
            if any(x is not None for x in (started, result, checksum)):
                raise ValueError("Invalid pending request")
        elif not isinstance(started, str) or not started:
            raise ValueError("Attempted request has no start marker")
        elif state == "started":
            if result is not None or checksum is not None:
                raise ValueError("Invalid unresolved request")
        else:
            if not isinstance(result, str) or digest(result) != checksum:
                raise ValueError("Checkpoint result checksum mismatch")
            record = json.loads(result)
            validate_record(record, *items[seq], plan)
            if record["status"] != state:
                raise ValueError("Result status differs from checkpoint state")
    return plan, rows


def summary(rows: list[tuple]) -> dict[str, int]:
    return {"planned": len(rows), **{state: sum(row[1] == state for row in rows) for state in STATES}}


def execute_plan(path: Path, plan: dict[str, Any], *, resume: bool = False,
                 completion_func: Any = None) -> dict[str, int]:
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    with exclusive_lock(path):
        exists = path.exists()
        if exists and not resume:
            raise ValueError("Checkpoint exists; use --resume with the identical plan")
        if resume and not exists:
            raise ValueError("Cannot resume a missing checkpoint")
        with closing(sqlite3.connect(path, timeout=0)) as db:
            db.execute("PRAGMA synchronous=FULL")
            if not exists:
                initialize(db, plan)
            _, rows = inspect(db, plan)
            items = requests(plan)
            for seq, state, *_ in rows:
                if state != "pending":
                    continue  # Includes failures and uncertain, potentially billed attempts.
                model, case = items[seq]
                with db:
                    db.execute("UPDATE requests SET state='started', started_utc=? WHERE seq=?",
                               (dt.datetime.now(dt.timezone.utc).isoformat(), seq))
                # A crash after this durable marker remains 'started', never a safe retry.
                params = plan["parameters"]
                record = runner.run_case(
                    copy.deepcopy(case), model, instruction=plan["instruction"],
                    instruction_label="checkpoint:" + digest(encoded(plan)),
                    completion_func=completion_func, timeout=params["timeout"],
                    max_tokens=params["max_tokens"], temperature=params.get("temperature"),
                )
                validate_record(record, model, case, plan)
                record["checkpoint_plan_sha256"] = digest(encoded(plan))
                record["checkpoint_request_index"] = seq
                text = encoded(record)
                with db:
                    db.execute("UPDATE requests SET state=?, result=?, sha256=? WHERE seq=?",
                               (record["status"], text, digest(text), seq))
                if record["status"] == "request_failed":
                    break  # Avoid spending the remaining queue on the same quota/auth failure.
            return summary(inspect(db, plan)[1])


def read_checkpoint(path: Path) -> tuple[dict[str, Any], list[tuple]]:
    path = path.resolve()
    if not path.is_file():
        raise ValueError("Checkpoint does not exist")
    with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
        return inspect(db)


def export_checkpoint(path: Path, out: Path) -> dict[str, int]:
    plan, rows = read_checkpoint(path)
    manifest = out.with_name(out.name + ".manifest.json")
    if out.exists() or manifest.exists():
        raise ValueError("Export destination or its manifest already exists; use new paths")
    counts = summary(rows)
    report = {
        "schema": 1, "plan_sha256": digest(encoded(plan)), "coverage": counts,
        "not_a_model_score": True,
        "unresolved_request_indices": [r[0] for r in rows if r[1] == "started"],
        "pending_request_indices": [r[0] for r in rows if r[1] == "pending"],
        "limit": "Only terminal records are exported; missing outcomes are not passes or proof of no charge.",
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("x", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            if row[1] in ("response_received", "request_failed"):
                handle.write(row[3] + "\n")
    with manifest.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(encoded(report) + "\n")
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=runner.DEFAULT_DATASET)
    parser.add_argument("--instruction-file", type=Path)
    parser.add_argument("--model", action="append", default=[])
    parser.add_argument("--state", type=Path, help="Local SQLite checkpoint; contains prompts and outputs, not credentials.")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--execute", action="store_true", help="Authorize real, potentially billed calls.")
    modes.add_argument("--status", action="store_true")
    modes.add_argument("--export-jsonl", type=Path, metavar="NEW_PATH")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--limit", type=int, default=2)
    parser.add_argument("--timeout", type=int, default=90)
    parser.add_argument("--max-tokens", type=int, default=512)
    parser.add_argument("--temperature", type=float)
    args = parser.parse_args()
    if args.resume and not args.execute:
        parser.error("--resume requires --execute")
    if (args.execute or args.status or args.export_jsonl) and not args.state:
        parser.error("This operation requires --state")
    try:
        if args.status:
            print(encoded(summary(read_checkpoint(args.state)[1])))
            return 0
        if args.export_jsonl:
            print(encoded(export_checkpoint(args.state, args.export_jsonl)))
            print("Exported terminal records and a coverage manifest; no model score assigned.")
            return 0
        if args.limit < 1:
            parser.error("--limit must be positive")
        cases = runner.load_cases(args.dataset)
        chosen = cases if args.all else cases[:args.limit]
        instruction = args.instruction_file.read_bytes().decode("utf-8") if args.instruction_file else None
        if args.execute and not args.model:
            parser.error("--execute requires --model")
        plan = make_plan(chosen, args.model or ["PROVIDER/MODEL"], instruction=instruction,
                         timeout=args.timeout, max_tokens=args.max_tokens, temperature=args.temperature,
                         dataset_sha256=hashlib.sha256(args.dataset.read_bytes()).hexdigest())
        print(f"Planned requests: {len(requests(plan))}; plan SHA256: {digest(encoded(plan))}")
        if not args.execute:
            print("DRY RUN: no requests, credentials, checkpoint writes or model scores.")
            return 0
        if importlib.util.find_spec("litellm") is None:
            parser.error("Install the optional litellm dependency before --execute")
        counts = execute_plan(args.state, plan, resume=args.resume)
        print(encoded(counts))
        print("Started without result = unresolved, not a safe retry. Counts are not model scores or billing records.")
        return 0 if counts["response_received"] == counts["planned"] else 1
    except (ValueError, OSError, sqlite3.Error, RuntimeError) as exc:
        print(f"Checkpoint stopped: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("Interrupted; any durable started marker remains unresolved. Resume will not retry it.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
